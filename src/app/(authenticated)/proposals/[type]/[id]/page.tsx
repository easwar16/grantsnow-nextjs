import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { proposalPage } from "@/server/modules/proposals/record";
import {
  recordIdentity,
  type SummaryField,
} from "@/features/modules/proposals/record";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { ObjectAttributes } from "@/features/record/attributes/object-attributes";
import { parseProposalMode } from "@/features/modules/proposals/schemas";
import {
  proposalEditValues,
  proposalSponsorChoices,
  proposalEditChoices,
} from "@/server/modules/proposals/edit";
import {
  ProposalEditForm,
  ProposalEditSelect,
  ProposalEditRadio,
  ProposalEditAttributes,
  ProposalSummaryDynamicForm,
} from "./proposal-edit-form";
import type { SelectOption } from "@/components/ui/select";
import { ProposalSponsorsEditor } from "./proposal-sponsors-editor";
import { ProposalPiEditor } from "./proposal-pi-editor";
import {
  ProposalEditPeriod,
  ProposalEditPeriodField,
} from "./proposal-edit-period";
import { ProposalDeadlinesEditor } from "./proposal-deadlines-editor";
import {
  ProposalCollaboratorsEditor,
  ProposalSubprojectsEditor,
} from "./proposal-partners-editor";
import { Icon } from "@/components/ui/icon";
import styles from "./proposal-record.module.css";

export const metadata = { title: "Proposal Summary" };

export default async function Summary({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  // Format loads beside the identity and summary, not before them.
  const formatRead = displayFormat();
  formatRead.catch(() => undefined);
  const input = recordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const mode = parseProposalMode((await searchParams).mode);
  if (!mode.success)
    return <State title="Invalid proposal mode" code="BAD_REQUEST" />;
  await pageIdentity(`/proposals/${input.data.type}/${input.data.id}`);
  let summary;
  let editValues: Awaited<ReturnType<typeof proposalEditValues>> | null = null;
  let sponsorChoices: Awaited<
    ReturnType<typeof proposalSponsorChoices>
  > | null = null;
  let editChoices: Awaited<ReturnType<typeof proposalEditChoices>> | null =
    null;
  try {
    summary = (
      await proposalPage(input.data.type, input.data.id, "proposals-summary")
    ).summary;
    if (mode.data === "edit")
      [editValues, sponsorChoices, editChoices] = await Promise.all([
        proposalEditValues(input.data.type, input.data.id),
        proposalSponsorChoices(input.data.type, input.data.id),
        proposalEditChoices(input.data.type, input.data.id),
      ]);
  } catch (e) {
    const error = functions.errors.publicError(e);
    return (
      <State
        title={
          error.code === "FORBIDDEN" ? "Access denied" : "Proposal unavailable"
        }
        message={error.message}
        action={error.action}
        code={error.code}
      />
    );
  }
  const format = await formatRead;
  const id = `proposal-${summary.id}`;
  const formId = `${id}-edit-form`;
  const choiceFields: Record<
    string,
    { name: string; value: string; options: SelectOption[] }
  > =
    editValues && editChoices
      ? {
          "activity-type": {
            name: "activityType",
            value: editValues.activityType,
            options: editChoices.activityTypes,
          },
          "proposal-stage": {
            name: "proposalStage",
            value: editValues.proposalStage,
            options: editChoices.stages,
          },
          "proposal-type": {
            name: "proposalType",
            value: editValues.proposalType,
            options: editChoices.proposalTypes,
          },
          "proposal-category": {
            name: "category",
            value: editValues.category,
            options: editChoices.categories,
          },
          "assigned-to": {
            name: "assignedTo",
            value: editValues.assignedTo,
            options: editChoices.assignees,
          },
          "cost-model": {
            name: "costModel",
            value: editValues.costModel,
            options: editChoices.costModels,
          },
        }
      : {};
  const editableFields: Record<
    string,
    {
      name: keyof NonNullable<typeof editValues>;
      value: string;
      multiline?: boolean;
    }
  > = editValues
    ? {
        "full-project-title": { name: "title", value: editValues.title },
        "project-description": {
          name: "description",
          value: editValues.description,
          multiline: true,
        },
        keywords: { name: "tags", value: editValues.tags },
        "opportunity-title": {
          name: "opportunityTitle",
          value: editValues.opportunityTitle,
        },
        "opportunity-url": {
          name: "opportunityUrl",
          value: editValues.opportunityUrl,
        },
      }
    : {};
  const fields = (items: SummaryField[]) => (
    <div className={styles.summaryFieldList}>
      {items.map((field) => (
        <div
          id={`${id}-summary-${field.key}`}
          key={field.key}
          className={
            field.key === "full-project-title" ||
            field.key === "project-description"
              ? styles.summaryWideField
              : undefined
          }
        >
          <strong>{field.label}</strong>
          <div>
            {editValues && field.key === "confidential" ? (
              <ProposalEditRadio
                id={`${id}-edit-confidential`}
                label={field.label}
                name="confidential"
                value={editValues.confidential}
                formId={formId}
              />
            ) : editValues &&
              (field.key === "start-date" ||
                field.key === "end-date" ||
                field.key === "duration-months") ? (
              <ProposalEditPeriodField
                id={`${id}-edit-${field.key}`}
                label={field.label}
                name={
                  field.key === "start-date"
                    ? "startDate"
                    : field.key === "end-date"
                      ? "endDate"
                      : "duration"
                }
                formId={formId}
              />
            ) : choiceFields[field.key as keyof typeof choiceFields] ? (
              <ProposalEditSelect
                id={`${id}-edit-${field.key}`}
                label={field.label}
                formId={formId}
                {...choiceFields[field.key as keyof typeof choiceFields]}
              />
            ) : editableFields[field.key] ? (
              editableFields[field.key].multiline ? (
                <textarea
                  id={`${id}-edit-${field.key}`}
                  aria-label={field.label}
                  form={formId}
                  name={editableFields[field.key].name}
                  defaultValue={editableFields[field.key].value}
                  maxLength={4000}
                />
              ) : (
                <input
                  id={`${id}-edit-${field.key}`}
                  aria-label={field.label}
                  form={formId}
                  name={editableFields[field.key].name}
                  defaultValue={editableFields[field.key].value}
                  maxLength={
                    field.key === "opportunity-url"
                      ? 2048
                      : field.key === "keywords"
                        ? 1000
                        : 500
                  }
                  required={field.key === "full-project-title"}
                />
              )
            ) : field.kind === "date" ? (
              functions.format.dateDisplay(field.value, format)
            ) : (
              field.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <section id={`${id}-summary`} className={styles.summaryPage}>
      {editValues && (
        <ProposalEditForm
          type={input.data.type}
          id={input.data.id}
          initial={{
            startDate: editValues.startDate,
            endDate: editValues.endDate,
            costModel: editValues.costModel,
            primarySponsorId:
              editValues.sponsors.find((sponsor) => sponsor.roleCode === "PRM")
                ?.partyId ?? null,
          }}
        />
      )}
      {summary.labels.piDetails && (
        <section id={`${id}-pi-details`} className={styles.summary}>
          <h2>{summary.labels.piDetails}</h2>
          {editValues?.canChangePi && editChoices ? (
            <ProposalPiEditor
              id={summary.id}
              fields={summary.piFields}
              initialPersonId={editValues.piPersonId}
              candidates={editChoices.piCandidates}
            />
          ) : (
            <div className={styles.piEditor}>
              <div className={styles.summaryPi}>{fields(summary.piFields)}</div>
              <span className={styles.summaryDisabledAction}>
                ♙ &nbsp; Change PI
              </span>
            </div>
          )}
        </section>
      )}
      <div className={styles.summaryColumns}>
        {summary.labels.proposalDetails && (
          <section id={`${id}-proposal-details`} className={styles.summary}>
            <h2>{summary.labels.proposalDetails}</h2>
            {editValues ? (
              <ProposalEditPeriod
                start={editValues.startDate}
                end={editValues.endDate}
              >
                {fields(summary.proposalFields)}
              </ProposalEditPeriod>
            ) : (
              fields(summary.proposalFields)
            )}
            {summary.type === "PROPOSAL" &&
              (editValues ? (
                <ProposalEditAttributes
                  id={summary.id}
                  initial={summary.attributes}
                />
              ) : (
                <ObjectAttributes
                  id={`${id}-attributes`}
                  host="proposals-summary"
                  objectId={summary.id}
                  editable={false}
                  displayOnly
                  plain
                  initial={summary.attributes}
                />
              ))}
          </section>
        )}
        <section id={`${id}-funding-and-deadlines`} className={styles.summary}>
          {summary.labels.sponsors && (
            <div id={`${id}-sponsors`}>
              <h2>{summary.labels.sponsors}</h2>
              {editValues && sponsorChoices ? (
                <ProposalSponsorsEditor
                  id={summary.id}
                  initial={editValues.sponsors}
                  sponsors={sponsorChoices.sponsors}
                  types={sponsorChoices.types}
                  roles={sponsorChoices.roles}
                  canDelete={editValues.canDeleteSponsors}
                  labels={{
                    funder: summary.labels.funder,
                    funderType: summary.labels.funderType,
                    funderRole: summary.labels.funderRole,
                    priority: summary.labels.priority,
                    noData: summary.labels.noData,
                    funderTypeVisible: summary.labels.funderTypeVisible,
                  }}
                />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{summary.labels.funder}</th>
                      {summary.labels.funderTypeVisible && (
                        <th scope="col">{summary.labels.funderType}</th>
                      )}
                      <th scope="col">{summary.labels.funderRole}</th>
                      <th scope="col">{summary.labels.priority}</th>
                      <th scope="col" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sponsors.length === 0 ? (
                      <tr>
                        <td
                          colSpan={summary.labels.funderTypeVisible ? 5 : 4}
                          className={styles.summaryEmpty}
                        >
                          {summary.labels.noData}
                        </td>
                      </tr>
                    ) : (
                      summary.sponsors.map((s) => (
                        <tr key={s.id} id={`${id}-sponsor-${s.id}`}>
                          <td>{s.name}</td>
                          {summary.labels.funderTypeVisible && (
                            <td>{s.funderType}</td>
                          )}
                          <td>{s.type}</td>
                          <td>{s.priority}</td>
                          <td className={styles.summaryRowActions}>
                            <button
                              type="button"
                              disabled
                              aria-label={`Edit ${s.name}`}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              type="button"
                              disabled
                              aria-label={`Delete ${s.name}`}
                            >
                              <Icon name="trash" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {summary.labels.deadlines && (
            <div id={`${id}-deadlines`} className={styles.summaryDeadline}>
              {editValues && editChoices ? (
                <ProposalDeadlinesEditor
                  id={summary.id}
                  initial={editValues.deadlines}
                  types={editChoices.deadlineTypes}
                  noData={summary.labels.noData}
                />
              ) : (
                <>
                  <h2>{summary.labels.deadlines}</h2>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Deadline type</th>
                        <th scope="col">Deadline Description</th>
                        <th scope="col">Deadline Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.deadlines.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={styles.summaryEmpty}>
                            {summary.labels.noData}
                          </td>
                        </tr>
                      ) : (
                        summary.deadlines.map((d) => (
                          <tr key={d.id} id={`${id}-deadline-${d.id}`}>
                            <td>{d.type}</td>
                            <td>{d.description}</td>
                            <td>
                              {functions.format.dateDisplay(d.date, format)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      {summary.labels.opportunityDetails &&
        summary.opportunityFields.length > 0 && (
          <section id={`${id}-opportunity-details`} className={styles.summary}>
            <h2>{summary.labels.opportunityDetails}</h2>
            <div className={styles.summaryOpportunity}>
              {fields(summary.opportunityFields)}
            </div>
          </section>
        )}
      {summary.labels.collaboratorDetails &&
        summary.collaboratorAnswer !== null && (
          <section id={`${id}-research-partners`} className={styles.summary}>
            <h2>{summary.labels.collaboratorDetails}</h2>
            {editValues && editChoices ? (
              <ProposalCollaboratorsEditor
                id={summary.id}
                question={summary.labels.collaboratorQuestion}
                initial={editValues.collaborators}
                candidates={editChoices.collaborators}
                roles={editChoices.collaboratorRoles}
                canDelete={editValues.canDeleteSponsors}
              />
            ) : (
              <>
                <strong>{summary.labels.collaboratorQuestion}</strong>
                <div>{summary.collaboratorAnswer}</div>
                {summary.collaborators.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Research Partner</th>
                        <th scope="col">Role</th>
                        <th scope="col">Description</th>
                        <th scope="col">Country Code</th>
                        <th scope="col">Vat Code</th>
                        <th scope="col">Cost Enabled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.collaborators.map((row) => (
                        <tr id={`${id}-collaborator-${row.id}`} key={row.id}>
                          <td>{row.name}</td>
                          <td>{row.role}</td>
                          <td>{row.description}</td>
                          <td>{row.countryCode}</td>
                          <td>{row.vatCode}</td>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${row.name} cost enabled`}
                              checked={row.costingEnabled}
                              readOnly
                              disabled
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        )}
      {summary.type !== "OUTLINE_PROPOSAL" &&
        summary.labels.subproposalDetails &&
        summary.subproposalAnswer !== null && (
          <section id={`${id}-subproposals`} className={styles.summary}>
            <h2>{summary.labels.subproposalDetails}</h2>
            {editValues && editChoices ? (
              <ProposalSubprojectsEditor
                id={summary.id}
                question={summary.labels.subproposalQuestion}
                initial={editValues.subprojects}
                candidates={editChoices.subprojectPeople}
                types={editChoices.subproposalTypes}
                canDelete={editValues.canDeleteSponsors}
                piPersonId={editValues.piPersonId}
              />
            ) : (
              <>
                <strong>{summary.labels.subproposalQuestion}</strong>
                <div>{summary.subproposalAnswer}</div>
                {summary.subproposals.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Type</th>
                        <th scope="col">Name</th>
                        <th scope="col">Org Unit</th>
                        <th scope="col">Role</th>
                        <th scope="col">Exclude Pricing</th>
                        <th scope="col">Proposal Number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.subproposals.map((row) => (
                        <tr id={`${id}-subproject-${row.id}`} key={row.id}>
                          <td>{row.type}</td>
                          <td>{row.name}</td>
                          <td>{row.orgUnit}</td>
                          <td>{row.role}</td>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${row.name} exclude pricing`}
                              checked={row.excludePricing}
                              readOnly
                              disabled
                            />
                          </td>
                          <td>{row.proposalNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        )}
      <div className={styles.form}>
        <ProposalSummaryDynamicForm
          type={input.data.type}
          id={summary.id}
          number={summary.reference}
          editable={Boolean(editValues)}
        />
      </div>
    </section>
  );
}
