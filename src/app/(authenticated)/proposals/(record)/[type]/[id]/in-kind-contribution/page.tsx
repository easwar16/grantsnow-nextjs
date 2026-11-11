import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalInKind } from "@/server/modules/proposals/record/in-kind";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { State } from "@/components/feedback/state";
import { InKindContribution } from "@/features/modules/proposals/record/in-kind-contribution";

export const metadata = { title: "In-kind Contribution" };

export default async function InKindPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/in-kind-contribution`);
  let data: Awaited<ReturnType<typeof proposalInKind>>;
  try {
    data = await proposalInKind(type, id);
  } catch (cause) {
    const failure = functions.errors.publicError(cause);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "In-kind Contribution unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  const label = (section: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rb, data.bundle, section, key, fallback);
  return (
    <InKindContribution
      type={type}
      id={id}
      sponsors={data.sponsors}
      lines={data.lines}
      costItems={data.costItems}
      types={data.types}
      canEdit={data.canEdit}
      canDelete={data.canDelete}
      format={format}
      labels={{
        save: label("button-labels", "save", "Save"),
        cancel: label("button-labels", "cancel", "Cancel"),
        edit: label("button-labels", "edit", "Edit"),
        add: label("button-labels", "add-contribution", "Add Contribution"),
        amount: label("table-headers", "inkind-amount", "In-kind Amount"),
        item: label("table-headers", "name", "Name"),
        type: label("table-headers", "type-of-inkind", "Type of In-kind"),
        description: label("table-headers", "description", "Description"),
      }}
      visible={{
        item: serverFunctions.resources.resourceVisible(
          rb,
          data.bundle,
          "table-headers",
          "name",
        ),
        type: serverFunctions.resources.resourceVisible(
          rb,
          data.bundle,
          "table-headers",
          "type-of-inkind",
        ),
        description: serverFunctions.resources.resourceVisible(
          rb,
          data.bundle,
          "table-headers",
          "description",
        ),
      }}
    />
  );
}
