import type { ReactNode } from "react";
import { functions } from "@/lib/functions";
import type { FormatSettings } from "@/lib/format";
import type { SelectOption } from "@/components/ui/select";
import { ObjectAttributes } from "@/features/record/attributes/object-attributes";
import type {
  ProposalSummary,
  RecordIdentity,
  SummaryField,
} from "@/features/modules/proposals/record";
import type {
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
  ProposalFieldValidation,
} from "./proposal-edit-form";
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
import {
  CollaboratorsTable,
  DeadlinesTable,
  SponsorsTable,
  SubproposalsTable,
} from "./summary-tables";
import styles from "./proposal-record.module.css";

/** The Summary tab (legacy proposals-summary): read-only, or the edit form when the page reads it in edit mode. */
export function Summary({
  type,
  recordId,
  summary,
  editValues,
  sponsorChoices,
  editChoices,
  format,
  creation,
}: {
  type: RecordIdentity["type"];
  recordId: string;
  summary: ProposalSummary;
  editValues: Awaited<ReturnType<typeof proposalEditValues>> | null;
  sponsorChoices: Awaited<ReturnType<typeof proposalSponsorChoices>> | null;
  editChoices: Awaited<ReturnType<typeof proposalEditChoices>> | null;
  format?: FormatSettings;
  creation?: {
    piPersonId: number;
    sourceRequestId?: number;
    successMessage: string;
  };
}): ReactNode {
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
          <strong>
            {field.label}
            {creation &&
              [
                "full-project-title",
                "activity-type",
                "proposal-stage",
                "proposal-type",
                "proposal-category",
                "start-date",
                "duration-months",
                "end-date",
                "cost-model",
                "confidential",
                "assigned-to",
                "opportunity-title",
                "opportunity-url",
              ].includes(field.key) && (
                <span className={styles.requiredMark}> *</span>
              )}
          </strong>
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
                  required={!creation && field.key === "full-project-title"}
                />
              )
            ) : field.kind === "date" ? (
              functions.format.dateDisplay(field.value, format)
            ) : (
              field.value
            )}
          </div>
          {creation && (
            <ProposalFieldValidation
              id={`proposal-new-edit-${field.key}${choiceFields[field.key] ? "-trigger" : ""}`}
            />
          )}
        </div>
      ))}
    </div>
  );
  return (
    <section
      id={`${id}-summary`}
      className={`${styles.summaryPage}${creation ? ` ${styles.createSummaryPage}` : ""}`}
    >
      {editValues && (
        <ProposalEditForm
          type={type}
          id={recordId}
          initial={{
            startDate: editValues.startDate,
            endDate: editValues.endDate,
            costModel: editValues.costModel,
            primarySponsorId:
              editValues.sponsors.find((sponsor) => sponsor.roleCode === "PRM")
                ?.partyId ?? null,
          }}
          creation={creation}
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
                  creating={Boolean(creation)}
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
                <SponsorsTable
                  id={id}
                  rows={summary.sponsors}
                  labels={summary.labels}
                />
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
                  <DeadlinesTable
                    id={id}
                    rows={summary.deadlines}
                    noData={summary.labels.noData}
                    format={format}
                  />
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
                  <CollaboratorsTable id={id} rows={summary.collaborators} />
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
                  <SubproposalsTable id={id} rows={summary.subproposals} />
                )}
              </>
            )}
          </section>
        )}
      <div className={styles.form}>
        <ProposalSummaryDynamicForm
          type={type}
          id={summary.id}
          number={summary.reference}
          editable={Boolean(editValues)}
          creating={Boolean(creation)}
        />
      </div>
    </section>
  );
}
