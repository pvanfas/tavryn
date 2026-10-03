import { streamText } from "ai";
import { z } from "zod";

import { processCommandQuery } from "@/lib/agent/command";
import { getAgentLanguageModel, isLiveLLMConfigured } from "@/lib/agent/provider";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CommandQuerySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000),
  businessId: z.string().uuid().optional(),
  stream: z.boolean().optional().default(true),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .optional(),
});

export async function POST(req: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body", 400);
    }

    const validation = CommandQuerySchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError(
        "Invalid command request",
        400,
        validation.error.format(),
      );
    }

    const {
      message,
      stream,
      businessId: requestedBusinessId,
    } = validation.data;

    // Resolve business ID (fallback to first available or Demo Co)
    let businessId: string = requestedBusinessId || "";
    if (!businessId) {
      const supabase = getServiceSupabase();
      const { data: firstB } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();
      businessId = firstB?.id || "b655fb94-fc62-4e3c-8898-2c5f88068159";
    }

    // Rate limit per business/IP
    const rate = checkRateLimit(`cmd_${businessId}`, 30, 60_000);
    if (!rate.success) {
      return apiError("Rate limit exceeded. Please wait a moment.", 429, {
        resetMs: rate.resetMs,
      });
    }

    // Process query through deterministic command engine
    const result = await processCommandQuery(message, businessId);

    // If stream is requested via query param or header
    const acceptHeader = req.headers.get("accept") || "";
    const isEventStream =
      stream &&
      (acceptHeader.includes("text/event-stream") ||
        acceptHeader.includes("*/*"));

    if (isEventStream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            const isRealLLM = isLiveLLMConfigured();

            if (isRealLLM && !result.card) {
              try {
                const model = getAgentLanguageModel();
                const { textStream } = streamText({
                  model,
                  prompt: `You are Tavryn, an autonomous enterprise procurement and spend defense AI agent.
User command: "${message}"
Data and context: ${result.text}
Provide a crisp, professional, direct response.`,
                });

                let current = "";
                for await (const chunk of textStream) {
                  current += chunk;
                  const chunkPayload = JSON.stringify({
                    type: "chunk",
                    chunk,
                    fullText: current,
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${chunkPayload}\n\n`),
                  );
                }
              } catch (llmStreamErr) {
                console.warn(
                  "[CommandStream] streamText error, falling back to chunked result:",
                  llmStreamErr,
                );
                await emitTypewriterChunks(result.text, controller, encoder);
              }
            } else {
              await emitTypewriterChunks(result.text, controller, encoder);
            }

            // Stream structured card payload if present
            if (result.card) {
              const cardPayload = JSON.stringify({
                type: "card",
                card: result.card,
              });
              controller.enqueue(encoder.encode(`data: ${cardPayload}\n\n`));
            }

            // Completion signal
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  success: result.success,
                  toolCalls: result.toolCalls,
                })}\n\n`,
              ),
            );
          } catch (streamErr) {
            controller.error(streamErr);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(customReadable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Direct JSON response fallback
    return apiSuccess({
      text: result.text,
      card: result.card,
      toolCalls: result.toolCalls,
      businessId: result.businessId,
    });
  } catch (err) {
    return handleApiError(err, "Failed to process Ask Tavryn command");
  }
}

async function emitTypewriterChunks(
  text: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const words = text.split(" ");
  let current = "";
  for (let i = 0; i < words.length; i++) {
    current += (i > 0 ? " " : "") + words[i];
    if (i % 3 === 0 || i === words.length - 1) {
      const chunkPayload = JSON.stringify({
        type: "chunk",
        chunk:
          (i > 0 ? " " : "") +
          words.slice(Math.max(0, i - 2), i + 1).join(" "),
        fullText: current,
      });
      controller.enqueue(encoder.encode(`data: ${chunkPayload}\n\n`));
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}
