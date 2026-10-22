"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { dateDisplay, moneyDisplay, type FormatSettings } from "@/lib/format";
import { useInFlight } from "@/lib/use-in-flight";
import type { OpportunityCardModel, OpportunityRow } from "../types";
import { canCreate } from "../display";
import { Icon } from "@/components/ui/icon";
import { useConfirm } from "./actions/action-dialog";
import { CommentsDialog } from "./actions/comments-dialog";
import { ConvertDialog, type ConvertKind } from "./actions/convert-dialog";
import { nearDeadline } from "./actions/duration";
import { NotesDialog } from "./actions/notes-dialog";
import { callAction, useActionFailure } from "./actions/request";
import { ShareDialog } from "./actions/share-dialog";
import styles from "./opportunity-card.module.css";
const dateValue = {
  "publication-date": "published",
  "opening-date": "opening",
  "closing-date": "closing",
} as const;
type Open =
  | { dialog: "notes" | "share" | "comments" }
  | { dialog: "convert"; kind: ConvertKind }
  | null;
/** Notes tooltip text: the sanitised HTML without its tags (notesToPlainText). */
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
/** The one opportunity card for the finder and Home's Featured tab (D32), with GN-Angular's card actions. */
export function OpportunityCard({
  row,
  card,
  onMoreInfo,
  format,
}: {
  row: OpportunityRow;
  card: OpportunityCardModel;
  /** The finder's More Info; Home's card has none. */
  onMoreInfo?: (row: OpportunityRow) => void;
  format?: FormatSettings;
}) {
  const { labels, actions } = card;
  // Bookmark and notes saves patch this card in place (the original reloaded the list); a new row drops the patch.
  const [local, setLocal] = useState<{
    row: OpportunityRow;
    patch: Partial<Pick<OpportunityRow, "bookmarked" | "notes">>;
  }>({ row, patch: {} });
  const o = { ...row, ...(local.row === row ? local.patch : {}) };
  const patch = (change: typeof local.patch) =>
    setLocal((l) => ({
      row,
      patch: { ...(l.row === row ? l.patch : {}), ...change },
    }));
  const [open, setOpen] = useState<Open>(null),
    close = () => setOpen(null),
    { run, isActive } = useInFlight(),
    { ask, element: confirmation } = useConfirm(),
    fail = useActionFailure(),
    router = useRouter();
  const counts = (
    [
      ["aoi-count", o.applications],
      ["proposals-count", o.proposals],
      ["outline-proposals-count", o.outlines],
    ] as const
  ).filter(([, n]) => n !== undefined);
  const creatable = canCreate(o.status);
  const can = {
    apply: creatable && actions.apply && o.canApply === true,
    convert: creatable && actions.convert && o.canConvert === true,
    convertToProposal:
      creatable && actions.convertToProposal && o.canConvertToProposal === true,
  };
  const notesText = o.notes ? plainText(o.notes) : "";
  const toggleBookmark = () =>
    run(async () => {
      const next = !o.bookmarked;
      const result = await callAction("bookmark", {
        opportunityId: Number(o.id),
        bookmarked: next,
      });
      if (!result.ok) return fail(result.error);
      patch({ bookmarked: next });
    }, "bookmark");
  // The original warns when the closing date is within OPP_DEADLINE_WARNING_DAYS, if enabled.
  const deadlineOk = () =>
    !nearDeadline(o.closingAt, actions.deadlineWarningDays) ||
    ask({
      title: labels["deadline-title"],
      message: labels["deadline-message"],
      detail: `${labels["closing-date"]}: ${dateDisplay(o.closingAt, format)}`,
      confirm: labels.continue,
      cancel: labels.cancel,
    });
  const apply = () =>
    run(async () => {
      if (!(await deadlineOk())) return;
      const result = await callAction<{ requestId: string }>("apply", {
        opportunityId: Number(o.id),
      });
      if (!result.ok) return fail(result.error);
      router.push(`/opportunities/eoi/${result.data.requestId}`);
    }, "apply");
  const convert = (kind: ConvertKind) =>
    run(async () => {
      if (await deadlineOk()) setOpen({ dialog: "convert", kind });
    }, "convert");
  return (
    <article
      className={`opportunity-card ${styles.card}`}
      aria-label={o.title}
      data-status={o.status.toLowerCase()}
    >
      <div className="opportunity-card-heading">
        {o.logo ? (
          <Image
            className={styles.logo}
            src={o.logo}
            alt="Funder logo"
            width={34}
            height={34}
            unoptimized
          />
        ) : (
          <span className={styles.logoTile} aria-hidden="true">
            <Icon name="opportunity-logo" />
          </span>
        )}
        <div className={styles.titleRow}>
          <h3 className={styles.title}>
            {o.url ? (
              <a href={o.url} target="_blank" rel="noopener noreferrer">
                {o.title}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            ) : (
              o.title
            )}
          </h3>
          {actions.pills.new && o.isNew && (
            <span className={`${styles.pill} ${styles.pillNew}`}>
              {labels.new}
            </span>
          )}
          {actions.pills.closingSoon && o.closingSoon && (
            <span className={`${styles.pill} ${styles.pillWarn}`}>
              {labels["closing-soon"]}
            </span>
          )}
          {actions.moreInfo && onMoreInfo && (
            <button
              type="button"
              className={styles.info}
              aria-label={`${labels["more-info"]}: ${o.title}`}
              onClick={() => onMoreInfo(o)}
            >
              <Icon name="info" />
            </button>
          )}
        </div>
        <div className={styles.headerActions}>
          {actions.status && o.status && (
            <span className="opportunity-status">
              <span className={styles.badgeDot} aria-hidden="true" />
              {o.status}
            </span>
          )}
          <button
            type="button"
            className={`${styles.iconButton}${o.bookmarked ? ` ${styles.active}` : ""}`}
            aria-pressed={o.bookmarked}
            aria-label={o.bookmarked ? "Remove bookmark" : "Bookmark"}
            title={
              o.otherBookmarks
                ? `Bookmarked by: ${o.otherBookmarks}`
                : "Bookmark"
            }
            disabled={isActive("bookmark")}
            onClick={toggleBookmark}
          >
            <Icon name={o.bookmarked ? "bookmark-selected" : "bookmark"} />
          </button>
          {actions.share && (
            <button
              type="button"
              className={styles.iconButton}
              aria-label={labels.share}
              onClick={() => setOpen({ dialog: "share" })}
            >
              <Icon name="share" />
            </button>
          )}
          {actions.comments && (
            <button
              type="button"
              className={styles.comments}
              onClick={() => setOpen({ dialog: "comments" })}
            >
              <Icon name="chat" size={14} />
              {labels["share-comments"]}
              {o.shared?.comment && (
                <span className={styles.commentsCount}>1</span>
              )}
            </button>
          )}
          {actions.notes && (
            <button
              type="button"
              className={`${styles.iconButton}${notesText ? ` ${styles.hasNotes}` : ""}`}
              aria-label={labels.notes}
              title={notesText || undefined}
              onClick={() => setOpen({ dialog: "notes" })}
            >
              <Icon name="notes" />
            </button>
          )}
        </div>
      </div>
      {(o.site || o.funders?.length || o.coFunders?.length) && (
        <ul className={`opportunity-tags ${styles.tags}`}>
          {o.site && <li>{o.site}</li>}
          {o.funders?.map((funder, i) => (
            <li key={`f${i}`}>{funder}</li>
          ))}
          {o.coFunders?.map((funder, i) => (
            <li key={`c${i}`} className={styles.coFunder}>
              {funder}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.bottom}>
        <div className={styles.details}>
          {(o.fundingType || o.totalFund !== undefined) && (
            <div className="opportunity-financials">
              {o.fundingType && (
                <div>
                  <small>{labels["funding-type"]}</small>
                  {o.fundingType}
                </div>
              )}
              {o.totalFund !== undefined && (
                <div>
                  <small>{labels["total-fund"]}</small>
                  <strong>
                    {moneyDisplay(o.totalFund, o.currency, format).replace(
                      /\.00$/,
                      "",
                    )}
                  </strong>
                </div>
              )}
            </div>
          )}
          {card.dates.length > 0 && (
            <div className="opportunity-dates">
              {card.dates.map((key) => {
                const value = o[dateValue[key]];
                return (
                  <div key={key}>
                    <small>{labels[key]}</small>
                    {value
                      ? dateDisplay(value, format)
                      : key === "closing-date"
                        ? labels["check-website"]
                        : labels["not-available"]}
                  </div>
                );
              })}
            </div>
          )}
          {counts.length > 0 && (
            <div className="opportunity-counts">
              {counts.map(([key, n]) => (
                <div key={key}>
                  <small>{labels[key]}</small>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        {(can.apply || can.convert || can.convertToProposal) && (
          <div className={styles.actions}>
            {can.apply && (
              <button
                type="button"
                className={`${styles.action} ${styles.apply}`}
                disabled={isActive("apply")}
                onClick={apply}
              >
                <Icon name="chevron-double-right" />
                {labels.apply}
              </button>
            )}
            {can.convert && (
              <button
                type="button"
                className={`${styles.action} ${styles.convert}`}
                disabled={isActive("convert") || open?.dialog === "convert"}
                onClick={() => convert("OUTLINE_PROPOSAL")}
              >
                <Icon name="workflow" />
                {labels.convert}
              </button>
            )}
            {can.convertToProposal && (
              <button
                type="button"
                className={`${styles.action} ${styles.convertProposal}`}
                disabled={isActive("convert") || open?.dialog === "convert"}
                onClick={() => convert("PROPOSAL")}
              >
                <Icon name="workflow" />
                {labels["convert-to-proposal"]}
              </button>
            )}
          </div>
        )}
      </div>
      {confirmation}
      {open?.dialog === "notes" && (
        <NotesDialog
          opportunityId={o.id}
          heading={o.title}
          notes={o.notes ?? ""}
          editable={actions.notesEdit}
          texts={{
            title: labels["notes-title"],
            notes: labels.notes,
            save: labels.save,
            close: labels.close,
          }}
          onSaved={(notes) => {
            patch({ notes });
            close();
          }}
          onClose={close}
        />
      )}
      {open?.dialog === "share" && (
        <ShareDialog opportunityId={o.id} heading={o.title} onClose={close} />
      )}
      {open?.dialog === "comments" && (
        <CommentsDialog
          heading={o.title}
          shared={o.shared}
          texts={{
            title: labels["comments-title"],
            singular: labels["comment-singular"],
            plural: labels["comment-plural"],
            none: labels["no-share-comments"],
            close: labels.close,
          }}
          format={format}
          onClose={close}
        />
      )}
      {open?.dialog === "convert" && (
        <ConvertDialog
          opener={actions.opener}
          kind={open.kind}
          opportunityId={o.id}
          onClose={close}
        />
      )}
    </article>
  );
}
/** The More Info dialog both card lists share; the summary is sanitised on the server. */
export function OpportunityInformation({
  row,
  ref,
}: {
  row?: OpportunityRow;
  ref: React.Ref<HTMLDialogElement>;
}) {
  return (
    <dialog
      ref={ref}
      className="opportunity-information"
      aria-label="Opportunity information"
    >
      <button
        type="button"
        className="dialog-close"
        aria-label="Close opportunity information"
        onClick={(e) => e.currentTarget.closest("dialog")?.close()}
      >
        <Icon name="close" />
      </button>
      <h2>{row?.title}</h2>
      {row?.summary ? (
        <div
          className="announcement-content"
          dangerouslySetInnerHTML={{ __html: row.summary }}
        />
      ) : (
        <p>No additional summary was returned.</p>
      )}
      {row?.url && (
        <a href={row.url} target="_blank" rel="noopener noreferrer">
          View funder website
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      )}
    </dialog>
  );
}
