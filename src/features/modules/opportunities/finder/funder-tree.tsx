"use client";
import { idPart } from "@/lib/ids";
import { useState, memo } from "react";
import { Icon } from "@/components/ui/icon";
import { isSite, toggleFunder, toggleSite, type SiteNode } from "./funders";
import { MAX_FUNDER_KEYS, type FunderKey } from "./state";
import styles from "./funder-tree.module.css";
/** The Filter By Funders tree: sites with tri-state boxes, expandable to their funders (GN-Angular funder-tree). */
/** Memoised: hundreds of rows, re-rendered only when its nodes, selection or search change. */
export const FunderTree = memo(function FunderTree({
  id,
  nodes,
  selected,
  searching,
  label,
  onChange,
  onTooMany,
}: {
  /** Prefixes each node's id: `<id>-<site>`, `<id>-<site>-<funder>`; idPart keeps these from clashing. */
  id: string;
  nodes: SiteNode[];
  selected: FunderKey[];
  /** While searching, every remaining site shows its funders. */
  searching: boolean;
  label: string;
  onChange: (next: FunderKey[]) => void;
  /** A selection past MAX_FUNDER_KEYS, refused; the controlled box stays as it was. */
  onTooMany: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const emit = (next: FunderKey[]) =>
    next.length > MAX_FUNDER_KEYS ? onTooMany() : onChange(next);
  const siteChecked = (n: SiteNode) => selected.some((k) => isSite(k, n.site));
  const sitePartial = (n: SiteNode) =>
    !siteChecked(n) &&
    selected.some((k) => k.site === n.site && k.funder !== null);
  const funderChecked = (n: SiteNode, f: string) =>
    siteChecked(n) || selected.some((k) => k.site === n.site && k.funder === f);
  const isOpen = (n: SiteNode) => searching || expanded.has(n.site);
  const toggleOpen = (site: string) =>
    setExpanded((all) => {
      const next = new Set(all);
      if (!next.delete(site)) next.add(site);
      return next;
    });
  return (
    <ul id={id} className={styles.tree} role="tree" aria-label={label}>
      {nodes.map((node) => {
        const site = `${id}-${idPart(node.site)}`;
        return (
          <li
            key={node.site}
            id={site}
            role="treeitem"
            aria-selected={siteChecked(node)}
            aria-expanded={node.funders.length ? isOpen(node) : undefined}
          >
            <div className={styles.row}>
              {node.funders.length ? (
                <button
                  type="button"
                  id={`${site}-toggle`}
                  className={styles.twisty}
                  data-open={isOpen(node)}
                  aria-label={`${isOpen(node) ? "Collapse" : "Expand"} ${node.label}`}
                  onClick={() => toggleOpen(node.site)}
                >
                  <Icon name="chevron-right" size={14} />
                </button>
              ) : (
                <span className={styles.twisty} />
              )}
              <label>
                <input
                  id={`${site}-check`}
                  type="checkbox"
                  checked={siteChecked(node)}
                  ref={(box) => {
                    if (box) box.indeterminate = sitePartial(node);
                  }}
                  onChange={(e) =>
                    emit(toggleSite(selected, node, e.target.checked))
                  }
                />
                <span className={styles.text} title={node.label}>
                  {node.label}
                </span>
              </label>
            </div>
            {node.funders.length > 0 && (
              <div className="gn-collapse" data-open={isOpen(node)}>
                <ul id={`${site}-funders`} role="group" inert={!isOpen(node)}>
                  {node.funders.map((f) => (
                    <li
                      key={f}
                      id={`${site}-${idPart(f)}`}
                      role="treeitem"
                      aria-selected={funderChecked(node, f)}
                      className={`${styles.row} ${styles.child}`}
                    >
                      <label>
                        <input
                          id={`${site}-${idPart(f)}-check`}
                          type="checkbox"
                          checked={funderChecked(node, f)}
                          onChange={(e) =>
                            emit(
                              toggleFunder(selected, node, f, e.target.checked),
                            )
                          }
                        />
                        <span className={styles.text} title={f}>
                          {f}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
});
