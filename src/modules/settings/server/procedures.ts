import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const settingsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: ctx.auth.userId },
    });

    return settings;
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        modelProvider: z.enum(["openrouter", "local"]),
        openrouterApiKey: z.string().optional(),
        openrouterModel: z.string().optional(),
        localModelUrl: z.string().optional(),
        localModelName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await prisma.userSettings.upsert({
        where: { userId: ctx.auth.userId! },
        update: {
          modelProvider: input.modelProvider,
          openrouterApiKey: input.openrouterApiKey,
          openrouterModel: input.openrouterModel || "z-ai/glm-4.6",
          localModelUrl: input.localModelUrl,
          localModelName: input.localModelName,
        },
        create: {
          userId: ctx.auth.userId!,
          modelProvider: input.modelProvider,
          openrouterApiKey: input.openrouterApiKey,
          openrouterModel: input.openrouterModel || "z-ai/glm-4.6",
          localModelUrl: input.localModelUrl,
          localModelName: input.localModelName,
        },
      });

      return settings;
    }),
});
