"use client";
import { DateInput } from "@/components/ui/date-input";
import { Select } from "@/components/ui/select";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import {
  ActionDialog,
  useConfirm,
} from "../../../../../components/dialog/action-dialog";
import { endDateAfter, monthsBetween, yearOf } from "./duration";
import { opportunities } from "@/lib/api";
import {
  useActionFailure,
  type ActionError,
} from "../../../../../components/dialog/action-failure";
import styles from "../../../../../components/dialog/dialog.module.css";
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
export interface ConvertSetup {
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
const setupQuery = (
  opener: string,
  kind: ConvertKind,
  opportunityId: string,
  requestId?: string,
) => ({ opener, kind, opportunityId, ...(requestId ? { requestId } : {}) });
/** Starts the convert setup read before the dialog opens (on intent, or while the deadline warning is up). */
export const warmConvert = (...args: Parameters<typeof setupQuery>) =>
  opportunities.warm(opportunities.convertSetup, setupQuery(...args));
/** Converts an opportunity into an outline or full proposal, then opens the new proposal. */
export function ConvertDialog({
  id,
  opener,
  kind,
  opportunityId,
  requestId,
  onClose,
}: {
  id: string;
  opener: "finder" | "dashboard";
  kind: ConvertKind;
  opportunityId: string;
  /** The EOI record's convert of an approved application: its `eoi-*` keys and `request_id`. */
  requestId?: string;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<ConvertSetup>(),
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
    { ask, element: confirmation } = useConfirm(`${id}-warning`),
    toast = useToast(),
    fail = useActionFailure(),
    router = useRouter(),
    latestPi = useRef(""),
    saving = isActive("convert");
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    opportunities
      .take(
        opportunities.convertSetup,
        setupQuery(opener, kind, opportunityId, requestId),
      )
      .then((r) => {
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
  }, [opener, kind, opportunityId, requestId]);
  if (!setup)
    return (
      <ActionDialog id={id} title="" width={960} onClose={onClose}>
        <Skeleton kind="lines" count={4} label="Loading convert options" />
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
    latestPi.current = personId;
    if (!personId) return;
    const r = await opportunities.take(opportunities.orgUnits, { personId });
    // Latest wins: a slower list for an earlier pick never replaces the current one.
    if (latestPi.current !== personId) return;
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
      const result = await opportunities.convert({
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
        ...(requestId ? { requestId: Number(requestId) } : {}),
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
      <div className={`gn-field ${styles.cell}`}>
        <label className="gn-label" htmlFor={`${id}-${f}-trigger`}>
          {label(f)}
        </label>
        <Select
          id={`${id}-${f}`}
          label={gates[f].label}
          options={options}
          value={value}
          disabled={saving}
          invalid={!!invalid(f, value)}
          onChange={onChange}
        />
      </div>
    );
  return (
    <ActionDialog
      id={id}
      title={texts.title}
      subtitle={setup.heading}
      width={960}
      busy={saving}
      onClose={onClose}
    >
      <form
        id={`${id}-form`}
        className={styles.convert}
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        {/* Written out rather than through select(): the compiler cannot see that pickPi's ref is read only on change. */}
        {gates["full-name"].show && (
          <div className={`gn-field ${styles.cell}`}>
            <label className="gn-label" htmlFor={`${id}-full-name-trigger`}>
              {label("full-name")}
            </label>
            <Select
              id={`${id}-full-name`}
              label={gates["full-name"].label}
              options={setup.pis.map((p) => ({
                value: p.value,
                label: p.detail ? `${p.label} (${p.detail})` : p.label,
              }))}
              value={v.piId}
              disabled={saving}
              invalid={!!invalid("full-name", v.piId)}
              onChange={pickPi}
            />
          </div>
        )}
        {gates["employee-number"].show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("employee-number")}</span>
            <input
              id={`${id}-employee-number`}
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
          <div className={`gn-field ${styles.cell}`}>
            <span className="gn-label" aria-hidden="true">
              {label("start-date")}
            </span>
            <DateInput
              id={`${id}-start-date`}
              label={label("start-date")}
              max={v.end || undefined}
              value={v.start}
              disabled={saving}
              invalid={!!invalid("start-date", v.start)}
              onChange={(date) => changeDate("start", date)}
            />
          </div>
        )}
        {gates["end-date"].show && (
          <div className={`gn-field ${styles.cell}`}>
            <span className="gn-label" aria-hidden="true">
              {label("end-date")}
            </span>
            <DateInput
              id={`${id}-end-date`}
              label={label("end-date")}
              min={v.start || undefined}
              value={v.end}
              disabled={saving}
              invalid={!!invalid("end-date", v.end)}
              onChange={(date) => changeDate("end", date)}
            />
          </div>
        )}
        {gates["duration-months"].show && (
          <label className={`gn-field ${styles.cell}`}>
            <span className="gn-label">{label("duration-months")}</span>
            <input
              id={`${id}-duration-months`}
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
          <fieldset
            id={`${id}-confidential`}
            className={`gn-field ${styles.cell}`}
          >
            <legend className="gn-label">{label("confidential")}</legend>
            <div className={styles.radios}>
              {(["Y", "N"] as const).map((c) => (
                <label key={c} className={styles.radio}>
                  <input
                    id={`${id}-confidential-${c.toLowerCase()}`}
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
            id={`${id}-cancel`}
            className="gn-btn gn-btn--solid"
            disabled={saving}
            onClick={onClose}
          >
            {texts.cancel}
          </button>
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
      {confirmation}
    </ActionDialog>
  );
}
