import type { ProposalSummary, RecordIdentity, SummaryField } from "@/features/modules/proposals/record";
import type { proposalCreateChoices } from "@/server/modules/proposals/create";
import type { proposalEditChoices, proposalEditValues, proposalSponsorChoices } from "@/server/modules/proposals/edit";
import { Summary } from "./summary";
import { ProposalEditProvider, ProposalCreateToolbar, ProposalCreateFooter } from "./proposal-edit-form";

type Choices = Awaited<ReturnType<typeof proposalCreateChoices>>;
const field = (key: string, label: string, value = ""): SummaryField => ({ key, label, value, kind: "text" });

/** Creation uses the same Summary sections and editors as an existing Proposal. */
export function CreateProposalSummary({
  type,
  choices,
  sourceRequestId,
  aoi,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL";
  choices: Choices;
  sourceRequestId?: number;
  aoi?: { title: string; description: string; activityType: string; sponsorId: number | null } | null;
}) {
  const pi = choices.pi.find((row) => row.value === choices.currentPersonId);
  const piPersonId = Number(choices.currentPersonId);
  const sponsors = aoi?.sponsorId ? [{ relationId: null, partyId: aoi.sponsorId, name: choices.sponsors.find((row) => Number(row.value) === aoi.sponsorId)?.label ?? "", funderType: "", roleCode: "PRM", priority: 1 }] : [];
  const editValues = {
    title: aoi?.title ?? "", description: aoi?.description ?? "", tags: "",
    opportunityTitle: "", opportunityUrl: "", activityType: aoi?.activityType ?? "",
    proposalStage: "", proposalType: "", category: "", startDate: "", endDate: "",
    costModel: "", deadlines: [], confidential: "N", assignedTo: "",
    sponsors, collaborators: [], subprojects: [], canDeleteSponsors: true,
    piPersonId, canChangePi: choices.canChangePi,
  } satisfies Awaited<ReturnType<typeof proposalEditValues>>;
  const editChoices = {
    activityTypes: choices.activityTypes, stages: choices.stages,
    proposalTypes: choices.proposalTypes, categories: choices.categories,
    costModels: choices.costModels, deadlineTypes: choices.deadlineTypes,
    subproposalTypes: choices.subproposalTypes,
    collaboratorRoles: choices.collaboratorRoles,
    collaborators: choices.collaborators,
    subprojectPeople: choices.subprojectPeople,
    assignees: choices.assignees,
    piCandidates: choices.pi.map((row) => ({ personId: Number(row.value), employeeNumber: row.employeeNumber, name: row.label, orgUnitId: row.orgUnitId, orgUnitName: row.orgUnitName })),
  } satisfies Awaited<ReturnType<typeof proposalEditChoices>>;
  const sponsorChoices = { sponsors: choices.sponsors, types: choices.sponsorTypes, roles: choices.sponsorRoles } satisfies Awaited<ReturnType<typeof proposalSponsorChoices>>;
  const summary: ProposalSummary = {
    id: "new", type, reference: "", title: "", status: "", statusCode: "",
    budgetVersionId: null, creatorId: piPersonId, lockedPageIds: [],
    detailColumns: [], fields: [],
    piFields: [field("full-name", "Full Name", pi?.label), field("employee-number", "Employee number", pi?.employeeNumber), field("org-unit", "Org Unit", pi?.orgUnitName)],
    proposalFields: [
      field("full-project-title", "Full Project Title"), field("project-description", "Project description"),
      field("activity-type", "Activity type"), field("proposal-stage", "Proposal Stages"),
      field("proposal-type", "Proposal type"), field("proposal-category", "Proposal Category"),
      field("start-date", "Start date"), field("duration-months", "Months(Duration)"),
      field("end-date", "End date"), field("cost-model", "Cost model"),
      field("keywords", "Keywords"), field("confidential", "Confidential"),
      field("assigned-to", "Assigned To"),
    ],
    opportunityFields: [field("opportunity-title", "Opportunity Title"), field("opportunity-url", "Opportunity URL")],
    collaboratorAnswer: "No", subproposalAnswer: "No", collaborators: [], subproposals: [],
    attributes: {}, sponsors: [], investigators: [], deadlines: [],
    labels: {
      sponsors: "Funder details", investigators: "", deadlines: "Deadline date", noData: "No data to display.",
      piDetails: "Principal Investigator Details", proposalDetails: "Proposal Details", opportunityDetails: "Opportunity Details",
      collaboratorDetails: "Research partner details", subproposalDetails: "Sub-proposal details",
      collaboratorQuestion: "Will this proposal have research partners?",
      subproposalQuestion: "Will you be working with other internal departments as subprojects?",
      funderTypeVisible: true, funder: "Funder", funderType: "Funder Type", funderRole: "Funder Role", priority: "Priority",
    },
  };
  return (
    <ProposalEditProvider>
      <ProposalCreateToolbar type={type} />
      <Summary type={type as RecordIdentity["type"]} recordId="new" summary={summary} editValues={editValues} editChoices={editChoices} sponsorChoices={sponsorChoices} creation={{ piPersonId, sourceRequestId, successMessage: choices.successMessage }} />
      <ProposalCreateFooter label={choices.createButtonLabel} />
    </ProposalEditProvider>
  );
}
