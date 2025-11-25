// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { codeAgentFunction } from "@/inngest/functions"; // Your own functions

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [codeAgentFunction],
  verbose: true,
  streaming: "allow"
});