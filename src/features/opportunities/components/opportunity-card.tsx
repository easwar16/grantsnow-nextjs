"use client";
import Image from "next/image";
import { dateDisplay, moneyDisplay, type FormatSettings } from "@/lib/format";
import type { OpportunityCardModel, OpportunityRow } from "../types";
import { Icon } from "@/components/ui/icon";
import styles from "./opportunity-card.module.css";
const dateValue = {
  "publication-date": "published",
  "opening-date": "opening",
  "closing-date": "closing",
} as const;
/** The one opportunity card for the finder and Home's Featured tab (D32). Reads only; no write actions yet. */
export function OpportunityCard({
  row,
  card,
  onMoreInfo,
  format,
}: {
  row: OpportunityRow;
  card: OpportunityCardModel;
  onMoreInfo: (row: OpportunityRow) => void;
  format?: FormatSettings;
}) {
  const { labels } = card;
  const counts = (
    [
      ["aoi-count", row.applications],
      ["proposals-count", row.proposals],
      ["outline-proposals-count", row.outlines],
    ] as const
  ).filter(([, n]) => n !== undefined);
  return (
    <article className="opportunity-card" aria-label={row.title}>
      <div className="opportunity-card-heading">
        {row.logo && (
          <Image src={row.logo} alt="" width={36} height={36} unoptimized />
        )}
        <h3 className={styles.title}>
          {row.url ? (
            <a href={row.url} target="_blank" rel="noopener noreferrer">
              {row.title}
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          ) : (
            row.title
          )}
        </h3>
        <button
          type="button"
          className="icon-button"
          aria-label={`${labels["more-info"]}: ${row.title}`}
          onClick={() => onMoreInfo(row)}
        >
          ⓘ
        </button>
        <span className="opportunity-status">● {row.status}</span>
      </div>
      {(row.site || row.funders?.length || row.coFunders?.length) && (
        <ul className={`opportunity-tags ${styles.tags}`}>
          {row.site && <li>{row.site}</li>}
          {row.funders?.map((funder, i) => (
            <li key={`f${i}`}>{funder}</li>
          ))}
          {row.coFunders?.map((funder, i) => (
            <li key={`c${i}`} className={styles.coFunder}>
              {funder}
            </li>
          ))}
        </ul>
      )}
      {(row.fundingType || row.totalFund !== undefined) && (
        <div className="opportunity-financials">
          {row.fundingType && (
            <div>
              <small>{labels["funding-type"]}</small>
              {row.fundingType}
            </div>
          )}
          {row.totalFund !== undefined && (
            <div>
              <small>{labels["total-fund"]}</small>
              <strong>
                {moneyDisplay(row.totalFund, row.currency, format).replace(
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
            const value = row[dateValue[key]];
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
