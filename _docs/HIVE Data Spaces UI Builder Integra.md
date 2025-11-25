# HIVE Data Spaces: UI Builder & Integration Guide

## 1. Overview

**Data Spaces** are logical containers for **Virtual Endpoints**—intelligent, aggregated API endpoints that combine data from multiple sources (databases, SaaS APIs) into a single, unified JSON response.

For UI builders (using Inngest, Agents, and E2B), a Virtual Endpoint behaves like a standard REST API but returns a rich, structured payload designed for AI and dynamic UI generation.

## 2. Virtual Endpoint Output Schema

Every Virtual Endpoint returns a standardized JSON object known as the **LLM-Ready Payload**. This structure is consistent regardless of the underlying data sources.

### JSON Structure

```json
{
  "context": {
    "space": {
      "id": "uuid-string",
      "name": "Customer 360",
      "base_path": "/spaces/customer-360"
    },
    "endpoint": {
      "path": "/spaces/customer-360/overview",
      "method": "GET",
      "description": "Aggregated view of customer profile and recent tickets"
    },
    "strategy": "merge", // "merge", "join", or "aggregate"
    "record_count": 25,
    "execution_time_ms": 150,
    "sources": [
      { "alias": "crm", "status": "success" },
      { "alias": "tickets", "status": "success" }
    ],
    "cache_hit": false
  },
  "collections": [
    {
      "name": "default", // or specific dataset name like "users"
      "description": "Primary data collection",
      "items": [
        {
          "id": "123",
          "name": "Alice Smith",
          "email": "alice@example.com",
          "ticket_count": 5,
          "last_active": "2023-10-27T10:00:00Z"
        }
        // ... more records
      ]
    }
  ],
  "insights": {
    "summary": "High ticket volume detected for recent signups.",
    "patterns": ["Pattern A", "Pattern B"]
  }
}
```

### Key Fields for UI Binding

1.  **`collections[0].items`**: This is your **primary data array**. Bind this to tables, lists, or grids.
2.  **`context.endpoint.description`**: Use this for the page title or section header.
3.  **`context.record_count`**: Display this in a badge or footer.
4.  **`context.execution_time_ms`**: Optional performance metric.

---

## 3. Integration Details

To fetch data for your UI:

- **Endpoint URL**: `https://<api-host>/api/v1/public/spaces/<space_path>`
- **Method**: `GET` (typically)
- **Authentication**: Add header `Authorization: Bearer <your-api-token>`

---

## 4. Prompt for UI Builder Agents

Use the following prompt block when instructing your Inngest/E2B agents to generate a UI for a Data Space connection.

---

### System Prompt: Data Space UI Generator

You are an expert UI engineer building a Next.js interface for a mSpace.
Your goal is to create a responsive, modern dashboard using **Shadcn UI** components that visualizes the data from a Virtual Endpoint.

**1. Data Source Configuration:**

- **Fetch URL**: `{VIRTUAL_ENDPOINT_URL}`
- **Auth Header**: `Authorization: Bearer {API_TOKEN}`
- **Data Access Pattern**: The API returns a wrapper object. **DO NOT** bind the root object to a table.
  - **Access Data**: `response.collections[0].items` (Array of objects)
  - **Access Metadata**: `response.context` (Stats and info)

**2. Component Requirements:**

- **Header**: Display `response.context.space.name` and `response.context.endpoint.description`.
- **Stats Cards**: Show `Record Count` (`context.record_count`) and `Sources` (`context.sources.length`).
- **Main Data View**:
  - Create a **Data Table** (using `@tanstack/react-table` or similar) bound to `collections[0].items`.
  - Auto-generate columns based on the keys of the first item in `items`.
  - Format timestamps (ISO 8601) to readable dates.
  - Render boolean values as "Yes/No" or badges.
- **Error Handling**: Display a clean error state if the fetch fails or `collections` is empty.

**3. Technical Implementation (Next.js):**

- Use a Server Component for the initial fetch if possible, or a client-side hook (`useSWR` or `react-query`) for live data.
- **CRITICAL**: The API response structure is fixed. Always assume the data array is inside `collections[0].items`.

**4. Example Fetch Code:**

```typescript
async function fetchData() {
  const res = await fetch(ENDPOINT_URL, {
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
  });
  const json = await res.json();

  // Validate structure
  if (!json.collections || json.collections.length === 0) {
    return [];
  }

  // Return actual data items
  return json.collections[0].items;
}
```

---

## 5. Inngest & E2B Templating

When the User selects a Data Space or Connection from the home page, the `source` object is passed to the Inngest workflow. Use this object to hydrate the prompt templates.

### Source Object Structure

```typescript
interface HiveSource {
  id: string;
  name: string;
  type: "data-space" | "connection";
  path: string; // The specific endpoint path or base path
  description?: string;
  metadata?: Record<string, any>;
}
```

### Template Injection

When generating code in E2B or prompting the LLM, replace the following placeholders:

- `{VIRTUAL_ENDPOINT_URL}`:
  - If `type === "data-space"`, construct: `https://dc-mhive-api.mstrohive.com${source.path}` (ensure path starts with `/`)
  - If `type === "connection"`, use `source.path` (assuming it's a full URL) or appropriate base URL logic.
- `{API_TOKEN}`: Inject `process.env.MHIVE_API_TOKEN`.

### Example Inngest Handler Logic

```typescript
// In your Inngest function (pseudo-code)
const source = event.data.source;
const mh_api_url =
  process.env.NEXT_PUBLIC_MHIVE_API_URL || "https://dc-mhive-api.mstrohive.com";

let endpointUrl = source.path;
if (source.type === "data-space" && !source.path.startsWith("http")) {
  endpointUrl = `${mh_api_url}${source.path}`;
}

// For actual execution, use the execution endpoint:
// /api/v1/data-spaces/{space_id}/virtual-endpoints/{virtual_id}/execute
if (source.metadata?.virtualEndpointId) {
  const spaceId = source.metadata.spaceId;
  const virtualId = source.metadata.virtualEndpointId;
  endpointUrl = `${mh_api_url}/api/v1/data-spaces/${spaceId}/virtual-endpoints/${virtualId}/execute`;
}

const systemPrompt = SYSTEM_PROMPT.replace(
  "{VIRTUAL_ENDPOINT_URL}",
  endpointUrl
).replace("{API_TOKEN}", process.env.MHIVE_API_TOKEN);
```

### Authentication & API Keys (Environment Priority)

When integrating with backend auth, the system follows this priority order:

1.  **`MSTROHUB_JWT_SECRET`** (Primary): Used for symmetric key verification (HS256).
2.  **`MSTROHUB_SUPABASE_URL`** (Secondary): Falls back to fetching JWKS for verification.
3.  **`JWT_SECRET`** (Legacy/Dev): Only used as a fallback in development environments.
