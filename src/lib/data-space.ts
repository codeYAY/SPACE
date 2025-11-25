import type { HiveSource } from "./mhive";
import { MHIVE_API_URL } from "./mhive";

type HttpMethod = "GET" | "POST";

interface DataSpaceEndpointCandidate {
  url: string;
  method: HttpMethod;
  reason: string;
}

interface RawDataSpacePayload {
  context?: Record<string, unknown>;
  collections?: Array<Record<string, unknown>>;
  insights?: Record<string, unknown>;
}

export interface DataSpaceCollectionSummary {
  key: string;
  title: string;
  description?: string;
  schema?: Record<string, unknown>;
  totalRecords: number;
  records: Record<string, unknown>[];
}

export interface DataSpaceSummary {
  endpointUrl: string;
  sourceName?: string;
  spaceName?: string;
  context?: Record<string, unknown>;
  insights?: Record<string, unknown>;
  collections: DataSpaceCollectionSummary[];
}

const MAX_ROWS_PER_COLLECTION = 2000;

export async function loadDataSpaceSummary(
  source?: HiveSource | null,
  authToken?: string
): Promise<DataSpaceSummary | undefined> {
  if (!source) {
    return undefined;
  }

  const token = authToken?.trim() || process.env.MHIVE_API_TOKEN;
  if (!token) {
    console.warn("Missing MHIVE_API_TOKEN; skipping data space preview.");
    return undefined;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_MHIVE_API_URL?.trim() || MHIVE_API_URL;

  const candidates = buildEndpointCandidates(source, baseUrl);
  if (!candidates.length) {
    return undefined;
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const payload = await requestDataSpace(candidate, token);
      const summary = normalizeDataSpacePayload(payload, candidate, source);
      if (summary) {
        return summary;
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `[data-space] Candidate failed (${candidate.reason}):`,
        candidate.url,
        error
      );
    }
  }

  if (lastError) {
    console.error(
      "[data-space] Unable to load LLM payload for source",
      source.id,
      lastError
    );
  }

  return undefined;
}

function buildEndpointCandidates(
  source: HiveSource,
  baseUrl: string
): DataSpaceEndpointCandidate[] {
  const candidates: DataSpaceEndpointCandidate[] = [];
  const normalizedPath = normalizePath(source.path);

  if (source.type === "data-space") {
    const spaceId = source.metadata?.spaceId as string | undefined;
    const virtualId = source.metadata?.virtualEndpointId as
      | string
      | number
      | undefined;

    if (spaceId && virtualId) {
      const encodedSpace = encodeURIComponent(spaceId);
      const encodedVirtual = encodeURIComponent(String(virtualId));
      candidates.push({
        url: `${baseUrl}/api/v1/data-spaces/${encodedSpace}/virtual-endpoints/${encodedVirtual}/execute`,
        method: "POST",
        reason: "virtual-endpoint-execute",
      });
    }

    if (normalizedPath) {
      const absolutePath = ensureAbsoluteUrl(normalizedPath, baseUrl);
      candidates.push({
        url: absolutePath,
        method: "GET",
        reason: "normalized-space-path",
      });
    }
  } else if (source.type === "connection" && normalizedPath) {
    const absolutePath = ensureAbsoluteUrl(normalizedPath, baseUrl);
    candidates.push({
      url: absolutePath,
      method: "GET",
      reason: "connection-path",
    });
  }

  return candidates;
}

async function requestDataSpace(
  candidate: DataSpaceEndpointCandidate,
  token: string
) {
  const response = await fetch(candidate.url, {
    method: candidate.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: candidate.method === "POST" ? "{}" : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Data space request failed (${candidate.method} ${candidate.url}): ${response.status} ${response.statusText} - ${body}`
    );
  }

  return (await response.json()) as RawDataSpacePayload;
}

function normalizeDataSpacePayload(
  payload: RawDataSpacePayload,
  candidate: DataSpaceEndpointCandidate,
  source: HiveSource
): DataSpaceSummary | undefined {
  const rawCollections = Array.isArray(payload.collections)
    ? payload.collections
    : [];

  if (!rawCollections.length) {
    return {
      endpointUrl: candidate.url,
      sourceName: source.name,
      spaceName: getSpaceName(payload),
      context: payload.context,
      insights: payload.insights,
      collections: [],
    };
  }

  const collections = rawCollections.map((collection, index) =>
    normalizeCollection(collection, index)
  );

  return {
    endpointUrl: candidate.url,
    sourceName: source.name,
    spaceName: getSpaceName(payload),
    context: payload.context,
    insights: payload.insights,
    collections,
  };
}

function normalizeCollection(
  collection: Record<string, unknown>,
  index: number
): DataSpaceCollectionSummary {
  const key =
    (collection.key as string) ||
    (collection.name as string) ||
    (collection.title as string) ||
    `collection_${index}`;
  const title =
    (collection.title as string) ||
    (collection.name as string) ||
    `Collection ${index + 1}`;

  const schema =
    typeof collection.schema === "object" && collection.schema !== null
      ? (collection.schema as Record<string, unknown>)
      : undefined;

  const records = extractRecords(collection).slice(0, MAX_ROWS_PER_COLLECTION);

  const totalRecords =
    parseRecordCount(collection.record_count) ??
    parseRecordCount(collection.recordCount) ??
    (Array.isArray(collection.items)
      ? collection.items.length
      : Array.isArray(collection.records)
      ? collection.records.length
      : records.length);

  return {
    key: String(key),
    title: String(title),
    description: (collection.description as string) || undefined,
    schema,
    totalRecords,
    records,
  };
}

function extractRecords(collection: Record<string, unknown>) {
  const items = collection.items;
  const records = collection.records;

  if (Array.isArray(items)) {
    return sanitizeRecords(items);
  }

  if (Array.isArray(records)) {
    return sanitizeRecords(records);
  }

  return [];
}

function sanitizeRecords(items: unknown[]): Record<string, unknown>[] {
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>);
}

function parseRecordCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getSpaceName(payload: RawDataSpacePayload) {
  const space = payload.context?.space;
  if (space && typeof space === "object") {
    const name = (space as Record<string, unknown>).name;
    if (typeof name === "string") {
      return name;
    }
  }

  return undefined;
}

function normalizePath(path?: string) {
  if (!path) {
    return undefined;
  }

  if (path.startsWith("http")) {
    return path;
  }

  const trimmed = path.replace(/\/{2,}/g, "/");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function ensureAbsoluteUrl(path: string, baseUrl: string) {
  if (path.startsWith("http")) {
    return path;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`.replace(/([^:]\/)\/+/g, "$1");
}
