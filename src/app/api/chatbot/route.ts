import { z } from "zod";
import { askChatbot, question } from "@/server/modules/chatbot/service";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 16384;
const body = z.object({ question }).strict();
/** Reads at most MAX_BODY bytes, so an oversized body is refused before it is buffered. */
async function readBounded(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("BAD_REQUEST", "Empty chatbot request.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new AppError("BAD_REQUEST", "Chatbot request is too large.", 400);
    }
    chunks.push(part.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
export const POST = route(
  async (request) => {
    let parsed: z.infer<typeof body>;
    try {
      parsed = body.parse(JSON.parse(await readBounded(request)));
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(
        "BAD_REQUEST",
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? "Invalid message.")
          : "Invalid chatbot request.",
        400,
      );
    }
    return askChatbot(parsed.question);
  },
  { write: true },
);
