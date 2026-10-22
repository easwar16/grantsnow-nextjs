"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/use-in-flight";
import { ActionDialog, useConfirm } from "./action-dialog";
import { endDateAfter, monthsBetween, yearOf } from "./duration";
import { callAction, useActionFailure, type ActionError } from "./request";
import styles from "./actions.module.css";
type Option = { value: string; label: string };
type Field =
  | "full-name"
  | "employee-number"
  | "org-unit"
  | "activity-type"
  | "start-date"
  | "end-date"
  | "duration-months"
  | "primary-sponsor"
  | "stage"
  | "confidential";
export type ConvertKind = "OUTLINE_PROPOSAL" | "PROPOSAL";
interface Setup {
  texts: Record<
    | "title"
    | "cancel"
    | "create"
    | "yes"
    | "no"
    | "required"
    | "warningTitle"
    | "funderWarning",
    string
  >;
  gates: Record<Field, { show: boolean; required: boolean; label: string }>;
  decimals: number;
  heading: string;
  pis: (Option & {
    detail: string;
    employeeNumber: string;
    orgUnitId: string;
  })[];
  sponsors: Option[];
  activities: Option[];
  stages: Option[];
  initial: {
    piId: string;
    orgUnits: Option[];
    orgUnitId: string;
    sponsorId: string;
    activityType: string;
  };
}
const inRange = (iso: string) => {
  const y = yearOf(iso);
  return y > 1900 && y < 2200;
};
/** Converts an opportunity into an outline or full proposal, then opens the new proposal. */
export function ConvertDialog({
  opener,
  kind,
  opportunityId,
  onClose,
}: {
  opener: "finder" | "dashboard";
  kind: ConvertKind;
  opportunityId: string;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<Setup>(),
    [v, setV] = useState({
      piId: "",
      orgUnitId: "",
      activityType: "",
      stage: "",
      start: "",
      end: "",
      duration: "",
      sponsorId: "",
      confidential: "N" as "Y" | "N",
    }),
    [orgUnits, setOrgUnits] = useState<Option[]>([]),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    { ask, element: confirmation } = useConfirm(),
    toast = useToast(),
    fail = useActionFailure(),
    router = useRouter(),
    saving = isActive("convert");
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    callAction<Setup>("convert", undefined, {
      opener,
      kind,
      opportunityId,
    }).then((r) => {
      if (!live) return;
      if (!r.ok) return setupFailed(r.error);
      setSetup(r.data);
      setOrgUnits(r.data.initial.orgUnits);
      setV((s) => ({
        ...s,
        piId: r.data.initial.piId,
        orgUnitId: r.data.initial.orgUnitId,
        sponsorId: r.data.initial.sponsorId,
        activityType: r.data.initial.activityType,
      }));
    });
    return () => {
      live = false;
    };
  }, [opener, kind, opportunityId]);
  if (!setup)
    return (
      <ActionDialog title="" width={960} onClose={onClose}>
        <RecordSkeleton label="Loading convert options" />
      </ActionDialog>
    );
  const { gates, texts } = setup;
  const pi = setup.pis.find((p) => p.value === v.piId);
  const missing = (f: Field, value: string) =>
    gates[f].required && value === "";
  const valid =
    !missing("full-name", v.piId) &&
    !missing("org-unit", v.orgUnitId) &&
    !missing("activity-type", v.activityType) &&
    !missing("start-date", v.start) &&
    !missing("end-date", v.end) &&
    !missing("primary-sponsor", v.sponsorId) &&
    !missing("stage", v.stage) &&
    !(v.start && v.end && v.end < v.start);
  const invalid = (f: Field, value: string) => touched && missing(f, value);
  const pickPi = async (personId: string) => {
    const next = setup.pis.find((p) => p.value === personId);
    setV((s) => ({ ...s, piId: personId, orgUnitId: next?.orgUnitId ?? "" }));
    setOrgUnits([]);
    if (!personId) return;
    const r = await callAction<Option[]>("org-units", undefined, { personId });
    // A failed org-unit list degrades to empty, as the original.
    const units = r.ok ? r.data : [];
    if (!r.ok) toast.error(r.error);
    setOrgUnits(units);
    setV((s) =>
      s.piId !== personId || units.some((u) => u.value === s.orgUnitId)
        ? s
        : { ...s, orgUnitId: units[0]?.value ?? "" },
    );
  };
  // The original's rules: a start past the end moves the end by the duration; an end before the start warns.
  const changeDate = (changed: "start" | "end", value: string) => {
    const next = { ...v, [changed]: value };
    if (!value) next.duration = "";
    else if (inRange(value)) {
      if (!next.start || !next.end) next.duration = "";
      else if (next.end < next.start) {
        if (changed === "start" && next.duration !== "")
          next.end =
            endDateAfter(next.start, Number(next.duration), setup.decimals) ??
            next.end;
        else if (changed === "end")
          toast.show(
            "warning",
            "Invalid End Date",
            "End date cannot be before start date.",
          );
      } else
        next.duration = String(
          monthsBetween(next.start, next.end, setup.decimals) ?? "",
        );
    }
    setV(next);
  };
  // A duration outside 0 < m < 1200 clears the end date, as the original does.
  const changeDuration = (value: string) => {
    const months = value === "" ? NaN : Number(value);
    const next = { ...v, duration: value };
    if (!(months > 0 && months < 1200)) next.end = "";
    else {
      const end = v.start
        ? endDateAfter(v.start, months, setup.decimals)
        : null;
      if (end && yearOf(end) >= 1900 && yearOf(end) <= 2200) next.end = end;
    }
    setV(next);
  };
  const create = () => {
    setTouched(true);
    if (!valid) return toast.show("error", texts.required);
    // The confirm and the send are one pending unit (D44).
    run(async () => {
      if (
        v.sponsorId !== setup.initial.sponsorId &&
        !(await ask({
          title: texts.warningTitle,
          message: texts.funderWarning,
          confirm: texts.yes,
          cancel: texts.no,
          danger: true,
        }))
      )
        return;
      const id = (s: string) => (s === "" ? null : Number(s));
      const result = await callAction<{
        href: string;
        message: string;
        seedError?: string;
      }>("convert", {
        opener,
        kind,
        opportunityId: Number(opportunityId),
        piId: id(v.piId),
        orgUnitId: id(v.orgUnitId),
        activityType: v.activityType || null,
        stage: v.stage || null,
        start: v.start,
        end: v.end,
        sponsorId: id(v.sponsorId),
        confidential: v.confidential,
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", result.data.message);
      if (result.data.seedError) toast.show("warning", result.data.seedError);
      onClose();
      router.push(result.data.href);
    }, "convert");
  };
  const label = (f: Field) =>
    `${gates[f].label}${gates[f].required ? " *" : ""}`;
  const select = (
    f: Field,
    value: string,
    options: Option[],
    onChange: (value: string) => void,
  ) =>
    gates[f].show && (
      <label className={`gn-field ${styles.cell}`}>
        <span className="gn-label">{label(f)}</span>
        <select
          className="gn-control"
          value={value}
          disabled={saving}
          aria-invalid={invalid(f, value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <ActionDialog
      title={texts.title}
      subtitle={setup.heading}
      width={960}
      busy={saving}
      onClose={onClose}
    >
      <form
        className={styles.convert}
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        {select(
          "full-name",
          v.piId,
          setup.pis.map((p) => ({
            value: p.value,
            label: p.detail ? `${p.label} (${p.detail})` : p.label,
          })),
          pickPi,
        )}
        {gates["employee-number"].show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("employee-number")}</span>
            <input
              className="gn-control"
              value={pi?.employeeNumber ?? ""}
              readOnly
            />
          </label>
        )}
        {select("org-unit", v.orgUnitId, orgUnits, (orgUnitId) =>
          setV((s) => ({ ...s, orgUnitId })),
        )}
        {select("activity-type", v.activityType, setup.activities, (a) =>
          setV((s) => ({ ...s, activityType: a })),
        )}
        {gates["start-date"].show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("start-date")}</span>
            <input
              className="gn-control"
              type="date"
              max={v.end || undefined}
              value={v.start}
              disabled={saving}
              aria-invalid={invalid("start-date", v.start)}
              onChange={(e) => changeDate("start", e.target.value)}
            />
          </label>
        )}
        {gates["end-date"].show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("end-date")}</span>
            <input
              className="gn-control"
              type="date"
              min={v.start || undefined}
              value={v.end}
              disabled={saving}
              aria-invalid={invalid("end-date", v.end)}
              onChange={(e) => changeDate("end", e.target.value)}
            />
          </label>
        )}
        {gates["duration-months"].show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("duration-months")}</span>
            <input
              className="gn-control"
              type="number"
              min="0"
              step={1 / 10 ** setup.decimals}
              value={v.duration}
              disabled={saving || !v.start}
              onChange={(e) => changeDuration(e.target.value)}
            />
          </label>
        )}
        {select("primary-sponsor", v.sponsorId, setup.sponsors, (s) =>
          setV((x) => ({ ...x, sponsorId: s })),
        )}
        {select("stage", v.stage, setup.stages, (stage) =>
          setV((s) => ({ ...s, stage })),
        )}
        {gates.confidential.show && (
          <fieldset className={`gn-field ${styles.cell}`}>
            <legend className="gn-label">{label("confidential")}</legend>
            <div className={styles.radios}>
              {(["Y", "N"] as const).map((c) => (
                <label key={c} className={styles.radio}>
                  <input
                    type="radio"
                    name="confidential"
                    value={c}
                    checked={v.confidential === c}
                    disabled={saving}
                    onChange={() => setV((s) => ({ ...s, confidential: c }))}
                  />
                  {c === "Y" ? texts.yes : texts.no}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className={styles.foot}>
          <button
            type="button"
            className="gn-btn gn-btn--solid"
            disabled={saving}
            onClick={onClose}
          >
            {texts.cancel}
          </button>
          <button
            type="submit"
            className="gn-btn gn-btn--primary"
            disabled={saving}
          >
            {texts.create}
          </button>
        </div>
      </form>
      {confirmation}
    </ActionDialog>
  );
}
