import { idPart } from "@/lib/ids";
import Image from "next/image";
import { SummaryActions } from "./summary-actions";
import type { SummaryActionContext, SummaryField, SummaryView } from "./types";
import styles from "./summary.module.css";
function Value({ field }: { field: SummaryField }) {
  if (field.html !== undefined)
    return (
      <dd
        id={`eoi-summary-${idPart(field.key.replace(/^summary-/, ""))}`}
        className={`${styles.text} announcement-content`}
        dangerouslySetInnerHTML={{ __html: field.html }}
      />
    );
  return (
    <dd
      id={`eoi-summary-${idPart(field.key.replace(/^summary-/, ""))}`}
      className={field.wide ? styles.text : undefined}
    >
      {field.href ? (
        <a href={field.href} target="_blank" rel="noopener noreferrer">
          {field.text}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      ) : (
        field.text
      )}
    </dd>
  );
}
/**
 * The record's Summary tab (GN-Angular eoi-summary): the opportunity's details, read-only; on More Info the actions
 * bar with Apply / Convert / Convert to Proposal. `view` null: no opportunity to show.
 */
export function Summary({
  view,
  empty,
  actionContext,
}: {
  view: SummaryView | null;
  empty: string;
  actionContext?: SummaryActionContext;
}) {
  if (!view)
    return (
      <p id="eoi-summary-empty" className={styles.empty}>
        {empty}
      </p>
    );
  const { actions } = view;
  const anyAction =
    actions.apply !== null ||
    actions.convert !== null ||
    actions.convertToProposal !== null;
  return (
    <div id="eoi-summary" className={`${styles.summary} enter-fade`}>
      {(view.closedMessage !== null || anyAction) && (
        <div id="eoi-summary-action-bar" className={styles.actionBar}>
          <span id="eoi-summary-closed" className={styles.closed}>
            {view.closedMessage}
          </span>
          {anyAction && actionContext && (
            <SummaryActions actions={actions} context={actionContext} />
          )}
        </div>
      )}
      <div className={styles.columns}>
        {/* The opportunity's source: logo, site, status and funders, on a tinted ground. */}
        <aside id="eoi-summary-side" className={styles.side}>
          {view.logo && (
            <Image
              className={styles.logo}
              src={view.logo}
              alt=""
              width={150}
              height={150}
              unoptimized
            />
          )}
          <dl className={styles.fields}>
            {view.side.map((f) => (
              <div key={f.key}>
                {f.label && <dt>{f.label}</dt>}
                <Value field={f} />
              </div>
            ))}
          </dl>
        </aside>
        <div id="eoi-summary-details" className={styles.details}>
          <h2 id="eoi-summary-heading" className={styles.heading}>
            {view.link ? (
              <a href={view.link} target="_blank" rel="noopener noreferrer">
                {view.heading}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            ) : (
              view.heading
            )}
          </h2>
          <dl className={`${styles.fields} ${styles.two}`}>
            {view.details.map((f) => (
              <div key={f.key} className={f.wide ? styles.wide : undefined}>
                <dt>{f.label}</dt>
                <Value field={f} />
              </div>
            ))}
          </dl>
          {view.counts.length > 0 && (
            <div id="eoi-summary-counts" className={styles.counts}>
              {view.counts.map((c) => (
                <span key={c.label}>
                  <span className={styles.countLabel}>{c.label}</span> {c.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
