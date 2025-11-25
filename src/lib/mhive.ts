import { z } from "zod";

export const MHIVE_API_URL =
  process.env.NEXT_PUBLIC_MHIVE_API_URL || "https://dc-mhive-api.mstrohive.com";
const MHIVE_API_TOKEN = process.env.MHIVE_API_TOKEN;

export type HiveSourceType = "data-space" | "connection";

export interface HiveSource {
  id: string;
  name: string;
  description?: string;
  type: HiveSourceType;
  path: string; // For data spaces, this is the space path. For connections, maybe endpoint URL or similar.
  metadata: Record<string, unknown>;
}

// Schema inference from context
const ConnectionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  connection_id: z.union([z.string(), z.number()]).optional(),
  name: z.string(),
  description: z.string().optional(),
  connection_type: z.string().optional(),
  base_url: z.string().optional(),
});

const DataSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  base_path: z.string().optional(),
});

const VirtualEndpointSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  virtual_endpoint_id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  path: z.string(),
  method: z.string().optional(),
});

type Connection = z.infer<typeof ConnectionSchema>;
type DataSpace = z.infer<typeof DataSpaceSchema>;
type VirtualEndpoint = z.infer<typeof VirtualEndpointSchema>;

const LIST_KEYS = [
  "items",
  "results",
  "data",
  "data_spaces",
  "virtual_endpoints",
];

export class HiveClient {
  private token: string;
  private baseUrl: string;

  constructor(token?: string, baseUrl?: string) {
    this.token = token || MHIVE_API_TOKEN || "";
    this.baseUrl = baseUrl || MHIVE_API_URL;
  }

  private assertToken() {
    if (!this.token) {
      throw new Error(
        "MHIVE_API_TOKEN is not set. Add it to your .env so we can call the Hive API."
      );
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    this.assertToken();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Hive API error (${path}): ${res.status} ${res.statusText} - ${body}`
      );
    }

    return res.json();
  }

  private parseList<T>(input: unknown, schema: z.ZodType<T>): T[] {
    if (Array.isArray(input)) {
      return input
        .map((item) => {
          const parsed = schema.safeParse(item);
          return parsed.success ? parsed.data : null;
        })
        .filter((item): item is T => Boolean(item));
    }

    if (input && typeof input === "object") {
      for (const key of LIST_KEYS) {
        const value = (input as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          return this.parseList(value, schema);
        }
      }
    }
    const single = schema.safeParse(input);
    return single.success ? [single.data] : [];
  }

  private normalizePath(...parts: (string | undefined)[]) {
    const combined = parts
      .filter((segment): segment is string => Boolean(segment))
      .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
    const normalized = combined.replace(/\/{2,}/g, "/");
    return normalized.startsWith("/")
      ? `/${normalized.replace(/^\/+/, "")}`
      : `/${normalized}`;
  }

  async getConnections(): Promise<Connection[]> {
    try {
      const payload = await this.request<unknown>("/api/v1/connections/");
      return this.parseList(payload, ConnectionSchema);
    } catch (e) {
      console.error("Failed to fetch connections", e);
      return [];
    }
  }

  async getDataSpaces(): Promise<DataSpace[]> {
    try {
      const payload = await this.request<unknown>("/api/v1/data-spaces/");
      return this.parseList(payload, DataSpaceSchema);
    } catch (e) {
      console.error("Failed to fetch data spaces", e);
      return [];
    }
  }

  async getVirtualEndpoints(spaceId: string): Promise<VirtualEndpoint[]> {
    try {
      const payload = await this.request<unknown>(
        `/api/v1/data-spaces/${encodeURIComponent(spaceId)}/virtual-endpoints`
      );
      return this.parseList(payload, VirtualEndpointSchema);
    } catch (e) {
      console.error(
        `Failed to fetch virtual endpoints for space ${spaceId}`,
        e
      );
      return [];
    }
  }

  async getSources(): Promise<HiveSource[]> {
    const [connections, spaces] = await Promise.all([
      this.getConnections(),
      this.getDataSpaces(),
    ]);

    const spaceWithEndpoints = await Promise.all(
      spaces.map(async (space) => ({
        space,
        endpoints: await this.getVirtualEndpoints(space.id),
      }))
    );

    const sources: HiveSource[] = [];

    for (const { space, endpoints } of spaceWithEndpoints) {
      if (endpoints.length === 0) {
        sources.push({
          id: space.id,
          name: space.name,
          description: space.description,
          type: "data-space",
          path: space.base_path || "",
          metadata: { spaceId: space.id },
        });
        continue;
      }

      for (const endpoint of endpoints) {
        const virtualId =
          endpoint.id?.toString() ??
          endpoint.virtual_endpoint_id?.toString() ??
          endpoint.path;
        const endpointLabel =
          endpoint.name || endpoint.description || endpoint.path;
        const normalizedPath = this.normalizePath(
          space.base_path || "",
          endpoint.path
        );

        sources.push({
          id: `${space.id}:${virtualId}`,
          name: `${space.name} — ${endpointLabel}`,
          description: endpoint.description || space.description,
          type: "data-space",
          path: normalizedPath,
          metadata: {
            spaceId: space.id,
            spacePath: space.base_path,
            virtualEndpointId: virtualId,
            endpoint,
          },
        });
      }
    }

    for (const conn of connections) {
      const connectionId = (conn.connection_id ?? conn.id)?.toString();
      if (!connectionId) {
        continue;
      }
      sources.push({
        id: connectionId,
        name: conn.name,
        description: conn.description,
        type: "connection",
        path: conn.base_url || "",
        metadata: { connectionId },
      });
    }

    return sources;
  }
}

export const mhive = new HiveClient();
