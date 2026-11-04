import { readText, readUpload } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { formGlobals } from "@/server/record/dynamic-form/globals";
import {
  deleteSignOff,
  saveSignOff,
  signOffList,
} from "@/server/modules/claims/units/record/sign-off";

type Context = { params: Promise<{ id: string }> };
/** One sign-off list (`?view=stakeholders|meetings|documents`), read when its tab opens. */
export const GET = route<Context>(async (request, { params }) =>
  signOffList((await params).id, searchOf(request).get("view")),
);
/** WRITES: adds a row, or updates `row` (`?view=`); multipart, with an optional `file` for meetings and documents. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { maxMb } = await formGlobals();
    const { file, fields } = await readUpload(request, maxMb, false);
    return saveSignOff(
      (await params).id,
      searchOf(request).get("view"),
      fields,
      file,
    );
  },
  { write: true },
);
/** WRITES: removes `{ row }` (`?view=`). */
export const DELETE = route<Context>(
  async (request, { params }) => {
    let body: { row?: unknown };
    try {
      body = JSON.parse(await readText(request, 1024));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid row.", 400);
    }
    return deleteSignOff(
      (await params).id,
      searchOf(request).get("view"),
      body.row,
    );
  },
  { write: true },
);
