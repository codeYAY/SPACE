import { Sandbox } from "@e2b/code-interpreter";
import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  anthropic,
  type Tool,
} from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { FileCollection } from "@/types";
import { inngest } from "./client";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  parseAgentOutput,
} from "./utils";
import { SANDBOX_TIMEOUT_IN_MS } from "@/constants";
import { getAsyncCtx } from "inngest/experimental";
import type { HiveSource } from "@/lib/mhive";
import { loadDataSpaceSummary, type DataSpaceSummary } from "@/lib/data-space";

interface AgentState {
  summary: string;
  files: FileCollection;
  dataSpace?: DataSpaceSummary;
}

export const codeAgentFunction = inngest.createFunction(
  { id: "rushed-agent" },
  { event: "rushed-agent/run" },
  async ({ event, step, publish }) => {
    const selectedSource = event.data.source as HiveSource | undefined;
    const userToken = (event.data.userToken as string | undefined)?.trim();
    const stepContextKey =
      event.data.projectId ??
      event.data.userId ??
      selectedSource?.id ??
      "global";
    const scopedStep = (name: string) => `${name}:${stepContextKey}`;

    const dataSpace = await step.run(
      scopedStep("load-data-space"),
      async () => {
        try {
          return await loadDataSpaceSummary(selectedSource, userToken);
        } catch (error) {
          console.error("Failed to load data space summary", error);
          return undefined;
        }
      }
    );

    const sandboxEnv = buildSandboxEnv(selectedSource, dataSpace, userToken);

    const sandboxId = await step.run(scopedStep("get-sandbox-id"), async () => {
      const sandbox = await Sandbox.create("mspace-nextjs-template", {
        apiKey: process.env.E2B_API_KEY,
        envs: sandboxEnv,
        allowInternetAccess: true,
      });
      await sandbox.setTimeout(SANDBOX_TIMEOUT_IN_MS);
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run(
      scopedStep("get-previous-messages"),
      async () => {
        const formattedMessages: Message[] = [];

        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        });

        for (const message of messages) {
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          });
        }

        const history = formattedMessages.reverse();
        if (dataSpace) {
          history.push({
            type: "text",
            role: "user",
            content: buildDataSpaceBrief(dataSpace),
          });
        }
        return history;
      }
    );

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
        dataSpace,
      },
      {
        messages: previousMessages,
      }
    );

    const codeAgent = createAgent<AgentState>({
      name: "rushed-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: anthropic({
        model: "claude-sonnet-4-5",
        defaultParameters: {
          max_tokens: 4096,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }) => {
            const buffers = {
              stdout: "",
              stderr: "",
            };

            try {
              const sandbox = await getSandbox(sandboxId);
              const execution = await sandbox.runCode(
                `set -euo pipefail\n${command}`,
                {
                  language: "bash",
                  onStdout: (message) => {
                    buffers.stdout += `${message.line}\n`;
                  },
                  onStderr: (message) => {
                    buffers.stderr += `${message.line}\n`;
                  },
                }
              );

              if (execution.error) {
                const serializedError = `${execution.error.name}: ${execution.error.value}`;

                return `command failed: ${serializedError}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}\ntraceback: ${execution.error.traceback}`;
              }

              const output =
                buffers.stdout.trim() ||
                execution.text ||
                execution.logs.stdout.join("\n") ||
                "Command completed.";

              return output;
            } catch (error) {
              console.error(
                `command failed: ${error}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`
              );
              return `command failed: ${error}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
            }
          },
        }),

        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              })
            ),
          }),
          handler: async ({ files }, { network }: Tool.Options<AgentState>) => {
            try {
              const updatedFiles = network.state.data.files || {};
              const sandbox = await getSandbox(sandboxId);

              for (const file of files) {
                await sandbox.files.write(file.path, file.content);
                updatedFiles[file.path] = file.content;
              }

              network.state.data.files = updatedFiles;
              return "Files created/updated successfully";
            } catch (error) {
              return "Error: " + error;
            }
          },
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }) => {
            try {
              const sandbox = await getSandbox(sandboxId);
              const contents = [];

              for (const file of files) {
                const content = await sandbox.files.read(file);
                contents.push({ path: file, content });
              }

              return JSON.stringify(contents);
            } catch (error) {
              return "Error: " + error;
            }
          },
        }),
        createTool({
          name: "viewDataSpaceCollection",
          description:
            "Preview schema details and sample rows for a Hive Data Space collection",
          parameters: z.object({
            key: z.string().describe("Collection key or title to inspect"),
            offset: z
              .number()
              .int()
              .min(0)
              .default(0)
              .describe("Starting row offset within the collection"),
            limit: z
              .number()
              .int()
              .min(1)
              .max(100)
              .default(25)
              .describe("Number of rows to return from the offset"),
            includeSchema: z
              .boolean()
              .default(true)
              .describe("Include the field schema in the response"),
          }),
          handler: async (
            { key, offset, limit, includeSchema },
            { network }: Tool.Options<AgentState>
          ) => {
            const dataSpaceContext = network?.state.data.dataSpace;
            if (!dataSpaceContext || !dataSpaceContext.collections.length) {
              return "No data space collections are available for this run.";
            }

            const collection = findCollection(dataSpaceContext, key);
            if (!collection) {
              const available = dataSpaceContext.collections
                .map((item) => `${item.key} (${item.title})`)
                .join(", ");
              return `Collection "${key}" was not found. Available collections: ${available}`;
            }

            const safeOffset = sanitizeOffset(offset);
            const safeLimit = sanitizeLimit(limit);
            const rows = collection.records.slice(
              safeOffset,
              safeOffset + safeLimit
            );
            const schema =
              includeSchema && collection.schema
                ? collection.schema
                : includeSchema
                ? inferSchemaFromRecords(collection.records)
                : undefined;

            return JSON.stringify(
              {
                key: collection.key,
                title: collection.title,
                totalRecords: collection.totalRecords,
                offset: safeOffset,
                limit: safeLimit,
                schema,
                rows,
              },
              null,
              2
            );
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantTextMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantTextMessageText && network) {
            if (lastAssistantTextMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantTextMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: ({ network, callCount }) => {
        const summary = network.state.data.summary;
        if (summary || callCount >= 15) {
          return undefined;
        }
        return codeAgent;
      },
    });

    const asyncCtx = await getAsyncCtx();
    if (asyncCtx && !asyncCtx.ctx && asyncCtx.execution?.ctx) {
      (asyncCtx as Record<string, unknown>).ctx = asyncCtx.execution.ctx;
    }
    //  fix from this line -> const result = await network.run(event.data.value, {
    let streamChunkIndex = 0;

    await network.run(event.data.value, {
      state,
      streaming: {
        publish: async (chunk) => {
          const payload = {
            ...chunk,
            data: {
              ...(chunk.data || {}),
              projectId: event.data.projectId,
              userId: event.data.userId,
            },
          };

          await step.run(scopedStep(`stream-chunk-${streamChunkIndex++}`), () =>
            publish({
              name: "agent.stream",
              data: payload,
              ...(event.data.userId
                ? {
                    user: { id: event.data.userId },
                  }
                : {}),
            })
          );
        },
      },
    });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: anthropic({
        model: "claude-sonnet-4-5",
        defaultParameters: {
          max_tokens: 1096,
        },
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: anthropic({
        model: "claude-sonnet-4-5",
        defaultParameters: {
          max_tokens: 2096,
        },
      }),
    });

    // State is mutated in place during network run, so access it directly
    const summary = state.data.summary;
    const files = state.data.files || {};

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      summary || "No summary available"
    );

    const { output: responseOutput } = await responseGenerator.run(
      summary || "No summary available"
    );

    const isError = !summary || Object.keys(files).length === 0;

    const sandboxUrl = await step.run(
      scopedStep("get-sandbox-url"),
      async () => {
        const url = await resolveSandboxUrl(sandboxId);
        console.log("sbx sandboxUrl", url);
        return url;
      }
    );

    await step.run(scopedStep("save-result"), async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl,
              title: parseAgentOutput(fragmentTitleOutput),
              files: files,
            },
          },
        },
      });
    });

    console.log("sbx responseOutput", responseOutput);

    console.log("sbx fragmentTitleOutput", fragmentTitleOutput);

    console.log("sbx files", files);

    console.log("sbx summary", summary);

    return {
      url: sandboxUrl,
      title: "Artifact",
      files: files,
      summary: summary,
    };
  }
);

async function resolveSandboxUrl(sandboxId: string) {
  const sandbox = await getSandbox(sandboxId);
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const host = sandbox.getHost(3000);
      if (host) {
        return `https://${host}`;
      }
    } catch (error) {
      console.warn(
        `sandbox port unavailable (attempt ${attempt + 1}/${maxAttempts})`,
        error
      );

      if (attempt === maxAttempts - 1) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.max(1, attempt + 1))
      );
    }
  }

  throw new Error("Unable to resolve sandbox host");
}

function buildSandboxEnv(
  source?: HiveSource,
  dataSpace?: DataSpaceSummary,
  authToken?: string | null
): Record<string, string> {
  const envs: Record<string, string> = {};

  if (source?.id) {
    envs.MHIVE_DATA_SOURCE_ID = source.id;
  }

  if (source?.name) {
    envs.MHIVE_DATA_SOURCE_NAME = source.name;
  }

  if (source?.type) {
    envs.MHIVE_DATA_SOURCE_TYPE = source.type;
  }

  if (source?.path) {
    envs.MHIVE_DATA_SOURCE_PATH = source.path;
  }

  const spaceId = source?.metadata?.spaceId as string | undefined;
  if (spaceId) {
    envs.MHIVE_DATA_SPACE_ID = spaceId;
  }

  const virtualId = source?.metadata?.virtualEndpointId;
  if (virtualId) {
    envs.MHIVE_DATA_SPACE_VIRTUAL_ID = String(virtualId);
  }

  if (source?.metadata?.spacePath) {
    envs.MHIVE_DATA_SPACE_BASE_PATH = String(source.metadata.spacePath);
  }

  if (dataSpace?.endpointUrl) {
    envs.MHIVE_DATA_SPACE_ENDPOINT = dataSpace.endpointUrl;
  }

  const effectiveToken = authToken || process.env.MHIVE_API_TOKEN;
  if (effectiveToken) {
    envs.MHIVE_API_TOKEN = effectiveToken;
  }

  if (process.env.NEXT_PUBLIC_MHIVE_API_URL) {
    envs.NEXT_PUBLIC_MHIVE_API_URL = process.env.NEXT_PUBLIC_MHIVE_API_URL;
  }

  return envs;
}

function buildDataSpaceBrief(dataSpace: DataSpaceSummary) {
  const header = [
    `DATA SPACE SOURCE: ${dataSpace.sourceName ?? "Unknown"}`,
    dataSpace.spaceName ? `Space: ${dataSpace.spaceName}` : undefined,
    `Endpoint: ${dataSpace.endpointUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!dataSpace.collections.length) {
    return `${header}\nNo collections were returned from the endpoint.`;
  }

  const collectionsSummary = dataSpace.collections
    .map((collection) => {
      const fieldCount =
        collection.schema && typeof collection.schema === "object"
          ? Object.keys(collection.schema).length
          : collection.records[0]
          ? Object.keys(collection.records[0]).length
          : 0;
      return `- ${collection.key}: ${collection.totalRecords} records, ${fieldCount} fields`;
    })
    .join("\n");

  return `${header}\nCollections:\n${collectionsSummary}\nUse the viewDataSpaceCollection tool to inspect schema or sample rows before building UI bindings.`;
}

function findCollection(dataSpace: DataSpaceSummary, key: string) {
  const normalizedKey = key.trim().toLowerCase();
  return (
    dataSpace.collections.find(
      (collection) =>
        collection.key.toLowerCase() === normalizedKey ||
        collection.title.toLowerCase() === normalizedKey
    ) ?? null
  );
}

function sanitizeOffset(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function sanitizeLimit(value: number) {
  if (!Number.isFinite(value)) {
    return 25;
  }

  if (value < 1) {
    return 1;
  }

  if (value > 100) {
    return 100;
  }

  return Math.floor(value);
}

function inferSchemaFromRecords(records: Record<string, unknown>[]) {
  const schema: Record<string, string> = {};

  for (const record of records) {
    for (const [field, value] of Object.entries(record)) {
      if (schema[field]) {
        continue;
      }

      schema[field] = inferFieldType(value);
    }
  }

  return schema;
}

function inferFieldType(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Date) {
    return "date";
  }

  return typeof value;
}
