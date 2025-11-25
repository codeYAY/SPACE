import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { HiveClient } from "@/lib/mhive";

export const mhiveRouter = createTRPCRouter({
  getSources: protectedProcedure.query(async ({ ctx }) => {
    const client = new HiveClient(ctx.token);
    return await client.getSources();
  }),
});
