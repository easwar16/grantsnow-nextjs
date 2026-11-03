"use client";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { HelpButton } from "@/components/ui/help-button";
import { drawer as slide } from "@/lib/motion";
import { ObjectAudit } from "@/features/record/objects/audit";
import { ObjectComments } from "@/features/record/objects/comments";
import { columnPlace } from "./panel-layout";
import { CreatorLink } from "./creator-link";
import type { CreatorCard } from "./creator-types";
import type { Endpoint } from "@/lib/api";
import styles from "./record-frame.module.css";

export interface FrameTab {
  key: string;
  href: string;
  name: string;
  icon: IconName;
  finalized: boolean;
}
export interface FrameCell {
  key: string;
  label: string;
  value: React.ReactNode;
  tone?: StatusTone;
  /** The value opens this record (a parent proposal). */
  href?: string;
  /** The value is the record's creator: a link to their contact card (legacy createdByClick). */
  creator?: boolean;
  /** The label's More Info text (sanitised on the server). */
  help?: string | null;
}
export interface FrameLabels {
  comments: string;
  /** null hides the Audit Trail button (its RB gate). */
  audit: string | null;
  auditTitle: string;
  close: string;
  finalize: string;
  finalized: string;
  tabs: string;
}

/**
 * A record page (legacy *-detail-page, GN-Angular eoi-record): List, the host's toolbar around Comments and Audit
 * Trail, the tab bar, the record panel with its Finalize checkbox, the routed tab, and the comments / audit end drawer
 * for the current page. `prefix` names every part (`<prefix>-tabs`, `<prefix>-panel`…), so each record keeps its ids.
 * `record` false (a new record) hides the panel and the drawers.
 */
export function RecordFrame<P>({
  prefix,
  back,
  toolbarStart,
  toolbarEnd,
  record,
  panelColumns = 2,
  tabs,
  current,
  panel,
  finalize,
  objectType,
  objectId,
  page,
  labels,
  creator,
  children,
}: {
  prefix: string;
  back: { href: string; label: string };
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  record: boolean;
  /** The record panel's columns, filled down each column as legacy's oj-form-layout (award max-columns 3, EOI 2). */
  panelColumns?: 2 | 3;
  tabs: FrameTab[];
  current: string;
  panel: FrameCell[];
  /** Where the `creator` cell's card is read (the host's own creator endpoint, which checks record access). */
  creator?: { endpoint: Endpoint<P, CreatorCard>; params: P };
  finalize: {
    on: boolean;
    busy: boolean;
    onChange: (on: boolean) => void;
  } | null;
  objectType: string;
  objectId?: string;
  /** The current tab's page name: the drawer's comments and audit are per page. */
  page: string;
  labels: FrameLabels;
  children: React.ReactNode;
}) {
  // A mention notification links with `comment-id`: the comments drawer opens on it (legacy HandleMentionDeepLinkChain).
  const commentLink = useSearchParams().has("comment-id"),
    [drawer, setDrawer] = useState<"comments" | "audit" | null>(
      commentLink ? "comments" : null,
    );
  const tabName = tabs.find((t) => t.key === current)?.name ?? "";
  const place = (i: number) =>
    columnPlace(i, panel.length + (finalize ? 1 : 0), panelColumns);
  const withDrawers = record && objectId !== undefined;
  const toggle = (which: "comments" | "audit") =>
    setDrawer((d) => (d === which ? null : which));
  return (
    <div id={prefix} className={`page-fill ${styles.record}`}>
      <div id={`${prefix}-page`} className={styles.page}>
        {/* The action bar and the tabs stay in place; the panel and the tab scroll beneath them. */}
        <div id={`${prefix}-head`} className={styles.head}>
          <div id={`${prefix}-actions`} className={styles.actionBar}>
            <Link
              id={`${prefix}-back`}
              className="gn-btn gn-btn--outlined"
              href={back.href}
              prefetch={false}
            >
              <Icon name="arrow-left" size={14} />
              {back.label}
            </Link>
            <div id={`${prefix}-toolbar`} className={styles.toolbar}>
              {toolbarStart}
              {withDrawers && (
                <>
                  <button
                    type="button"
                    id={`${prefix}-comments`}
                    className={`gn-btn gn-btn--outlined${drawer === "comments" ? ` ${styles.active}` : ""}`}
                    aria-expanded={drawer === "comments"}
                    onClick={() => toggle("comments")}
                  >
                    <Icon name="chat" size={14} />
                    {labels.comments}
                  </button>
                  {labels.audit && (
                    <button
                      type="button"
                      id={`${prefix}-audit`}
                      className={`gn-btn gn-btn--outlined${drawer === "audit" ? ` ${styles.active}` : ""}`}
                      aria-expanded={drawer === "audit"}
                      onClick={() => toggle("audit")}
                    >
                      <Icon name="audits" size={14} />
                      {labels.audit}
                    </button>
                  )}
                </>
              )}
              {toolbarEnd}
            </div>
          </div>
          {tabs.length > 0 && (
            <nav
              id={`${prefix}-tabs`}
              className={styles.tabs}
              aria-label={labels.tabs}
            >
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  id={`${prefix}-tab-${t.key}`}
                  href={t.href}
                  prefetch={false}
                  className={t.key === current ? styles.selected : undefined}
                  aria-current={t.key === current ? "page" : undefined}
                  title={t.name}
                >
                  <Icon name={t.icon} size={16} />
                  <span className={styles.tabName}>{t.name}</span>
                  {t.finalized && (
                    <Icon
                      className={styles.finalized}
                      name="success"
                      size={14}
                      label={labels.finalized}
                    />
                  )}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div id={`${prefix}-body`} className={styles.body}>
          {record && (
            <dl
              id={`${prefix}-panel`}
              className={styles.panel}
              style={{ "--columns": panelColumns } as React.CSSProperties}
            >
              {panel.map((cell, i) => (
                <div
                  key={cell.key}
                  id={`${prefix}-panel-${cell.key}`}
                  style={place(i)}
                >
                  <dt>
                    {cell.label}
                    <HelpButton
                      id={`${prefix}-panel-${cell.key}-help`}
                      html={cell.help}
                    />
                  </dt>
                  <dd>
                    {cell.tone ? (
                      <StatusBadge tone={cell.tone}>{cell.value}</StatusBadge>
                    ) : cell.creator && creator ? (
                      <CreatorLink
                        id={`${prefix}-created-by`}
                        name={cell.value}
                        endpoint={creator.endpoint}
                        params={creator.params}
                      />
                    ) : cell.href ? (
                      <Link href={cell.href} prefetch={false}>
                        {cell.value}
                      </Link>
                    ) : (
                      cell.value
                    )}
                  </dd>
                </div>
              ))}
              {finalize && (
                <div style={place(panel.length)}>
                  <dt id={`${prefix}-finalize-label`}>{labels.finalize}</dt>
                  <dd>
                    <input
                      id={`${prefix}-finalize`}
                      type="checkbox"
                      className="gn-check"
                      aria-labelledby={`${prefix}-finalize-label`}
                      checked={finalize.on}
                      disabled={finalize.busy}
                      onChange={(e) =>
                        finalize.onChange(e.currentTarget.checked)
                      }
                    />
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div
            key={current}
            id={`${prefix}-content`}
            className={`${styles.content} enter-fade`}
          >
            {children}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {drawer && withDrawers && (
          <motion.aside
            {...slide}
            id={`${prefix}-drawer`}
            className={styles.drawer}
            aria-label={drawer === "audit" ? labels.auditTitle : tabName}
          >
            <div id={`${prefix}-drawer-head`} className={styles.drawerHead}>
              <h2>{drawer === "audit" ? labels.auditTitle : tabName}</h2>
              <button
                type="button"
                id={`${prefix}-drawer-close`}
                className="gn-btn gn-btn--borderless gn-btn--icon"
                aria-label={labels.close}
                onClick={() => setDrawer(null)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            {drawer === "comments" ? (
              <ObjectComments
                id={`${prefix}-comments-panel`}
                objectType={objectType}
                objectId={objectId}
                page={page}
              />
            ) : (
              <ObjectAudit
                id={`${prefix}-audit-panel`}
                objectType={objectType}
                objectId={objectId}
                page={page}
              />
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
