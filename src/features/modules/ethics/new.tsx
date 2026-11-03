"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ethics, useApi } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import type { CreateEthics, CreateSetup } from "@/lib/api/endpoints/ethics";
import styles from "./record.module.css";

export function NewEthics({ setup }: { setup: CreateSetup }) {
  const router = useRouter();
  const [value, setValue] = useState<CreateEthics>({
    title: "",
    org: "",
    formType: "",
    ethicsType: "",
    deadline: "",
    expiry: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useApi(ethics.createForm, value.formType || null);
  const set = (key: keyof CreateEthics, next: string) =>
    setValue((old) => ({ ...old, [key]: next }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.data?.sections.some((section) => section.enabled)) return;
    setBusy(true);
    setError("");
    const result = await ethics.create(value);
    if (result.ok) router.push(`/ethics/${result.data.id}?access=EA_ACCESS`);
    else {
      setError(result.error.message);
      setBusy(false);
    }
  }
  return (
    <main id="ethics-new" className={styles.page}>
      <div className={styles.toolbar}>
        <Link id="ethics-new-back" href="/ethics">
          ← List
        </Link>
      </div>
      <h1 id="ethics-new-title">New Ethics application</h1>
      <form id="ethics-new-form" onSubmit={save}>
        <section
          id="ethics-new-overview"
          className={styles.section}
          aria-labelledby="ethics-new-overview-title"
        >
          <h2 id="ethics-new-overview-title">General Overview</h2>
          <div className={styles.fields}>
            <div>
              <label htmlFor="ethics-new-project-title">Project title *</label>
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
              label="Org Unit"
              required
              value={value.org}
              options={setup.orgs}
              onChange={(next) => set("org", next)}
            />
            <div>
              <label htmlFor="ethics-new-expiry">Expiry Date</label>
              <DateInput
                id="ethics-new-expiry"
                value={value.expiry ?? ""}
                onChange={(next) => set("expiry", next)}
              />
            </div>
            <div>
              <label htmlFor="ethics-new-deadline">Deadline Date</label>
              <DateInput
                id="ethics-new-deadline"
                value={value.deadline ?? ""}
                onChange={(next) => set("deadline", next)}
              />
            </div>
            <Select
              id="ethics-new-form-type"
              label="Form Type"
              required
              value={value.formType}
              options={setup.formTypes}
              onChange={(next) => set("formType", next)}
            />
            <fieldset id="ethics-new-type">
              <legend>Application type *</legend>
              {setup.types.map((option) => (
                <label key={option.value}>
                  <input
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
        {value.formType && (
          <section id="ethics-new-form-metadata" className={styles.section}>
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
          <p id="ethics-new-error" role="alert">
            {error}
          </p>
        )}
        <div className={styles.toolbar}>
          <button
            id="ethics-new-save"
            type="submit"
            disabled={
              busy || !form.data?.sections.some((section) => section.enabled)
            }
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
          <Link id="ethics-new-cancel" href="/ethics">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
