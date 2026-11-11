"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { InsideField } from "@/components/ui/inside-field";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { dueDiligence, usePagedApi } from "@/lib/api";
import type { DueDiligenceParent } from "@/lib/api/endpoints/due-diligence";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { functions } from "@/lib/functions";
import { constants } from "@/lib/constants";
import listing from "@/components/ui/listing.module.css";
import dialog from "@/components/dialog/dialog.module.css";
import type { ParentDueDiligenceTexts } from "./model";
import styles from "./parent-due-diligence.module.css";

/**
 * A Proposal's or Award's Create and Link Due Diligence (legacy awards- / proposals-due-diligence and their
 * dialogLinkDueDiligence): the records in the user's view, filtered by number and description as each field is
 * committed, loading more on scroll; each row links at once, and the server keeps the record's other references.
 */
export function ParentDueDiligence({
  id,
  parent,
  canCreate,
  canLink,
  texts: t,
}: {
  /** The element id prefix (`<area>`), from the page. */
  id: string;
  parent: DueDiligenceParent;
  canCreate: boolean;
  canLink: boolean;
  texts: ParentDueDiligenceTexts;
}) {
  const router = useRouter();
  const toast = useToast();
  const fail = useActionFailure();
  const { run, isActive } = useInFlight();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [filters, setFilters] = useState({ number: "", title: "" });
  const found = usePagedApi(
    dueDiligence.linkCandidates,
    open ? { ...parent, ...filters } : null,
  );
  const busy = found.rows.some((row) => isActive(row.id));
  const close = () => setOpen(false);
  const link = (setupFlowId: string) =>
    void run(async () => {
      const result = await dueDiligence.link(parent, setupFlowId);
      if (!result.ok) return fail(result.error);
      close();
      if (result.data.alreadyLinked)
        return toast.show("warning", t.alreadyLinked);
      toast.show("success", t.linked);
      router.refresh();
    }, setupFlowId);
  // oj-input-text commits its value on blur or Enter; the list filters then.
  const commit = () => setFilters({ number, title });
  const createUrl = new URLSearchParams({
    parentType: parent.type,
    parentId: parent.id,
    ...(parent.proposalType ? { proposalType: parent.proposalType } : {}),
  });
  if (!canCreate && !canLink) return null;
  return (
    <div id={`${id}-dd-actions`} className={styles.actions}>
      <div className={styles.create}>
        {canCreate && (
          <Link
            id={`${id}-dd-create`}
            className="gn-btn gn-btn--primary"
            href={`/due-diligence/new?${createUrl}`}
          >
            <Icon name="inbox-add" size={16} />
            {t.create}
          </Link>
        )}
      </div>
      {canLink && (
        <div className={styles.link}>
          <button
            id={`${id}-dd-link`}
            type="button"
            className="gn-btn gn-btn--outlined"
            onClick={() => setOpen(true)}
          >
            <Icon name="link" size={16} />
            {t.link}
          </button>
        </div>
      )}
      {open && (
        <ActionDialog
          id={`${id}-dd-link-dialog`}
          title={t.linkTitle}
          busy={busy}
          onClose={close}
        >
          <div className={dialog.form}>
            <div className={styles.filters}>
              <InsideField
                htmlFor={`${id}-dd-link-number`}
                label={t.number}
                filled={number !== ""}
              >
                <input
                  id={`${id}-dd-link-number`}
                  className="gn-control"
                  value={number}
                  maxLength={200}
                  onChange={(e) => setNumber(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => e.key === "Enter" && commit()}
                />
              </InsideField>
              <InsideField
                htmlFor={`${id}-dd-link-description`}
                label={t.description}
                filled={title !== ""}
              >
                <input
                  id={`${id}-dd-link-description`}
                  className="gn-control"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => e.key === "Enter" && commit()}
                />
              </InsideField>
            </div>
            {found.error && found.rows.length === 0 ? (
              <State
                id={`${id}-dd-link-error`}
                title={t.linkTitle}
                message={found.error.message}
                code={found.error.code}
                retry={found.retry}
              />
            ) : found.loading && found.rows.length === 0 ? (
              <ListSkeleton />
            ) : found.rows.length === 0 ? (
              <p id={`${id}-dd-link-empty`}>{t.noData}</p>
            ) : (
              <ul
                id={`${id}-dd-link-list`}
                className={styles.results}
                aria-busy={found.loading}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (
                    el.scrollTop + el.clientHeight >=
                    el.scrollHeight - constants.paging.loadMorePx
                  )
                    found.loadMore();
                }}
              >
                {found.rows.map((row) => {
                  const rid = `${id}-dd-link-${functions.ids.idPart(row.id)}`;
                  return (
                    <li key={row.id} id={rid} className={listing.row}>
                      <div className={listing.body}>
                        <div className={listing.overline}>
                          <Icon name="certification" size={14} />
                          <span className={listing.number}>{row.number}</span>
                          {row.status && (
                            <StatusBadge>{row.status}</StatusBadge>
                          )}
                        </div>
                        <span>{row.title}</span>
                        <span className={styles.secondary}>{row.org}</span>
                      </div>
                      <button
                        id={`${rid}-link`}
                        type="button"
                        className="gn-btn gn-btn--outlined"
                        disabled={busy}
                        onClick={() => link(row.id)}
                      >
                        <Icon name="link" size={14} />
                        {t.linkRow}
                      </button>
                    </li>
                  );
                })}
                {found.loadingMore && <ListSkeleton rows={1} />}
              </ul>
            )}
            <div className={dialog.foot}>
              <button
                id={`${id}-dd-link-cancel`}
                type="button"
                className="gn-btn gn-btn--outlined"
                onClick={close}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
