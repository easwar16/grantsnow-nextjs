"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import {
  useActionFailure,
  type ActionError,
} from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { awards } from "@/lib/api";
import { CloneParts } from "@/components/dialog/clone-parts";
import { toggleClonePart, type CloneSetup } from "./actions";
import styles from "@/components/dialog/dialog.module.css";

/** Legacy dialogCopyAward: clone an award with the chosen parts ("Entire Award" ticks them all). */
export function CloneAwardDialog({
  id,
  awardId,
  onClose,
  onCloned,
}: {
  id: string;
  awardId: string;
  onClose: () => void;
  onCloned: () => void;
}) {
  const [setup, setSetup] = useState<CloneSetup>(),
    [chosen, setChosen] = useState<string[]>([]),
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
    awards.cloneSetup(awardId).then((r) => {
      if (!live) return;
      if (!r.ok) return setupFailed(r.error);
      setSetup(r.data);
      // Parts the backend always copies start ticked (legacy's default `access`).
      setChosen(r.data.parts.filter((p) => p.fixed).map((p) => p.value));
    });
    return () => {
      live = false;
    };
  }, [awardId]);
  if (!setup)
    return (
      <ActionDialog id={id} title="" width="33.333vw" onClose={onClose}>
        <Skeleton kind="lines" count={4} label="Loading clone options" />
      </ActionDialog>
    );
  const { parts, texts } = setup;
  const clone = () =>
    run(async () => {
      const result = await awards.clone(Number(awardId), chosen);
      if (!result.ok) return fail(result.error);
      toast.show("success", "Award Cloned Successfully!");
      onCloned();
      onClose();
    }, "clone");
  return (
    <ActionDialog
      id={id}
      title={texts.title}
      width="33.333vw" /* legacy dialogCopyAward oj-md-4 */
      busy={saving}
      onClose={onClose}
    >
      <div id={`${id}-parts`} className={styles.form}>
        <CloneParts
          id={id}
          parts={parts}
          chosen={chosen}
          onChange={setChosen}
          toggle={toggleClonePart}
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
