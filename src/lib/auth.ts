import { jwtVerify, createRemoteJWKSet } from "jose";

const MSTROHUB_JWT_SECRET = process.env.MSTROHUB_JWT_SECRET;
const MSTROHUB_SUPABASE_URL = process.env.NEXT_PUBLIC_MSTROHUB_SUPABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here";
const NODE_ENV = process.env.NODE_ENV || "development";

export async function verifyAuthToken(token: string) {
  if (!token) return null;

  // 1. Primary: MSTROHUB_JWT_SECRET (HS256)
  if (MSTROHUB_JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(MSTROHUB_JWT_SECRET),
        { algorithms: ["HS256"] }
      );
      return payload;
    } catch {
      // Fall through to next method
    }
  }

  // 2. Secondary: Supabase JWKS (RS256)
  if (MSTROHUB_SUPABASE_URL) {
    try {
      const JWKS = createRemoteJWKSet(
        new URL(`${MSTROHUB_SUPABASE_URL}/auth/v1/jwks`)
      );
      const { payload } = await jwtVerify(token, JWKS);
      return payload;
    } catch {
      // Fall through
    }
  }

  // 3. Legacy/Dev: JWT_SECRET
  if (NODE_ENV === "development") {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(JWT_SECRET),
        { algorithms: ["HS256"] }
      );
      return payload;
    } catch {
      // Token invalid
    }
  }

  return null;
}
