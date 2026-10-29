import "server-only";
import { z } from "zod";
import { dynamicForm } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { oicConnected } from "@/server/oic/connection";
import { AppError } from "@/lib/errors";
import type {
  DynamicFormData,
  DynamicFormText,
} from "@/features/record/dynamic-form/models";
import { authorizeForm, formTarget, type FormTarget } from "./access";
import { checkAnswers, mapAnswers, mapForms } from "./forms";
import { formGlobals } from "./globals";
import { serverFunctions } from "@/server/functions";

/** The fragment's translationsModule defaults to the object type: AWARD reads the award bundle, EOI its own. */
const bundleOf = (t: FormTarget) =>
  t.objectType === "AWARD"
    ? "award"
    : t.objectType === "CONTRACT"
      ? "contract"
      : "opportunities-eoi";
const TEXTS: Record<DynamicFormText, [string, string, string]> = {
  noData: ["helper-texts", "no-data", "No data to display."],
  dragAndDrop: ["labels", "drag-and-drop", "Drag and drop, or select a file"],
  noFile: ["labels", "no-file", "No file"],
  download: ["button-labels", "download", "Download"],
  delete: ["button-labels", "delete", "Delete"],
  insertRow: ["button-labels", "insert-row", "Insert Row"],
  edit: ["button-labels", "edit", "Edit"],
  done: ["button-labels", "done", "Done"],
  cancel: ["button-labels", "cancel", "Cancel"],
  requiredFields: [
    "error-msg",
    "required-fields",
    "Please fill all the required fields",
  ],
  fileLarge: ["labels", "file-large", "File not accepted"],
  fileUnique: [
    "error-msg",
    "file-should-be-unique",
    "A file with this name is already attached",
  ],
  sourceCode: ["labels", "source-code", "Source code"],
  moreInfo: ["button-labels", "more_info", "More Info"],
  storageOff: [
    "labels",
    "file-storage-off",
    "File storage is not connected in this environment.",
  ],
};
async function formTexts(t: FormTarget) {
  const rows = await resources();
  return Object.fromEntries(
    Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
      k,
      serverFunctions.resources.label(rows, bundleOf(t), group, key, fallback),
    ]),
  ) as Record<DynamicFormText, string>;
}
/** dynForms for the target; `p_id` / `p_obj_id` are the record (empty for a new application), as the original sends. */
async function definitions(t: FormTarget, objectId: string) {
  return mapForms(
    await dynamicForm.forms({
      objectId,
      objectType: t.objectType,
      slot: t.slot,
    }),
  );
}
const hasSections = (forms: { sections: unknown[] }[]) =>
  forms.some((f) => f.sections.length > 0);
/** GET: the form and its answers as the allowlisted display model, with the settings the fields need. */
export async function loadForm(t: FormTarget): Promise<DynamicFormData> {
  // Settings and labels are not the record's; they load while access is checked.
  const settings = serverFunctions.async.early(formGlobals()),
    labels = serverFunctions.async.early(formTexts(t));
  await authorizeForm(t, "read");
  const objectId = t.objectId ?? "";
  const [forms, rawAnswers, globals, texts] = await Promise.all([
    definitions(t, objectId),
    t.objectId === undefined
      ? Promise.resolve([])
      : dynamicForm.answers({ objectId: t.objectId, slot: t.slot }),
    settings,
    labels,
  ]);
  return {
    forms,
    answers: mapAnswers(rawAnswers, forms),
    settings: {
      decimals: globals.decimals,
      maxMb: globals.maxMb,
      accept: globals.accept,
      storage: oicConnected() && globals.instance !== null,
    },
    texts,
  };
}
const saveInput = z
  .object({ target: formTarget, answers: z.unknown() })
  .strict();
/**
 * POST: WRITES the answers (`dynFormResponse`, P_FORM_ID = the first form's, P_TOKEN from the session), after checking
 * them against the form definition read here. A just-created draft has no sections of its own yet (backend finding,
 * GN-Opportunities 2026-10-14), so its definition falls back to the one a new application gets.
 */
export async function saveForm(raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
  const t = parsed.data.target;
  const { record } = await authorizeForm(t, "edit");
  if (record === null)
    throw new AppError("BAD_REQUEST", "Save the application first.", 400);
  let forms = await definitions(t, record.id);
  if (!hasSections(forms)) forms = await definitions(t, "");
  if (forms.length === 0)
    throw new AppError("BAD_REQUEST", "There is no form to save.", 400);
  const answers = checkAnswers(forms, parsed.data.answers);
  await dynamicForm.save({
    formId: forms[0].formId,
    objectId: record.id,
    slot: t.slot,
    body: answers,
  });
  return { saved: true };
}
