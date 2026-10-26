"use client";

import { useEffect, useRef, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ObjectAudit } from "./audit";
import { ObjectComments } from "./comments";
import styles from "./record-panels.module.css";

type Panel = "comments" | "audit";

/** Contract detail actions share the record Comments and Audit fragments on every tab. */
export function ContractRecordPanels({ objectId }: { objectId: string }) {
  const segment = useSelectedLayoutSegment();
  const page = `contracts-${segment === "workflow" || segment === "signers" || segment === "history" || segment === "delegation" ? segment : "summary"}`;
  const [panel, setPanel] = useState<Panel | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setPanel(null);
    opener.current?.focus();
  };
  useEffect(() => {
    if (!panel) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel]);
  const open = (next: Panel, target: HTMLButtonElement) => {
    opener.current = target;
    setPanel(next);
  };
  const props = { objectType: "CONTRACT", objectId, page };
  const pageTitle =
    segment === "delegation"
      ? "Contracts Summary"
      : `Contracts ${segment ? segment[0].toUpperCase() + segment.slice(1) : "Summary"}`;
  return (
    <div
      className={styles.actions}
      data-comments-open={panel === "comments" || undefined}
    >
      <button
        type="button"
        className={styles.action}
        onClick={(event) => open("comments", event.currentTarget)}
      >
        <Icon name="chat" /> Comments
      </button>
      <button
        type="button"
        className={styles.action}
        onClick={(event) => open("audit", event.currentTarget)}
      >
        <Icon name="audits" /> Open Audit Trail
      </button>
      {panel && (
        <div
          className={`${styles.backdrop} ${panel === "comments" ? styles.commentsBackdrop : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <aside
            className={`${styles.drawer} ${panel === "comments" ? styles.commentsDrawer : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={panel === "comments" ? "Comments" : "Audit Trail"}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const controls = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), a[href], input:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
                ),
              ].filter((element) => element.getClientRects().length > 0);
              const first = controls[0];
              const last = controls.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <div
              className={`${styles.drawerHead} ${panel === "comments" ? styles.commentsHead : ""}`}
            >
              <h2>{panel === "comments" ? pageTitle : "Audit Trail"}</h2>
              <button
                ref={closeButton}
                type="button"
                className="gn-btn gn-btn--borderless gn-btn--icon"
                aria-label="Close drawer"
                onClick={close}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            {panel === "comments" ? (
              <ObjectComments
                key={`comments-${page}`}
                id="contract-comments-panel"
                {...props}
              />
            ) : (
              <ObjectAudit
                key={`audit-${page}`}
                id="contract-audit-panel"
                {...props}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
