import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { createClient } from "@/lib/supabase/server";
import { verifyAuthToken } from "@/lib/auth";
import { headers } from "next/headers";

export const createTRPCContext = cache(async () => {
  // 1. Try Supabase cookies (standard browser auth)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let authedUser = user || null;
  let token = session?.access_token;

  // 2. If no cookie user, try Authorization header (API/CLI access)
  if (!authedUser) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
      const payload = await verifyAuthToken(token);

      if (payload?.sub) {
        // Map JWT payload to User-like object
        authedUser = {
          id: payload.sub,
          email: payload.email as string | undefined,
          user_metadata:
            (payload.user_metadata as Record<string, unknown>) || {},
          app_metadata: (payload.app_metadata as Record<string, unknown>) || {},
          aud: payload.aud as string,
          created_at: new Date().toISOString(),
        } as {
          id: string;
          email?: string;
          user_metadata: Record<string, unknown>;
          app_metadata: Record<string, unknown>;
          aud: string;
          created_at: string;
        };
      }
    }
  }

  return { user: authedUser, token };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  return next({
    ctx: {
      user: ctx.user,
      token: ctx.token,
    },
  });
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// Protect data access layer (trpc) - don't rely on middleware!
export const protectedProcedure = t.procedure.use(isAuthed);
