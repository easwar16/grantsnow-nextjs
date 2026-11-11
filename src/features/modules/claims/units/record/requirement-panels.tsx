"use client";
import { useRef, useState } from "react";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { Collapsible } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import { useRecordAudit } from "@/features/record/shell/record-frame";
import { claims, useApi } from "@/lib/api";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { UnitRequirementsView } from "../listing/types";
import styles from "./summary.module.css";

const ID = "claims-unit-requirements";
type Item = UnitRequirementsView["items"][number];

/**
 * The Fund Summary's surveys below its table (legacy activitySummary.requirements): one collapsed panel per
 * configured form, with the person responsible and the shared dynamic form on the fund's requirement.
 */
export function RequirementPanels({
  appId,
  fund,
}: {
  appId: string;
  fund: string;
}) {
  const read = useApi(claims.requirements, { appId, fund });
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the requirements"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!read.data) return <ListSkeleton label="Loading the requirements" />;
  const view = read.data;
  if (view.items.length === 0) return null;
  return (
    <div id={ID} className={styles.panelSection}>
      {view.items.map((item) => (
        <Collapsible
          key={item.key}
          id={`${ID}-${functions.ids.idPart(item.key)}`}
          heading={item.heading}
          defaultOpen={false}
          headClassName={styles.subheading}
        >
          <Requirement appId={appId} fund={fund} view={view} item={item} />
        </Collapsible>
      ))}
    </div>
  );
}

function Requirement({
  appId,
  fund,
  view,
  item,
}: {
  appId: string;
  fund: string;
  view: UnitRequirementsView;
  item: Item;
}) {
  const id = `${ID}-${functions.ids.idPart(item.key)}`;
  const [person, setPerson] = useState({ name: item.name, email: item.email }),
    // The id minted by the first Submit, before a reread brings it.
    [requirementId, setRequirementId] = useState(item.requirementId);
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    form = useRef<DynamicFormHandle>(null),
    openAudit = useRecordAudit();
  // Submit waits for the form: check() refuses one still loading, with no message.
  const [formReady, setFormReady] = useState(false);
  const busy = isActive("submit");
  const submit = () =>
    void run(async () => {
      const f = form.current;
      if (!f || !f.check()) return;
      const saved = await claims.saveRequirement(appId, {
        fund,
        form: item.form,
        ...person,
      });
      if (!saved.ok) return fail(saved.error);
      setRequirementId(saved.data.requirementId);
      if (!(await f.save(saved.data.requirementId))) return;
      toast.show("success", view.texts.saved);
    }, "submit");
  const field = (k: "name" | "email") =>
    view.editable ? (
      <InsideField
        htmlFor={`${id}-${k}`}
        label={view.labels[k]}
        filled={person[k] !== ""}
        required
      >
        <input
          id={`${id}-${k}`}
          type={k === "email" ? "email" : "text"}
          value={person[k]}
          disabled={busy}
          onChange={(e) => setPerson((p) => ({ ...p, [k]: e.target.value }))}
        />
      </InsideField>
    ) : (
      <ReadonlyField
        id={`${id}-${k}`}
        label={view.labels[k]}
        value={person[k] || "—"}
      />
    );
  return (
    <div className={styles.signOffList}>
      {view.texts.audit && requirementId && (
        <div className={styles.signOffBar}>
          <button
            type="button"
            id={`${id}-audit`}
            className={`gn-btn gn-btn--outlined ${styles.pushEnd}`}
            onClick={() =>
              openAudit({
                page: item.slot.toLowerCase(),
                sec: requirementId,
                title: view.texts.audit!,
              })
            }
          >
            <Icon name="audits" size={14} />
            {view.texts.audit}
          </button>
        </div>
      )}
      <div className={styles.editorGrid}>
        {field("name")}
        {field("email")}
      </div>
      <DynamicForm
        ref={form}
        objectType="CLAIMS"
        slot={item.slot}
        parentId={appId}
        objectId={requirementId ?? undefined}
        editable={view.editable}
        onReadyChange={setFormReady}
      />
      {view.editable && (
        <div className={styles.goalActions}>
          <button
            type="button"
            id={`${id}-submit`}
            className="gn-btn gn-btn--primary"
            disabled={busy || !formReady}
            onClick={submit}
          >
            {view.texts.submit}
          </button>
        </div>
      )}
    </div>
  );
}
