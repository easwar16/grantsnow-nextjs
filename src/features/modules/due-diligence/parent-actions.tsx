"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useToast } from "@/components/feedback/toast";
import { dueDiligence, useApi } from "@/lib/api";
import type { DueDiligenceParent } from "@/lib/api/endpoints/due-diligence";
import { Icon } from "@/components/ui/icon";
import styles from "./parent-actions.module.css";

/** Proposal/Award Create and Link controls; a LINK preserves references on the server. */
export function DueDiligenceParentActions({
  parent, canCreate, canLink, createLabel = "New DueDiligence Application",
}: {
  parent: DueDiligenceParent;
  canCreate: boolean;
  canLink: boolean;
  createLabel?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [filters, setFilters] = useState({ number: "", title: "", offset: 0 });
  const [busy, setBusy] = useState(false);
  const candidates = useApi(dueDiligence.linkCandidates,
    open ? { ...parent, ...filters } : null);
  const link = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const result = await dueDiligence.link(parent, id);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    if (result.data.alreadyLinked) {
      toast.show("warning", "This Due Diligence record is already linked.");
      return;
    }
    setOpen(false);
    toast.show("success", "Due Diligence record linked.");
    router.refresh();
  };
  const createUrl = new URLSearchParams({
    parentType: parent.type, parentId: parent.id,
    ...(parent.proposalType ? { proposalType: parent.proposalType } : {}),
  });
  return (
    <div className={styles.actions}>
      {canCreate && <Link id="parent-due-diligence-create" className="gn-btn gn-btn--primary"
        href={`/due-diligence/new?${createUrl}`}><Icon name="inbox-add" size={16} />{createLabel}</Link>}
      {canLink && <button id="parent-due-diligence-link" type="button"
        className="gn-btn gn-btn--outlined" onClick={() => setOpen(true)}>
        Link Due Diligence
      </button>}
      {open && (
        <ActionDialog id="parent-due-diligence-dialog" title="Link Existing Due Diligence"
          busy={busy} onClose={() => setOpen(false)}>
          <form className={styles.filters} onSubmit={(e) => {
            e.preventDefault();
            setFilters({ number, title, offset: 0 });
          }}>
            <label>Number
              <input className="gn-control" value={number}
                onChange={(e) => setNumber(e.target.value)} maxLength={200} />
            </label>
            <label>Description
              <input className="gn-control" value={title}
                onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </label>
            <button type="submit" className="gn-btn gn-btn--outlined">Search</button>
          </form>
          {candidates.loading && <p>Loading Due Diligence records…</p>}
          {candidates.error && <p role="alert">{candidates.error.message}</p>}
          {candidates.data && (
            <>
              <ul id="parent-due-diligence-candidates" className={styles.results}>
                {candidates.data.rows.map((row) => (
                  <li key={row.id}>
                    <span>{row.number} — {row.title}</span>
                    <button type="button" disabled={busy}
                      onClick={() => void link(row.id)}>Link</button>
                  </li>
                ))}
              </ul>
              {!candidates.data.rows.length && <p>No Due Diligence records found.</p>}
              <div className={styles.paging}>
                <button type="button" disabled={filters.offset === 0 || busy}
                  onClick={() => setFilters((old) => ({
                    ...old, offset: Math.max(0, old.offset - 10),
                  }))}>Previous</button>
                <button type="button" disabled={!candidates.data.hasMore || busy}
                  onClick={() => setFilters((old) => ({
                    ...old, offset: old.offset + 10,
                  }))}>Next</button>
              </div>
            </>
          )}
        </ActionDialog>
      )}
    </div>
  );
}
