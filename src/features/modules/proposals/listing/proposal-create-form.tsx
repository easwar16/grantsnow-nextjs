"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { proposals } from "@/lib/api";
import { FormSelect } from "@/components/ui/form-select";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import type { proposalCreateChoices } from "@/server/modules/proposals/create";
import styles from "./proposal-create.module.css";

type Choices = Awaited<ReturnType<typeof proposalCreateChoices>>;
export function ProposalCreateForm({
  type,
  choices,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL";
  choices: Choices;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await proposals.create({
      type,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      piPersonId: Number(form.get("piPersonId")),
      activityType: String(form.get("activityType") ?? ""),
      proposalStage: String(form.get("proposalStage") ?? ""),
      proposalType: String(form.get("proposalType") ?? ""),
      category: String(form.get("category") ?? ""),
      startDate,
      endDate,
      costModel: Number(form.get("costModel")),
      confidential: form.get("confidential") === "Y" ? "Y" : "N",
      sponsorId: Number(form.get("sponsorId")),
    });
    if (result.ok)
      router.replace(`/proposals/${result.data.type}/${result.data.id}`);
    else {
      setError(result.error.message);
      setPending(false);
    }
  }
  return (
    <form
      id="proposal-new-form"
      className={styles.form}
      onSubmit={(event) => void submit(event)}
    >
      <section id="proposal-new-pi" className={styles.section}>
        <h2>Principal Investigator Details</h2>
        <label htmlFor="proposal-new-pi-select">
          Full Name <b>*</b>
        </label>
        <FormSelect
          id="proposal-new-pi-select"
          name="piPersonId"
          label="Principal Investigator"
          options={choices.pi}
          defaultValue={
            choices.pi.some((row) => row.value === choices.currentPersonId)
              ? choices.currentPersonId
              : ""
          }
          required
        />
      </section>
      <div id="proposal-new-main" className={styles.columns}>
        <section id="proposal-new-details" className={styles.section}>
          <h2>Proposal Details</h2>
          <label htmlFor="proposal-new-title">
            Full Project Title <b>*</b>
          </label>
          <input
            id="proposal-new-title"
            name="title"
            required
            maxLength={500}
          />
          <label htmlFor="proposal-new-description">Project description</label>
          <textarea
            id="proposal-new-description"
            name="description"
            maxLength={4000}
          />
          <label htmlFor="proposal-new-activity">
            Activity type <b>*</b>
          </label>
          <FormSelect
            id="proposal-new-activity"
            name="activityType"
            label="Activity type"
            options={choices.activityTypes}
            required
          />
          <label htmlFor="proposal-new-stage">
            Proposal Stages <b>*</b>
          </label>
          <FormSelect
            id="proposal-new-stage"
            name="proposalStage"
            label="Proposal Stages"
            options={choices.stages}
            required
          />
          <label htmlFor="proposal-new-type">
            Proposal type <b>*</b>
          </label>
          <FormSelect
            id="proposal-new-type"
            name="proposalType"
            label="Proposal type"
            options={choices.proposalTypes}
            required
          />
          <label htmlFor="proposal-new-category">Proposal Category</label>
          <FormSelect
            id="proposal-new-category"
            name="category"
            label="Proposal Category"
            options={choices.categories}
          />
          <label htmlFor="proposal-new-start">
            Start date <b>*</b>
          </label>
          <DateInput
            id="proposal-new-start"
            label="Start date"
            value={startDate}
            onChange={setStartDate}
            required
          />
          <label htmlFor="proposal-new-end">
            End date <b>*</b>
          </label>
          <DateInput
            id="proposal-new-end"
            label="End date"
            value={endDate}
            onChange={setEndDate}
            min={startDate || undefined}
            required
          />
          <label htmlFor="proposal-new-cost">
            Cost model <b>*</b>
          </label>
          <FormSelect
            id="proposal-new-cost"
            name="costModel"
            label="Cost model"
            options={choices.costModels}
            required
          />
          <fieldset id="proposal-new-confidential">
            <legend>Confidential</legend>
            <label>
              <input
                id="proposal-new-confidential-yes"
                type="radio"
                name="confidential"
                value="Y"
              />{" "}
              Yes
            </label>
            <label>
              <input
                id="proposal-new-confidential-no"
                type="radio"
                name="confidential"
                value="N"
                defaultChecked
              />{" "}
              No
            </label>
          </fieldset>
        </section>
        <section id="proposal-new-funders" className={styles.section}>
          <h2>Funder details</h2>
          <label htmlFor="proposal-new-sponsor">
            Primary funder <b>*</b>
          </label>
          <FormSelect
            id="proposal-new-sponsor"
            name="sponsorId"
            label="Primary funder"
            options={choices.sponsors}
            required
          />
        </section>
      </div>
      {error && (
        <p id="proposal-new-error" role="alert">
          {error}
        </p>
      )}
      <div id="proposal-new-actions" className={styles.actions}>
        <button
          id="proposal-new-save"
          type="submit"
          disabled={pending || !startDate || !endDate}
        >
          <Icon name="save" /> {pending ? "Saving…" : "Save"}
        </button>
        <button
          id="proposal-new-cancel"
          type="button"
          disabled={pending}
          onClick={() => router.push("/proposals")}
        >
          <Icon name="close-circle" /> Cancel
        </button>
      </div>
    </form>
  );
}
