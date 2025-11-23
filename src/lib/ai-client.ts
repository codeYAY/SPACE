import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/db";

export interface AIClientConfig {
  modelProvider: "openrouter" | "local";
  openrouterApiKey?: string;
  openrouterModel?: string;
  localModelUrl?: string;
  localModelName?: string;
}

export async function getAIClient(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    throw new Error(
      "User settings not found. Please configure your AI provider in settings."
    );
  }

  if (settings.modelProvider === "openrouter") {
    if (!settings.openrouterApiKey) {
      throw new Error(
        "OpenRouter API key not configured. Please add it in settings."
      );
    }

    const openrouter = createOpenRouter({
      apiKey: settings.openrouterApiKey,
    });

    return {
      provider: openrouter,
      model: settings.openrouterModel || "anthropic/claude-3.5-sonnet",
      type: "openrouter" as const,
    };
  }

  if (settings.modelProvider === "local") {
    if (!settings.localModelUrl) {
      throw new Error(
        "Local model URL not configured. Please add it in settings."
      );
    }

    // For local models, we'll use OpenAI-compatible API
    const openrouter = createOpenRouter({
      apiKey: "local-model", // dummy key for local models
      baseURL: settings.localModelUrl,
    });

    return {
      provider: openrouter,
      model: settings.localModelName || "local-model",
      type: "local" as const,
    };
  }

  throw new Error("Invalid model provider configuration.");
}

export async function streamAIResponse(
  userId: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
) {
  const client = await getAIClient(userId);

  return {
    client,
    messages,
  };
}
