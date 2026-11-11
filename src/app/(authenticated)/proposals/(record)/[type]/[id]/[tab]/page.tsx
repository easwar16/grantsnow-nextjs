import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import {
  proposalDynamicFormEditable,
  proposalPage,
} from "@/server/modules/proposals/record";
import { ProposalDynamicForm } from "@/features/modules/proposals/record/proposal-dynamic-form";
import { State } from "@/components/feedback/state";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";

export default async function ProposalDynamicFormPage({
  params,
}: {
  params: Promise<{ type: string; id: string; tab: string }>;
}) {
  const paramsValue = await params;
  const identity = recordIdentity.safeParse(paramsValue);
  if (!identity.success || !/^dynamic-form-[1-5]$/.test(paramsValue.tab))
    return <State title="Invalid proposal page" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/${paramsValue.tab}`);
  const page = `proposals-${paramsValue.tab}`;
  let context: Awaited<ReturnType<typeof proposalPage>> | null = null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    context = await proposalPage(type, id, page);
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (!context || failure)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal page unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  return (
    <ProposalDynamicForm
      type={type}
      id={id}
      reference={context.summary.reference}
      page={page}
      editable={proposalDynamicFormEditable(context, page)}
      submitLabel={serverFunctions.resources.label(
        await resources(),
        context.bundle,
        "button-labels",
        "submit",
        "Submit",
      )}
    />
  );
}
