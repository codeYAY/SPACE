# MSTROHub Authentication Guide

## Overview

This project uses a tiered authentication strategy to verify user tokens, prioritizing MSTROHub's custom JWT signing over standard Supabase JWKS verification.

## Authentication Priority

The system verifies authentication tokens in the following order:

1.  **MSTROHUB_JWT_SECRET (Primary)**
    *   **Method**: Symmetric key verification (HS256).
    *   **Env Var**: `MSTROHUB_JWT_SECRET`
    *   **Usage**: This is the preferred method for internal services. If this environment variable is set, the system attempts to decode the JWT using this secret.

2.  **Supabase JWKS (Secondary)**
    *   **Method**: Asymmetric key verification (RS256 via JWKS).
    *   **Env Var**: `NEXT_PUBLIC_MSTROHUB_SUPABASE_URL`
    *   **Usage**: Used if the primary secret is missing or verification fails. The system fetches the JSON Web Key Set (JWKS) from `<SUPABASE_URL>/auth/v1/jwks.json`.

3.  **Legacy Fallback (Development Only)**
    *   **Method**: Symmetric key verification (HS256).
    *   **Env Var**: `JWT_SECRET`
    *   **Usage**: Only active when `NODE_ENV=development`. Defaults to `"your-secret-key-here"` if the variable is unset. Used for local testing when real auth services aren't reachable.

## Implementation Details

The verification logic is encapsulated in `src/lib/auth.ts`.

```typescript
export async function verifyToken(token: string) {
  // 1. Try MSTROHUB_JWT_SECRET
  // 2. Try Supabase JWKS
  // 3. Try Legacy JWT_SECRET (Dev only)
}
```

## Environment Setup

Ensure your `.env` file is configured correctly:

```bash
# Primary (Production/Staging)
MSTROHUB_JWT_SECRET="your-secure-hs256-secret"

# Secondary (Supabase Integration)
NEXT_PUBLIC_MSTROHUB_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_MSTROHUB_SUPABASE_ANON_KEY="your-anon-key"

# Development Fallback
JWT_SECRET="dev-secret-only"
```

