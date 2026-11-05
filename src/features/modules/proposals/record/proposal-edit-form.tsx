"use client";
import { ActionDialog } from "@/components/dialog/action-dialog";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { proposals } from "@/lib/api";
import { Select, type SelectOption } from "@/components/ui/select";
import styles from "./proposal-record.module.css";
import { Icon } from "@/components/ui/icon";
import { useConfirm } from "@/components/dialog/action-dialog";
import { useToast } from "@/components/feedback/toast";
import {
  ObjectAttributes,
  type AttributesHandle,
} from "@/features/record/attributes/object-attributes";
import type { AttributeValues } from "@/features/record/attributes/model";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";

const EditContext = createContext<{
  pending: boolean;
  setPending: (value: boolean) => void;
  error: string;
  setError: (value: string) => void;
  attributesRef: React.RefObject<AttributesHandle | null>;
  formRef: React.RefObject<DynamicFormHandle | null>;
  formReady: boolean;
  setFormReady: (value: boolean) => void;
  validation: { id: string; message: string } | null;
  setValidation: (value: { id: string; message: string } | null) => void;
} | null>(null);

export function ProposalEditProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const attributesRef = useRef<AttributesHandle | null>(null);
  const formRef = useRef<DynamicFormHandle | null>(null);
  const [formReady, setFormReady] = useState(false);
  const [validation, setValidation] = useState<{
    id: string;
    message: string;
  } | null>(null);
  return (
    <EditContext.Provider
      value={{
        pending,
        setPending,
        error,
        setError,
        attributesRef,
        formRef,
        formReady,
        setFormReady,
        validation,
        setValidation,
      }}
    >
      {children}
    </EditContext.Provider>
  );
}

export function ProposalFieldValidation({ id }: { id: string }) {
  const { validation } = useEdit();
  return validation?.id === id ? (
    <span className={styles.fieldValidation} role="alert">
      {validation.message}
    </span>
  ) : null;
}

function useEdit() {
  const context = useContext(EditContext);
  if (!context) throw new Error("Proposal edit provider is unavailable.");
  return context;
}

export function ProposalCreateToolbar({
  type,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL";
}) {
  const { pending, error, formReady } = useEdit();
  const title =
    type === "PROPOSAL" ? "Create New Proposal" : "Create New Outline Proposal";
  return (
    <div
      id="proposal-new-toolbar"
      className={`${styles.actionGroup} ${styles.createToolbar}`}
    >
      <Link href="/proposals" prefetch={false} className={styles.actionButton}>
        <Icon name="arrow-left" /> Back
      </Link>
      <h1>{title}</h1>
      <button
        id="proposal-new-create"
        type="submit"
        form="proposal-new-edit-form"
        disabled={pending || !formReady}
        className={styles.actionButton}
      >
        <Icon name="plus" /> {pending ? "Creating…" : title}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

export function ProposalCreateFooter({ label }: { label: string }) {
  const { pending, formReady } = useEdit();
  return (
    <div className={styles.createFooter}>
      <button
        id="proposal-new-create-bottom"
        type="submit"
        form="proposal-new-edit-form"
        disabled={pending || !formReady}
        className={styles.createFooterButton}
      >
        <Icon name="plus" /> {pending ? "Creating…" : label}
      </button>
    </div>
  );
}

export function ProposalEditToolbar({
  type,
  id,
  editAction,
  editChildren,
  children,
}: {
  type: string;
  id: string;
  editAction: ReactNode;
  editChildren: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const { pending, error, formReady } = useEdit();
  const base = `/proposals/${type}/${id}`;
  if (path === base && params.get("mode") === "edit")
    return (
      <div className={styles.actionGroup}>
        <button
          id={`proposal-${id}-save`}
          type="submit"
          form={`proposal-${id}-edit-form`}
          disabled={pending || !formReady}
          className={styles.actionButton}
        >
          <Icon name="save" /> {pending ? "Saving…" : "Save"}
        </button>
        <Link
          id={`proposal-${id}-cancel-edit`}
          href={base}
          prefetch={false}
          className={styles.actionButton}
        >
          <Icon name="close-circle" /> Cancel
        </Link>
        {editChildren}
        {error && (
          <span id={`proposal-${id}-edit-error`} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  return (
    <div className={styles.actionGroup}>
      {path === base && editAction}
      {children}
    </div>
  );
}

export function ProposalSummaryDynamicForm({
  type,
  id,
  number,
  editable,
  creating = false,
}: {
  type: string;
  id: string;
  number: string;
  editable: boolean;
  creating?: boolean;
}) {
  const { formRef, setFormReady } = useEdit();
  return (
    <DynamicForm
      ref={formRef}
      objectType={type}
      slot="PROPOSALS-SUMMARY"
      parentId={creating ? undefined : id}
      objectId={creating ? undefined : id}
      objectNumber={number}
      editable={editable}
      onReadyChange={setFormReady}
    />
  );
}

type EditBody = Parameters<typeof proposals.saveSummaryEdit>[2];
export function ProposalEditForm({
  type,
  id,
  initial,
  creation,
}: {
  type: string;
  id: string;
  initial: {
    startDate: string;
    endDate: string;
    costModel: string;
    primarySponsorId: number | null;
  };
  creation?: {
    piPersonId: number;
    sourceRequestId?: number;
    successMessage: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const {
    pending,
    setPending,
    setError,
    attributesRef,
    formRef,
    formReady,
    setValidation,
  } = useEdit();
  const [versionRequest, setVersionRequest] = useState<EditBody | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState(false);
  const [description, setDescription] = useState("");
  const [retainCosting, setRetainCosting] = useState<"RETAIN" | "NO_RETAIN">(
    "RETAIN",
  );
  const confirmSponsorChange = useConfirm(
    `proposal-${id}-primary-change-dialog`,
  );
  const base = `/proposals/${type}/${id}`;
  async function send(body: EditBody) {
    setPending(true);
    setError("");
    const result = await proposals.saveSummaryEdit(type, id, body);
    if (result.ok) {
      if (
        !formRef.current ||
        (formRef.current.hasChanges() && !(await formRef.current.save()))
      ) {
        setError(
          "Proposal details saved. Dynamic form answers need to be saved again.",
        );
      } else {
        router.replace(base);
        router.refresh();
      }
    } else setError(result.error.message);
    setPending(false);
    setVersionRequest(null);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (
      !creation &&
      (!formReady || !formRef.current || !formRef.current.check())
    ) {
      setError("Complete the dynamic form before saving.");
      return;
    }
    if (!creation && attributesRef.current && !attributesRef.current.check()) {
      setError("Complete the required attributes before saving.");
      return;
    }
    const data = new FormData(event.currentTarget);
    let sponsors:
      | {
          relationId: number | null;
          partyId: number;
          roleCode: string;
          priority: number;
        }[]
      | undefined;
    let deadlines: EditBody["deadlines"];
    let collaborators: EditBody["collaborators"];
    let subprojects: EditBody["subprojects"];
    try {
      const value = data.get("sponsors");
      sponsors = typeof value === "string" ? JSON.parse(value) : undefined;
      const deadlineValue = data.get("deadlines");
      deadlines =
        typeof deadlineValue === "string"
          ? JSON.parse(deadlineValue)
          : undefined;
      const collaboratorValue = data.get("collaborators");
      collaborators =
        typeof collaboratorValue === "string"
          ? JSON.parse(collaboratorValue)
          : undefined;
      const subprojectValue = data.get("subprojects");
      subprojects =
        typeof subprojectValue === "string"
          ? JSON.parse(subprojectValue)
          : undefined;
    } catch {
      setError("Proposal table changes could not be read.");
      return;
    }
    const body: EditBody = {
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      tags: String(data.get("tags") ?? ""),
      opportunityTitle: String(data.get("opportunityTitle") ?? ""),
      opportunityUrl: String(data.get("opportunityUrl") ?? ""),
      activityType: String(data.get("activityType") ?? ""),
      proposalStage: String(data.get("proposalStage") ?? ""),
      proposalType: String(data.get("proposalType") ?? ""),
      category: String(data.get("category") ?? ""),
      confidential: String(data.get("confidential") ?? "N"),
      assignedTo: data.get("assignedTo")
        ? Number(data.get("assignedTo"))
        : null,
      piPersonId: data.get("piPersonId")
        ? Number(data.get("piPersonId"))
        : undefined,
      startDate: String(data.get("startDate") ?? initial.startDate),
      endDate: String(data.get("endDate") ?? initial.endDate),
      costModel: Number(data.get("costModel") ?? initial.costModel),
      sponsors,
      deadlines,
      collaborators,
      subprojects,
      collaboratorFlag: data.get("collaboratorFlag") === "Y" ? "Y" : "N",
      subprojectFlag: data.get("subprojectFlag") === "Y" ? "Y" : "N",
      attributes: attributesRef.current?.values() ?? undefined,
    };
    if (creation) {
      setValidation(null);
      const invalid = (id: string, message: string) => {
        setValidation({ id, message });
        requestAnimationFrame(() => {
          const field = document.getElementById(id);
          field?.scrollIntoView({ block: "center", behavior: "smooth" });
          field?.focus();
        });
      };
      const sponsorRows = body.sponsors ?? [];
      const primaryCount = sponsorRows.filter(
        (row) => row.roleCode === "PRM",
      ).length;
      if (type === "PROPOSAL" && primaryCount !== 1) {
        invalid(
          "proposal-new-add-sponsor-trigger",
          primaryCount === 0
            ? "Primary sponsor must be selected"
            : "Proposal can have only one primary sponsor",
        );
        return;
      }
      if (
        sponsorRows.filter((row) => row.roleCode.startsWith("BIL")).length > 1
      ) {
        invalid(
          "proposal-new-add-sponsor-trigger",
          "Proposal can have only one billing party sponsor",
        );
        return;
      }
      if (body.collaboratorFlag === "Y" && !body.collaborators?.length) {
        invalid(
          "proposal-new-add-collaborator-trigger",
          "You need to add at least one collaborator or opt 'No'",
        );
        return;
      }
      if (body.subprojectFlag === "Y" && !body.subprojects?.length) {
        invalid(
          "proposal-new-add-subproject-trigger",
          "You need to add at least one sub-project or opt 'No'",
        );
        return;
      }
      const required: [boolean, string, string][] = [
        [
          !body.title.trim(),
          "proposal-new-edit-full-project-title",
          "Full Project Title is required",
        ],
        [
          !body.activityType,
          "proposal-new-edit-activity-type-trigger",
          "Activity type is required",
        ],
        [
          !body.proposalStage,
          "proposal-new-edit-proposal-stage-trigger",
          "Proposal Stages is required",
        ],
        [
          !body.proposalType,
          "proposal-new-edit-proposal-type-trigger",
          "Proposal type is required",
        ],
        [
          !body.category,
          "proposal-new-edit-proposal-category-trigger",
          "Proposal Category is required",
        ],
        [
          !body.startDate,
          "proposal-new-edit-start-date",
          "Start date is required",
        ],
        [!body.endDate, "proposal-new-edit-end-date", "End date is required"],
        [
          body.startDate > body.endDate,
          "proposal-new-edit-end-date",
          "End date must follow Start date",
        ],
        [
          !body.costModel,
          "proposal-new-edit-cost-model-trigger",
          "Cost model is required",
        ],
        [
          body.assignedTo === null,
          "proposal-new-edit-assigned-to-trigger",
          "Assigned To is required",
        ],
        [
          !body.opportunityTitle.trim(),
          "proposal-new-edit-opportunity-title",
          "Opportunity Title is required",
        ],
        [
          !body.opportunityUrl.trim(),
          "proposal-new-edit-opportunity-url",
          "Opportunity URL is required",
        ],
      ];
      const first = required.find(([fails]) => fails);
      if (first) {
        invalid(first[1], first[2]);
        return;
      }
      if (!formReady || !formRef.current || !formRef.current.check(true)) {
        return;
      }
      if (attributesRef.current && !attributesRef.current.check()) {
        requestAnimationFrame(() => {
          const field = document.querySelector<HTMLElement>(
            "#proposal-new-attributes [aria-invalid='true']",
          );
          field?.scrollIntoView({ block: "center", behavior: "smooth" });
          field?.focus();
        });
        return;
      }
      setPending(true);
      setError("");
      if (createdId) {
        if (
          formRef.current &&
          (!formRef.current.hasChanges() ||
            (await formRef.current.save(createdId)))
        ) {
          toast.show("success", "Success", creation.successMessage, false);
          router.replace(`/proposals/${type}/${createdId}`);
          router.refresh();
        } else
          setError(
            "Dynamic form answers could not be saved. Try again from this page.",
          );
        setPending(false);
        return;
      }
      const result = await proposals.create({
        type: type as "PROPOSAL" | "OUTLINE_PROPOSAL",
        title: body.title,
        description: body.description,
        piPersonId: body.piPersonId ?? creation.piPersonId,
        activityType: body.activityType,
        proposalStage: body.proposalStage,
        proposalType: body.proposalType,
        category: body.category,
        startDate: body.startDate,
        endDate: body.endDate,
        costModel: body.costModel,
        confidential: body.confidential === "Y" ? "Y" : "N",
        sponsors: (body.sponsors ?? []).map((row) => ({
          ...row,
          relationId: null,
        })),
        deadlines: (body.deadlines ?? []).map((row) => ({ ...row, id: null })),
        tags: body.tags,
        assignedTo: body.assignedTo,
        opportunityTitle: body.opportunityTitle,
        opportunityUrl: body.opportunityUrl,
        collaboratorFlag: body.collaboratorFlag,
        collaborators: body.collaborators,
        subprojectFlag: body.subprojectFlag,
        subprojects: body.subprojects,
        attributes: body.attributes,
        sourceRequestId: creation.sourceRequestId,
      });
      if (result.ok) {
        const createdId = String(result.data.id);
        setCreatedId(createdId);
        if (
          !formRef.current ||
          (formRef.current.hasChanges() &&
            !(await formRef.current.save(createdId)))
        ) {
          setError(
            "Proposal created. Dynamic form answers need to be saved again.",
          );
        } else {
          toast.show("success", "Success", creation.successMessage, false);
          router.replace(`/proposals/${type}/${createdId}`);
          router.refresh();
        }
      } else {
        toast.error(result.error);
      }
      setPending(false);
      return;
    }
    const primary = sponsors?.find((row) => row.roleCode === "PRM");
    if (
      primary &&
      initial.primarySponsorId !== null &&
      primary.partyId !== initial.primarySponsorId &&
      !(await confirmSponsorChange.ask({
        title: "Primary Funder Changed",
        message:
          "You have changed the primary funder which will affect the pricing. Do you want to continue?",
        confirm: "Yes",
        cancel: "Cancel",
      }))
    )
      return;
    if (
      body.startDate !== initial.startDate ||
      body.endDate !== initial.endDate ||
      String(body.costModel) !== initial.costModel
    ) {
      setVersionRequest(body);
      return;
    }
    await send(body);
  }
  return (
    <>
      <form id={`proposal-${id}-edit-form`} onSubmit={save} />
      {confirmSponsorChange.element}
      {versionRequest && (
        <ActionDialog
          id={`proposal-${id}-version-dialog`}
          title="Proposal versioning"
          busy={pending}
          onClose={() => setVersionRequest(null)}
        >
          <div className={styles.editBody}>
            <p>
              Editing the Proposal period or cost model may affect Budget lines.
            </p>
            <fieldset id={`proposal-${id}-version-new`}>
              <legend>Create a new Budget version?</legend>
              <label>
                <input
                  id={`proposal-${id}-version-new-yes`}
                  type="radio"
                  checked={newVersion}
                  onChange={() => setNewVersion(true)}
                />{" "}
                Yes
              </label>
              <label>
                <input
                  id={`proposal-${id}-version-new-no`}
                  type="radio"
                  checked={!newVersion}
                  onChange={() => setNewVersion(false)}
                />{" "}
                No
              </label>
            </fieldset>
            {newVersion && (
              <>
                <label htmlFor={`proposal-${id}-version-description`}>
                  Version description
                </label>
                <textarea
                  id={`proposal-${id}-version-description`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                />
                <fieldset id={`proposal-${id}-version-retain`}>
                  <legend>Retain costing</legend>
                  <label>
                    <input
                      id={`proposal-${id}-version-retain-yes`}
                      type="radio"
                      checked={retainCosting === "RETAIN"}
                      onChange={() => setRetainCosting("RETAIN")}
                    />{" "}
                    Retain
                  </label>
                  <label>
                    <input
                      id={`proposal-${id}-version-retain-no`}
                      type="radio"
                      checked={retainCosting === "NO_RETAIN"}
                      onChange={() => setRetainCosting("NO_RETAIN")}
                    />{" "}
                    Do not retain
                  </label>
                </fieldset>
              </>
            )}
            <div className={styles.editDialogActions}>
              <button
                id={`proposal-${id}-version-cancel`}
                type="button"
                className={styles.actionButton}
                disabled={pending}
                onClick={() => setVersionRequest(null)}
              >
                Cancel
              </button>
              <button
                id={`proposal-${id}-version-confirm`}
                type="button"
                className={styles.actionButton}
                disabled={pending}
                onClick={() =>
                  send({
                    ...versionRequest,
                    version: {
                      newVersion,
                      description: newVersion ? description : "",
                      retainCosting: newVersion ? retainCosting : null,
                    },
                  })
                }
              >
                Save
              </button>
            </div>
          </div>
        </ActionDialog>
      )}
    </>
  );
}

export function ProposalEditAttributes({
  id,
  initial,
  creating = false,
}: {
  id: string;
  initial: AttributeValues;
  creating?: boolean;
}) {
  const { attributesRef } = useEdit();
  return (
    <ObjectAttributes
      id={`proposal-${id}-attributes`}
      host="proposals-summary"
      objectId={creating ? undefined : id}
      editable
      initial={initial}
      plain={creating}
      outsideLabels={creating}
      ref={attributesRef}
    />
  );
}

export function ProposalEditSelect({
  id,
  label,
  name,
  value,
  options,
  formId,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  options: SelectOption[];
  formId: string;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <>
      <Select
        id={id}
        label={label}
        options={options}
        value={selected}
        onChange={setSelected}
      />
      <input
        type="hidden"
        form={formId}
        name={name}
        value={selected}
        readOnly
      />
    </>
  );
}

export function ProposalEditRadio({
  id,
  label,
  name,
  value,
  formId,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  formId: string;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <fieldset id={id} className={styles.editRadio} aria-label={label}>
      <label>
        <input
          id={`${id}-yes`}
          type="radio"
          name={`${name}-choice`}
          checked={selected === "Y"}
          onChange={() => setSelected("Y")}
        />{" "}
        Yes
      </label>
      <label>
        <input
          id={`${id}-no`}
          type="radio"
          name={`${name}-choice`}
          checked={selected === "N"}
          onChange={() => setSelected("N")}
        />{" "}
        No
      </label>
      <input
        type="hidden"
        form={formId}
        name={name}
        value={selected}
        readOnly
      />
    </fieldset>
  );
}
