"use client";
import { useRef, useState } from "react";
import { functions } from "@/lib/functions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ethics, useApi } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useConfirm } from "@/components/dialog/action-dialog";
import { DynamicForm, type DynamicFormHandle } from "@/features/record/dynamic-form/dynamic-form";
import { ObjectAttributes, type AttributesHandle } from "@/features/record/attributes/object-attributes";
import { DateInput } from "@/components/ui/date-input";
import { ListSkeleton } from "@/components/feedback/skeleton";
import type { CreateEthics, CreateSetup } from "@/lib/api/endpoints/ethics";
import styles from "./new-ethics.module.css";

export function NewEthics({ setup, existing, parent }: {
  setup: CreateSetup;
  parent?: CreateEthics["parent"];
  existing?: { id: string; access: string; initial: CreateEthics; forceEdit: boolean };
}) {
  const router = useRouter();
  const answerForm = useRef<DynamicFormHandle>(null);
  const attributes = useRef<AttributesHandle>(null);
  const created = useRef<{ id: string; respondentId: string | null } | null>(null);
  const [value, setValue] = useState<CreateEthics>(existing?.initial ?? {
    title: "",
    org: "",
    formType: "",
    ethicsType: "",
    deadline: "",
    expiry: "",
    participants: [],
    supervisor: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scope = existing ? { id: existing.id, access: existing.access } : {};
  const form = useApi(ethics.createForm, value.formType ? { ...scope, formType: value.formType } : null);
  const participants = useApi(ethics.createPeople, value.org ? { ...scope, org: value.org } : null);
  const supervisors = useApi(ethics.createSupervisors, scope);
  const creatorConfirm = useConfirm("ethics-creator-warning");
  const set = (key: keyof CreateEthics, next: string) =>
    setValue((old) => ({ ...old, [key]: next }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.data?.sections.some((section) => section.enabled) || !attributes.current?.check()) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = existing?.forceEdit || submitter?.value === "submit" ? "submit" : "draft";
    if (action === "submit" && (!value.participants?.length || !value.supervisor)) {
      setError(!value.participants?.length
        ? "Select at least one participant before submitting."
        : "Select a supervisor before submitting.");
      return;
    }
    if (!existing && !(value.participants ?? []).some((key) => key.startsWith(`${setup.currentPersonId}:`))) {
      const confirmed = await creatorConfirm.ask({
        title: "Creator is not a participant",
        message: "You are not in the participant list and may lose access after saving.",
        confirm: action === "submit" ? "Submit anyway" : "Save anyway",
        cancel: "Cancel",
      });
      if (!confirmed) return;
    }
    const isParticipant = (value.participants ?? []).some((key) => key.startsWith(`${setup.currentPersonId}:`));
    if (!existing && setup.adminAnswer && isParticipant && !answerForm.current?.check()) return;
    setBusy(true);
    setError("");
    if (existing) {
      const result = await ethics.update({ ...value, attributes: attributes.current?.values() ?? undefined, action, id: existing.id, access: existing.access });
      if (!result.ok) { setError(result.error.message); setBusy(false); return; }
      router.push(`/ethics/${existing.id}?access=${existing.access}`);
      router.refresh();
      return;
    }
    if (!created.current) {
      const result = await ethics.create({ ...value, attributes: attributes.current?.values() ?? undefined, action, parent });
      if (!result.ok) { setError(result.error.message); setBusy(false); return; }
      created.current = result.data;
    }
    const saved = created.current;
    if (setup.adminAnswer && isParticipant) {
      if (!saved.respondentId) {
        setError("Application saved, but Oracle did not return your response record. Open the record to continue.");
        setBusy(false); return;
      }
      if (!(await answerForm.current?.save(saved.respondentId, saved.respondentId, saved.id))) {
        setError("Application saved. The response still needs to be saved.");
        setBusy(false); return;
      }
    }
    router.push(`/ethics/${saved.id}?access=EA_ACCESS`);
    router.refresh();
  }
  return (
    <main id="ethics-new" className={styles.page}>
      <div className={styles.toolbar}>
        <Link id="ethics-new-back" href={existing ? `/ethics/${existing.id}?access=${existing.access}` : parent ? `/proposals/${parent.proposalType}/${parent.id}/ethics` : "/ethics"}>
          {setup.labels.list}
        </Link>
      </div>
      <h1 id="ethics-new-title">{existing ? "Edit Ethics Application" : setup.labels.heading}</h1>
      <form id="ethics-new-form" onSubmit={save}>
        <section
          id="ethics-new-overview"
          className={styles.section}
          aria-labelledby="ethics-new-overview-title"
        >
          <h2 id="ethics-new-overview-title">{setup.labels.overview}</h2>
          <div className={styles.fields}>
            <div>
              <label htmlFor="ethics-new-project-title">
                {setup.labels.title} *
              </label>
              <textarea
                id="ethics-new-project-title"
                className="gn-control"
                required
                maxLength={400}
                value={value.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <Select
              id="ethics-new-org"
              label={setup.labels.org}
              required
              disabled={existing?.forceEdit}
              value={value.org}
              options={setup.orgs}
              onChange={(next) => setValue((old) => ({ ...old, org: next, participants: [] }))}
            />
            <div>
              <label htmlFor="ethics-new-expiry">{setup.labels.expiry}</label>
              <DateInput
                id="ethics-new-expiry"
                value={value.expiry ?? ""}
                onChange={(next) => set("expiry", next)}
              />
            </div>
            <div>
              <label htmlFor="ethics-new-deadline">
                {setup.labels.deadline}
              </label>
              <DateInput
                id="ethics-new-deadline"
                value={value.deadline ?? ""}
                onChange={(next) => set("deadline", next)}
              />
            </div>
            <Select
              id="ethics-new-form-type"
              label={setup.labels.formType}
              required
              disabled={existing?.forceEdit}
              value={value.formType}
              options={setup.formTypes}
              onChange={(next) => set("formType", next)}
            />
            <fieldset id="ethics-new-type">
              <legend>{setup.labels.type} *</legend>
              {setup.types.map((option) => (
                <label key={option.value}>
                  <input
                    id={`ethics-new-type-${functions.ids.idPart(option.value)}`}
                    type="radio"
                    name="ethicsType"
                    value={option.value}
                    checked={value.ethicsType === option.value}
                    onChange={() => set("ethicsType", option.value)}
                    required
                  />{" "}
                  {option.label}
                </label>
              ))}
            </fieldset>
          </div>
        </section>
        <ObjectAttributes id="ethics-setup-attributes" host="ethics-general-overview"
          objectId={existing?.id} editable initial={existing?.initial.attributes ?? {}} ref={attributes} />
        <section id="ethics-new-participants" className={styles.section}>
          <h2>{setup.labels.participants}</h2>
          <MultiSelect
            id="ethics-new-participant-picker"
            label={setup.labels.participants}
            variant="control"
            options={participants.data ?? []}
            value={value.participants ?? []}
            onChange={(next) => setValue((old) => ({ ...old, participants: next }))}
            disabled={!value.org || participants.loading}
          />
          {participants.error && <p role="alert">{participants.error.message}</p>}
          <Select
            id="ethics-new-supervisor"
            label={setup.labels.supervisor}
            value={value.supervisor ?? ""}
            options={supervisors.data ?? []}
            onChange={(next) => set("supervisor", next)}
            disabled={supervisors.loading}
          />
          {supervisors.error && <p role="alert">{supervisors.error.message}</p>}
        </section>
        {value.formType && (
          <section id="ethics-new-form-metadata" className={styles.section}>
            {form.loading ? (
              <ListSkeleton />
            ) : form.error ? (
              <p role="alert">{form.error.message}</p>
            ) : form.data ? (
              <p>
                {form.data.sections.filter((section) => section.enabled).length}{" "}
                form sections available
              </p>
            ) : null}
          </section>
        )}
        {!existing && setup.adminAnswer && value.formType && <section id="ethics-new-response" className={styles.section} aria-label="Response form">
          <DynamicForm ref={answerForm} objectType="ETHICS" slot="ETHICS"
            formType={value.formType} editable={(value.participants ?? []).some((key) => key.startsWith(`${setup.currentPersonId}:`))} />
        </section>}
        {error && (
          <p id="ethics-new-error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.toolbar}>
          {!existing?.forceEdit && <button
            id="ethics-new-save"
            type="submit"
            value="draft"
            disabled={
              busy || !form.data?.sections.some((section) => section.enabled)
            }
          >
            {setup.labels.save}
          </button>}
          <button id="ethics-new-submit" type="submit" value="submit" disabled={busy || !form.data?.sections.some((section) => section.enabled)}>
            {existing?.forceEdit ? "Save" : setup.labels.submit}
          </button>
          <Link id="ethics-new-cancel" href={existing ? `/ethics/${existing.id}?access=${existing.access}` : parent ? `/proposals/${parent.proposalType}/${parent.id}/ethics` : "/ethics"}>
            {setup.labels.cancel}
          </Link>
        </div>
      </form>
      {creatorConfirm.element}
    </main>
  );
}
