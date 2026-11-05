import { route } from "@/server/http/route";
import {
  assuranceView,
  saveAssurance,
} from "@/server/modules/claims/units/record/assurance";

type Context = { params: Promise<{ id: string }> };
/** The Assurance sign-off tab: its requirement and whether the summary is editable. */
export const GET = route<Context>(async (_request, { params }) =>
  assuranceView((await params).id),
);
/** WRITES: saves (or creates) the requirement the form's answers are stored against; its id. */
export const POST = route<Context>(
  async (_request, { params }) => saveAssurance((await params).id),
  { write: true },
);
