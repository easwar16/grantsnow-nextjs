"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import { useActionFailure } from "@/components/dialog/action-failure";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Skeleton } from "@/components/feedback/skeleton";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { LinkedObjectsDialog } from "@/features/record/linked/linked-dialog";
import { awards } from "@/lib/api";
import type { AwardLinks } from "@/lib/api/endpoints/awards";
import type { FormatSettings } from "@/lib/format";
import styles from "@/components/dialog/dialog.module.css";

/**
 * Legacy LinkedButtonActionChain + linkedModulesDialog for one award. With nothing linked and nothing to link, only a
 * toast shows; an award with no proposal opens the dialog to link one (legacy toasted and could not link it).
 */
export function AwardLinksDialog({
  id,
  awardId,
  format,
  onClose,
  onLinked,
}: {
  id: string;
  awardId: string;
  format?: FormatSettings;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [links, setLinks] = useState<AwardLinks>(),
    [proposal, setProposal] = useState(""),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    linking = isActive("link");
  const answered = useEffectEvent(
    (r: Awaited<ReturnType<typeof awards.links>>) => {
      if (!r.ok) {
        toast.error(r.error);
        return onClose();
      }
      if (r.data.groups.length === 0 && r.data.link === null) {
        toast.show("info", r.data.texts.none);
        return onClose();
      }
      setLinks(r.data);
    },
  );
  useEffect(() => {
    let live = true;
    awards.links(awardId).then((r) => live && answered(r));
    return () => {
      live = false;
    };
  }, [awardId]);
  // objectLinked can take most of a minute on DEV: the dialog opens at once with a skeleton.
  if (!links)
    return (
      <ActionDialog
        id={id}
        title=""
        /* legacy linkedModulesDialog: no width class */ onClose={onClose}
      >
        <Skeleton kind="lines" count={4} label="Loading linked records" />
      </ActionDialog>
    );
  const link = () =>
    run(async () => {
      const result = await awards.link(Number(awardId), Number(proposal));
      if (!result.ok) return fail(result.error);
      onLinked();
      onClose();
    }, "link");
  return (
    <LinkedObjectsDialog
      id={id}
      linked={links}
      format={format}
      busy={linking}
      onClose={onClose}
    >
      {links.link && (
        <div className={styles.convert} style={{ alignItems: "flex-end" }}>
          <div className="gn-field" style={{ flex: 1 }}>
            <label className="gn-label" htmlFor={`${id}-proposal-trigger`}>
              {links.link.label}
            </label>
            <Select
              id={`${id}-proposal`}
              label={links.link.label}
              options={links.link.proposals.map((p) => ({
                value: p.value,
                label: p.detail ? `${p.label} (${p.detail})` : p.label,
              }))}
              value={proposal}
              disabled={linking}
              onChange={setProposal}
            />
          </div>
          <button
            type="button"
            id={`${id}-link`}
            className="gn-btn gn-btn--primary"
            disabled={linking || proposal === ""}
            onClick={link}
          >
            {links.link.button}
          </button>
        </div>
      )}
      {links.groups.length === 0 && <p>{links.texts.none}</p>}
    </LinkedObjectsDialog>
  );
}
