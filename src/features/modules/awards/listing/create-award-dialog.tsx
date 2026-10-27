"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import {
  useActionFailure,
  type ActionError,
} from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { awards } from "@/lib/api";
import type { CreateAwardField, CreateAwardSetup } from "./actions";
import styles from "@/components/dialog/dialog.module.css";

const EMPTY = {
  proposal: "",
  pi: "",
  sponsor: "",
  fullTitle: "",
  name: "",
  start: "",
  end: "",
  amount: "",
  currency: "",
  period: "",
};

/** Legacy dialogCreateAward: a new award, generated from a proposal or posted as a header. */
export function CreateAwardDialog({
  id,
  onClose,
  onCreated,
}: {
  id: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [setup, setSetup] = useState<CreateAwardSetup>(),
    [v, setV] = useState(EMPTY),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("create");
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    awards.createSetup().then((r) => {
      if (!live) return;
      if (!r.ok) return setupFailed(r.error);
      setSetup(r.data);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!setup)
    return (
      <ActionDialog id={id} title="" width="70vw" onClose={onClose}>
        <Skeleton kind="lines" count={4} label="Loading award options" />
      </ActionDialog>
    );
  const { fields: f, texts } = setup;
  const pi = setup.pis.find((p) => p.value === v.pi);
  const value: Record<CreateAwardField, string> = {
    ...v,
    org: pi?.orgUnitId ?? "",
  };
  const missing = (k: CreateAwardField) =>
    f[k].show && f[k].required && value[k] === "";
  const invalid = (k: CreateAwardField) => touched && missing(k);
  const label = (k: CreateAwardField) =>
    `${f[k].label}${f[k].required ? " *" : ""}`;
  const set = (k: keyof typeof EMPTY) => (next: string) =>
    setV((s) => ({ ...s, [k]: next }));
  const create = () => {
    setTouched(true);
    const fields = Object.keys(f) as CreateAwardField[];
    if (fields.some(missing)) return toast.show("error", texts.required);
    run(async () => {
      const num = (s: string) => (s === "" ? null : Number(s));
      const result = await awards.create({
        proposalId: num(v.proposal),
        piId: num(v.pi),
        sponsorId: num(v.sponsor),
        fullTitle: v.fullTitle,
        name: v.name,
        start: v.start,
        end: v.end,
        amount: num(v.amount),
        currency: v.currency,
        period: num(v.period),
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", texts.created);
      onCreated();
      onClose();
    }, "create");
  };
  const select = (
    k: CreateAwardField,
    current: string,
    options: { value: string; label: string; detail?: string }[],
    onChange: (next: string) => void,
  ) =>
    f[k].show && (
      <div className={`gn-field ${styles.cell}`}>
        <label className="gn-label" htmlFor={`${id}-${k}-trigger`}>
          {label(k)}
        </label>
        <Select
          id={`${id}-${k}`}
          label={f[k].label}
          options={options.map((o) => ({
            value: o.value,
            label: o.detail ? `${o.label} (${o.detail})` : o.label,
          }))}
          value={current}
          disabled={saving}
          invalid={invalid(k)}
          onChange={onChange}
        />
      </div>
    );
  const text = (k: "fullTitle" | "name") =>
    f[k].show && (
      <label className={`gn-field ${styles.cell}`}>
        <span className="gn-label">{label(k)}</span>
        <input
          id={`${id}-${k}`}
          className="gn-control"
          value={v[k]}
          // Legacy getLengthValidators: the RB maxLength preference.
          maxLength={f[k].maxLength}
          disabled={saving}
          aria-invalid={invalid(k) || undefined}
          onChange={(e) => set(k)(e.target.value)}
        />
      </label>
    );
  const number = (k: "amount" | "period") =>
    f[k].show && (
      <label className={`gn-field ${styles.cell}`}>
        <span className="gn-label">{label(k)}</span>
        <input
          id={`${id}-${k}`}
          className="gn-control"
          type="number"
          step={k === "period" ? 1 : "any"}
          value={v[k]}
          disabled={saving}
          aria-invalid={invalid(k) || undefined}
          onChange={(e) => set(k)(e.target.value)}
        />
      </label>
    );
  const date = (k: "start" | "end") =>
    f[k].show && (
      <div className={`gn-field ${styles.cell}`}>
        <span className="gn-label" aria-hidden="true">
          {label(k)}
        </span>
        <DateInput
          id={`${id}-${k}`}
          label={label(k)}
          min={k === "end" ? v.start || undefined : undefined}
          value={v[k]}
          disabled={saving}
          invalid={invalid(k)}
          onChange={set(k)}
        />
      </div>
    );
  return (
    <ActionDialog
      id={id}
      title={texts.title}
      width="70vw" /* legacy dialogCreateAward width: 70vw */
      busy={saving}
      onClose={onClose}
    >
      <form
        id={`${id}-form`}
        className={styles.convert}
        style={{ "--cols": 3 } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        {select("proposal", v.proposal, setup.proposals, set("proposal"))}
        {select("pi", v.pi, setup.pis, set("pi"))}
        {/* Legacy: read-only, the chosen PI's org unit (awPIChange). */}
        {f.org.show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("org")}</span>
            <input
              id={`${id}-org`}
              className="gn-control"
              value={pi?.orgUnitName ?? ""}
              aria-invalid={invalid("org") || undefined}
              readOnly
            />
          </label>
        )}
        {select("sponsor", v.sponsor, setup.sponsors, set("sponsor"))}
        {text("fullTitle")}
        {text("name")}
        {date("start")}
        {date("end")}
        {number("amount")}
        {select("currency", v.currency, setup.currencies, set("currency"))}
        {number("period")}
        <div className={styles.foot}>
          <button
            type="submit"
            id={`${id}-create`}
            className="gn-btn gn-btn--primary"
            disabled={saving}
          >
            {texts.create}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}
