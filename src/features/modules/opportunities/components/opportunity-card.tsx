"use client";
import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormatSettings } from "@/lib/format";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { OpportunityCardModel, OpportunityRow } from "../types";
import { canCreate } from "../display";
import { Icon } from "@/components/ui/icon";
import { preloadEditor } from "@/components/ui/rich-text";
import { useConfirm } from "../../../../components/dialog/action-dialog";
import { CommentsDialog } from "./actions/comments-dialog";
import {
  ConvertDialog,
  warmConvert,
  type ConvertKind,
} from "./actions/convert-dialog";
import { nearDeadline } from "./actions/duration";
import { NotesDialog } from "./actions/notes-dialog";
import { opportunities } from "@/lib/api";
import { useActionFailure } from "../../../../components/dialog/action-failure";
import { ShareDialog, warmShare } from "./actions/share-dialog";
import styles from "./opportunity-card.module.css";
import { functions } from "@/lib/functions";
const dateValue = {
  "publication-date": "published",
  "opening-date": "opening",
  "closing-date": "closing",
} as const;
/** formatDatesToString: each date of a comma-separated sponsor deadline list, formatted. */
const deadlineList = (raw: string, format?: FormatSettings) =>
  raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => functions.format.dateDisplay(d, format))
    .join(", ");
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
/** Memoised: a card re-renders only when its own row, card model or format changes, not on every finder click. */
export const OpportunityCard = memo(function OpportunityCard({
  row,
  card,
  format,
  idPrefix = "opportunity",
}: {
  row: OpportunityRow;
  card: OpportunityCardModel;
  /** @deprecated More Info now opens the detail page (`/opportunities/<id>`); this is ignored. */
  onMoreInfo?: (row: OpportunityRow) => void;
  format?: FormatSettings;
  /** Keeps the card's ids unique where another list shows the same opportunity. */
  idPrefix?: string;
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
  const id = `${idPrefix}-${o.id}`;
  const [open, setOpen] = useState<Open>(null),
    close = () => setOpen(null),
    { run, isActive } = useInFlight(),
    { ask, element: confirmation } = useConfirm(`${id}-deadline`),
    fail = useActionFailure(),
    router = useRouter();
  const counts = (
    [
      ["aoi-count", o.applications],
      ["proposals-count", o.proposals],
      ["outline-proposals-count", o.outlines],
    ] as const
  ).filter(([, n]) => n !== undefined);
  // The cells the card's gates show that have a value, in the original's order.
  const metaCells = card.meta.flatMap((cell) => {
    const value = o.meta?.[cell.key];
    return value === undefined ? [] : [{ ...cell, value }];
  });
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
      const result = await opportunities.bookmark(Number(o.id), next);
      if (!result.ok) return fail(result.error);
      patch({ bookmarked: next });
      opportunities.patchHeldRow(o.id, { bookmarked: next });
    }, "bookmark");
  // The original warns when the closing date is within OPP_DEADLINE_WARNING_DAYS, if enabled.
  const deadlineOk = () =>
    !nearDeadline(o.closingAt, actions.deadlineWarningDays) ||
    ask({
      title: labels["deadline-title"],
      message: labels["deadline-message"],
      detail: `${labels["closing-date"]}: ${functions.format.dateDisplay(o.closingAt, format)}`,
      confirm: labels.continue,
      cancel: labels.cancel,
    });
  const apply = () =>
    run(async () => {
      if (!(await deadlineOk())) return;
      // The server checks the gates; the application is created only on its form's Create.
      const result = await opportunities.apply({
        opportunityId: Number(o.id),
      });
      if (!result.ok) return fail(result.error);
      router.push(result.data.href);
    }, "apply");
  const warm = (kind: ConvertKind) => warmConvert(actions.opener, kind, o.id);
  const convert = (kind: ConvertKind) =>
    run(async () => {
      // The setup loads while the deadline warning is read.
      warm(kind);
      if (await deadlineOk()) setOpen({ dialog: "convert", kind });
    }, "convert");
  return (
    <article
      id={id}
      className={`opportunity-card ${styles.card}`}
      aria-label={o.title}
      data-status={o.status.toLowerCase()}
    >
      <div id={`${id}-heading`} className={styles.header}>
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
              <a
                id={`${id}-link`}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
              >
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
          {actions.moreInfo && (
            // More Info opens the opportunity's summary as a detail page (the original's isDetailPage).
            <Link
              id={`${id}-more-info`}
              className={styles.info}
              href={`/opportunities/${o.id}`}
              prefetch={false}
              aria-label={`${labels["more-info"]}: ${o.title}`}
            >
              <Icon name="info" />
            </Link>
          )}
        </div>
        <div id={`${id}-header-actions`} className={styles.headerActions}>
          {actions.status && o.status && (
            <span id={`${id}-status`} className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              {o.status}
            </span>
          )}
          <button
            type="button"
            id={`${id}-bookmark`}
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
              id={`${id}-share`}
              className={styles.iconButton}
              aria-label={labels.share}
              onPointerEnter={warmShare}
              onFocus={warmShare}
              onClick={() => setOpen({ dialog: "share" })}
            >
              <Icon name="share" />
            </button>
          )}
          {actions.comments && (
            <button
              type="button"
              id={`${id}-comments`}
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
              id={`${id}-notes`}
              className={`${styles.iconButton}${notesText ? ` ${styles.hasNotes}` : ""}`}
              aria-label={labels.notes}
              title={notesText || undefined}
              onPointerEnter={actions.notesEdit ? preloadEditor : undefined}
              onFocus={actions.notesEdit ? preloadEditor : undefined}
              onClick={() => setOpen({ dialog: "notes" })}
            >
              <Icon name="notes" />
            </button>
          )}
        </div>
      </div>
      {(o.site || o.funders?.length || o.coFunders?.length) && (
        <ul id={`${id}-tags`} className={styles.tags}>
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
        <div id={`${id}-details`} className={styles.details}>
          {metaCells.length > 0 && (
            <div id={`${id}-meta`} className={styles.meta}>
              {metaCells.map(({ key, label, kind, value }) => (
                <div key={key} id={`${id}-${key}`}>
                  <small>{label}</small>
                  {kind === "money" ? (
                    <strong>
                      {functions.format
                        .moneyDisplay(value, o.currency, format)
                        .replace(/\.00$/, "")}
                    </strong>
                  ) : kind === "date" ? (
                    functions.format.dateDisplay(value, format)
                  ) : (
                    value
                  )}
                </div>
              ))}
            </div>
          )}
          {card.dates.length > 0 && (
            <div id={`${id}-dates`} className={styles.dates}>
              {card.dates.map((key) => {
                const value = o[dateValue[key]];
                return (
                  <div
                    key={key}
                    id={`${id}-${key}`}
                    className={
                      key === "closing-date" ? styles.closing : undefined
                    }
                  >
                    <small>{labels[key]}</small>
                    {value
                      ? key === "closing-date"
                        ? deadlineList(value, format)
                        : functions.format.dateDisplay(value, format)
                      : key === "closing-date"
                        ? labels["check-website"]
                        : labels["not-available"]}
                  </div>
                );
              })}
            </div>
          )}
          {counts.length > 0 && (
            <div id={`${id}-counts`} className={styles.counts}>
              {counts.map(([key, n]) => (
                <div key={key} id={`${id}-${key}`}>
                  <small>{labels[key]}</small>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        {(can.apply || can.convert || can.convertToProposal) && (
          <div id={`${id}-create-actions`} className={styles.actions}>
            {can.apply && (
              <button
                type="button"
                id={`${id}-apply`}
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
                id={`${id}-convert`}
                className={`${styles.action} ${styles.convert}`}
                disabled={isActive("convert") || open?.dialog === "convert"}
                onPointerEnter={() => warm("OUTLINE_PROPOSAL")}
                onFocus={() => warm("OUTLINE_PROPOSAL")}
                onClick={() => convert("OUTLINE_PROPOSAL")}
              >
                <Icon name="workflow" />
                {labels.convert}
              </button>
            )}
            {can.convertToProposal && (
              <button
                type="button"
                id={`${id}-convert-to-proposal`}
                className={`${styles.action} ${styles.convertProposal}`}
                disabled={isActive("convert") || open?.dialog === "convert"}
                onPointerEnter={() => warm("PROPOSAL")}
                onFocus={() => warm("PROPOSAL")}
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
          id={`${id}-notes-dialog`}
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
            opportunities.patchHeldRow(o.id, { notes });
            close();
          }}
          onClose={close}
        />
      )}
      {open?.dialog === "share" && (
        <ShareDialog
          id={`${id}-share-dialog`}
          opportunityId={o.id}
          heading={o.title}
          onClose={close}
        />
      )}
      {open?.dialog === "comments" && (
        <CommentsDialog
          id={`${id}-comments-dialog`}
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
          id={`${id}-convert-dialog`}
          opener={actions.opener}
          kind={open.kind}
          opportunityId={o.id}
          onClose={close}
        />
      )}
    </article>
  );
});
