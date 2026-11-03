"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dueDiligence, useApi } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { DateInput } from "@/components/ui/date-input";
import type {
  CreateDueDiligence,
  CreateSetup,
} from "@/lib/api/endpoints/due-diligence";
import styles from "@/features/modules/ethics/record.module.css";

export function NewDueDiligence({ setup }: { setup: CreateSetup }) {
  const router = useRouter();
  const [value, setValue] = useState<CreateDueDiligence>({
    title: "",
    org: "",
    formType: "",
    dueDiligenceType: "",
    deadline: "",
    expiry: "",
    participants: [],
    supervisor: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useApi(dueDiligence.createForm, value.formType || null);
  const participants = useApi(dueDiligence.createPeople, value.org || null);
  const supervisors = useApi(dueDiligence.createSupervisors, undefined);
  const set = (key: keyof CreateDueDiligence, next: string) =>
    setValue((old) => ({ ...old, [key]: next }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.data?.sections.some((section) => section.enabled)) return;
    setBusy(true);
    setError("");
    const result = await dueDiligence.create(value);
    if (result.ok)
      router.push(`/due-diligence/${result.data.id}?access=DDA_ACCESS`);
    else {
      setError(result.error.message);
      setBusy(false);
    }
  }
  return (
    <main id="due-diligence-new" className={styles.page}>
      <div className={styles.toolbar}>
        <Link id="due-diligence-new-back" href="/due-diligence">
          ← List
        </Link>
      </div>
      <h1 id="due-diligence-new-title">New Due Diligence application</h1>
      <form id="due-diligence-new-form" onSubmit={save}>
        <section
          id="due-diligence-new-overview"
          className={styles.section}
          aria-labelledby="due-diligence-new-overview-title"
        >
          <h2 id="due-diligence-new-overview-title">General Overview</h2>
          <div className={styles.fields}>
            <div>
              <label htmlFor="due-diligence-new-project-title">
                Project title *
              </label>
              <textarea
                id="due-diligence-new-project-title"
                className="gn-control"
                required
                maxLength={400}
                value={value.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <Select
              id="due-diligence-new-org"
              label="Org Unit"
              required
              value={value.org}
              options={setup.orgs}
              onChange={(next) =>
                setValue((old) => ({ ...old, org: next, participants: [] }))
              }
            />
            <div>
              <label htmlFor="due-diligence-new-expiry">Expiry Date</label>
              <DateInput
                id="due-diligence-new-expiry"
                value={value.expiry ?? ""}
                onChange={(next) => set("expiry", next)}
              />
            </div>
            <div>
              <label htmlFor="due-diligence-new-deadline">Deadline Date</label>
              <DateInput
                id="due-diligence-new-deadline"
                value={value.deadline ?? ""}
                onChange={(next) => set("deadline", next)}
              />
            </div>
            <Select
              id="due-diligence-new-form-type"
              label="Form Type"
              required
              value={value.formType}
              options={setup.formTypes}
              onChange={(next) => set("formType", next)}
            />
            <fieldset id="due-diligence-new-type">
              <legend>Application type *</legend>
              {setup.types.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="dueDiligenceType"
                    value={option.value}
                    checked={value.dueDiligenceType === option.value}
                    onChange={() => set("dueDiligenceType", option.value)}
                    required
                  />{" "}
                  {option.label}
                </label>
              ))}
            </fieldset>
          </div>
        </section>
        <section
          id="due-diligence-new-participants"
          className={styles.section}
          aria-labelledby="due-diligence-new-participants-title"
        >
          <h2 id="due-diligence-new-participants-title">Participants</h2>
          <MultiSelect
            id="due-diligence-new-participant-picker"
            label="Participants"
            variant="control"
            options={participants.data ?? []}
            value={value.participants ?? []}
            onChange={(next) =>
              setValue((old) => ({ ...old, participants: next }))
            }
            disabled={!value.org || participants.loading}
          />
          {participants.error && (
            <p role="alert">{participants.error.message}</p>
          )}
          <Select
            id="due-diligence-new-supervisor"
            label="Supervisor"
            value={value.supervisor ?? ""}
            options={supervisors.data ?? []}
            onChange={(next) => set("supervisor", next)}
            disabled={supervisors.loading}
          />
          {supervisors.error && <p role="alert">{supervisors.error.message}</p>}
        </section>
        {value.formType && (
          <section
            id="due-diligence-new-form-metadata"
            className={styles.section}
          >
            {form.loading ? (
              <p>Loading form…</p>
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
        {error && (
          <p id="due-diligence-new-error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.toolbar}>
          <button
            id="due-diligence-new-save"
            type="submit"
            disabled={
              busy || !form.data?.sections.some((section) => section.enabled)
            }
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
          <Link id="due-diligence-new-cancel" href="/due-diligence">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
