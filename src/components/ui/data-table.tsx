"use client";
import { Fragment, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { functions } from "@/lib/functions";
import styles from "./data-table.module.css";

/** One column: its header, how a row renders in it, and optionally its footer (a totals row). */
export interface TableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row, depth: number) => ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  /** The cell names its row (`<th scope="row">`); in a tree, the first column always does. */
  rowHeader?: boolean;
  /** How many columns this cell spans in a row (legacy group rows); the columns it covers are not drawn. */
  span?: (row: Row, depth: number) => number;
  footer?: ReactNode;
}
/** One row action, drawn as an icon button in the pinned actions column; what it does is the parent's. */
export interface TableAction<Row> {
  id: string;
  icon: IconName;
  /** The button's accessible name for this row (e.g. "Edit Jane Doe"). */
  label: (row: Row) => string;
  /** The tooltip, when shorter than the label (e.g. "Edit"). */
  title?: string;
  size?: number;
  onClick: (row: Row) => void;
  disabled?: (row: Row) => boolean;
  hidden?: (row: Row) => boolean;
  /** The button's classes when not the default borderless icon button (e.g. a bordered `gn-btn gn-btn--icon`). */
  className?: string;
}

/**
 * The app's table (owner, 2026-10-29): flat or hierarchical, from columns and rows; every operation stays with the
 * parent (actions call back, cells render what the parent gives). Rows keep stable ids (`<id>-<key>`); actions sit
 * pinned at the row's end (`.gn-table-actions`); a tree's rows start expanded, as legacy's row expanders do.
 */
export function DataTable<Row>({
  id,
  rowIds = id,
  emptyId,
  label,
  columns,
  rows,
  rowKey,
  childrenOf,
  actions = [],
  actionCell,
  renderRow,
  actionsLabel = "Actions",
  actionsClassName,
  empty,
  height,
  rowClassName,
  rowLabel,
  indent,
  className,
}: {
  id: string;
  /** The prefix of row, action and empty-row ids (`<rowIds>-<key>`, `<rowIds>-empty`); the table's id by default. */
  rowIds?: string;
  /** The empty row's id, when several tables share one `rowIds` (`<rowIds>-empty` by default). */
  emptyId?: string;
  /** The table's accessible name. */
  label?: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** A row's children: given, the table is a tree. */
  childrenOf?: (row: Row) => Row[] | undefined;
  actions?: TableAction<Row>[];
  /** Extra content for a row's actions cell, after its action buttons (a row's menu, say). */
  actionCell?: (row: Row, depth: number) => ReactNode;
  /** The parent draws this row itself when it returns one (an inline editor in place of the row, say). */
  renderRow?: (row: Row, depth: number) => ReactNode;
  actionsLabel?: string;
  /** Extra class on the actions column's header and cells (a fixed width, centred buttons). */
  actionsClassName?: string;
  /** Shown in one full-width row when there are no rows. */
  empty?: ReactNode;
  /** The scroller's height (`.gn-table-scroll[data-height]`); omitted, the table does not scroll on its own. */
  height?: "default" | "short" | "tall" | "dialog" | "none";
  /** Level classes and the like, from the row and its depth (0 at the top). */
  rowClassName?: (row: Row, depth: number) => string | undefined;
  /** A tree row's name, for its expander's accessible name (the first cell's text when that is a string). */
  rowLabel?: (row: Row) => string;
  /** A tree's measured indent before the expander (or a leaf's gap); 19px per level by default. */
  indent?: (depth: number, leaf: boolean) => string;
  className?: string;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setClosed((c) => {
      const next = new Set(c);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const tree = childrenOf !== undefined;
  const hasActions = actions.length > 0 || actionCell !== undefined;
  const width = columns.length + (hasActions ? 1 : 0);
  const footed = columns.some((c) => c.footer !== undefined);
  const align = (c: TableColumn<Row>) =>
    c.align && c.align !== "start" ? styles[c.align] : "";

  const row = (r: Row, depth: number): ReactNode => {
    const key = rowKey(r),
      rid = `${rowIds}-${functions.ids.idPart(key)}`,
      kids = childrenOf?.(r) ?? [],
      open = !closed.has(key);
    const custom = renderRow?.(r, depth);
    if (custom != null) return <Fragment key={key}>{custom}</Fragment>;
    // The column index up to which earlier cells' spans already cover the row.
    let covered = 0;
    return (
      <Fragment key={key}>
        <tr
          id={rid}
          className={rowClassName?.(r, depth)}
          data-depth={tree ? depth : undefined}
          aria-level={tree ? depth + 1 : undefined}
        >
          {columns.map((c, i) => {
            if (i < covered) return null;
            const span = Math.max(c.span?.(r, depth) ?? 1, 1);
            covered = i + span;
            const Cell = c.rowHeader || (tree && i === 0) ? "th" : "td";
            const body = c.cell(r, depth);
            return (
              <Cell
                key={c.id}
                scope={Cell === "th" ? "row" : undefined}
                colSpan={span > 1 ? span : undefined}
                className={
                  `${align(c)} ${c.className ?? ""}`.trim() || undefined
                }
              >
                {tree && i === 0 ? (
                  <span
                    className={styles.node}
                    style={
                      indent && {
                        paddingInlineStart: indent(depth, kids.length === 0),
                      }
                    }
                  >
                    {kids.length > 0 ? (
                      <button
                        type="button"
                        id={`${rid}-toggle`}
                        className={styles.expander}
                        aria-expanded={open}
                        aria-label={
                          rowLabel?.(r) ??
                          (typeof body === "string" ? body : key)
                        }
                        onClick={() => toggle(key)}
                      >
                        <Icon name="caret-down" size={14} />
                      </button>
                    ) : (
                      <span className={styles.leaf} aria-hidden="true" />
                    )}
                    {body}
                  </span>
                ) : (
                  body
                )}
              </Cell>
            );
          })}
          {hasActions && (
            <td className={`gn-table-actions ${actionsClassName ?? ""}`.trim()}>
              {actions
                .filter((a) => !a.hidden?.(r))
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    id={`${rid}-${a.id}`}
                    className={
                      a.className ?? "gn-btn gn-btn--borderless gn-btn--icon"
                    }
                    aria-label={a.label(r)}
                    title={a.title ?? a.label(r)}
                    disabled={a.disabled?.(r)}
                    onClick={() => a.onClick(r)}
                  >
                    <Icon name={a.icon} size={a.size ?? 16} />
                  </button>
                ))}
              {actionCell?.(r, depth)}
            </td>
          )}
        </tr>
        {open && kids.map((k) => row(k, depth + 1))}
      </Fragment>
    );
  };

  const table = (
    <table
      id={id}
      className={`gn-table ${className ?? ""}`.trim()}
      aria-label={label}
      role={tree ? "treegrid" : undefined}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.id}
              scope="col"
              className={`${align(c)} ${c.className ?? ""}`.trim() || undefined}
            >
              {c.header}
            </th>
          ))}
          {hasActions && (
            <th
              scope="col"
              className={`gn-table-actions ${actionsClassName ?? ""}`.trim()}
            >
              <span className="sr-only">{actionsLabel}</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => row(r, 0))}
        {rows.length === 0 && empty !== undefined && (
          <tr>
            <td
              id={emptyId ?? `${rowIds}-empty`}
              className="gn-table-empty"
              colSpan={width}
            >
              {empty}
            </td>
          </tr>
        )}
      </tbody>
      {footed && (
        <tfoot>
          <tr>
            {columns.map((c) => (
              <td
                key={c.id}
                className={
                  `${align(c)} ${c.className ?? ""}`.trim() || undefined
                }
              >
                {c.footer}
              </td>
            ))}
            {hasActions && <td className="gn-table-actions" />}
          </tr>
        </tfoot>
      )}
    </table>
  );
  if (!height) return table;
  return (
    <div
      className="gn-table-scroll"
      data-height={height === "default" ? undefined : height}
    >
      {table}
    </div>
  );
}
