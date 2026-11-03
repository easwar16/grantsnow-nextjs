"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import {
  useActionFailure,
  type ActionError,
} from "@/components/dialog/action-failure";
import { CloneParts, toggleCloneTree } from "@/components/dialog/clone-parts";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claims } from "@/lib/api";
import type { UnitCloneSetup, UnitRow } from "./types";
import styles from "@/components/dialog/dialog.module.css";

/** Legacy dialogCopyUnit: copies a unit application to another fiscal year with the chosen parts. */
export function CloneUnitDialog({
  id,
  row,
  years,
  onClose,
  onCloned,
}: {
  id: string;
  row: UnitRow;
  years: { value: string; label: string }[];
  onClose: () => void;
  onCloned: () => void;
}) {
  const [setup, setSetup] = useState<UnitCloneSetup>(),
    [year, setYear] = useState(""),
    [chosen, setChosen] = useState<string[]>([]),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("clone");
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    claims.unitCloneSetup().then((r) => {
      if (!live) return;
      if (!r.ok) return setupFailed(r.error);
      setSetup(r.data);
      // Legacy's default `access` is the parts the backend always copies.
      setChosen(r.data.parts.filter((p) => p.fixed).map((p) => p.value));
    });
    return () => {
      live = false;
    };
  }, []);
  if (!setup)
    return (
      <ActionDialog id={id} title="" width="33.333vw" onClose={onClose}>
        <Skeleton kind="lines" count={4} label="Loading clone options" />
      </ActionDialog>
    );
  const { parts, texts } = setup;
  const clone = () => {
    setTouched(true);
    if (!year) return;
    run(async () => {
      const result = await claims.cloneUnit({
        appId: Number(row.id),
        unitId: row.unitId,
        fiscalYear: row.fiscalYear,
        toYear: year,
        parts: chosen,
      });
      if (!result.ok) return fail(result.error);
      // Legacy confirms only when the reply names the new application.
      if (result.data.cloned) {
        toast.show("success", "Application Cloned Successfully!");
        onCloned();
      }
      onClose();
    }, "clone");
  };
  return (
    <ActionDialog
      id={id}
      title={texts.title}
      width="33.333vw" /* legacy dialogCopyUnit oj-md-4 */
      busy={saving}
      onClose={onClose}
    >
      <div id={`${id}-parts`} className={styles.form}>
        <div className="gn-field">
          <label className="gn-label" htmlFor={`${id}-year-trigger`}>
            {texts.year} *
          </label>
          <Select
            id={`${id}-year`}
            label={texts.year}
            options={years}
            value={year}
            required
            invalid={touched && !year}
            disabled={saving}
            onChange={setYear}
          />
        </div>
        <CloneParts
          id={id}
          parts={parts}
          chosen={chosen}
          onChange={setChosen}
          toggle={toggleCloneTree}
          entire={texts.entire}
          legend={texts.title}
          disabled={saving}
        />
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-cancel`}
            className="gn-btn gn-btn--outlined"
            disabled={saving}
            onClick={onClose}
          >
            {texts.cancel}
          </button>
          <button
            type="button"
            id={`${id}-clone`}
            className="gn-btn gn-btn--primary"
            disabled={saving}
            onClick={clone}
          >
            <Icon name="copy" size={14} />
            {texts.clone}
          </button>
        </div>
      </div>
    </ActionDialog>
  );
}
