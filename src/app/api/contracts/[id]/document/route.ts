import { AppError } from "@/lib/errors";
import { contractId } from "@/features/modules/contracts/schema";
import {
  contractDocument,
  type ContractDocumentKind,
} from "@/server/modules/contracts/documents";
import { failure } from "@/server/http/response";

type Context = { params: Promise<{ id: string }> };
const kinds = ["tags", "template", "contract"];

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!contractId.safeParse(id).success)
      throw new AppError("BAD_REQUEST", "Invalid Contract identity.", 400);
    const kind = new URL(request.url).searchParams.get("kind");
    if (!kind || !kinds.includes(kind))
      throw new AppError("BAD_REQUEST", "Invalid document action.", 400);
    const { bytes, fileName, contentType } = await contractDocument(
      id,
      kind as ContractDocumentKind,
    );
    const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
