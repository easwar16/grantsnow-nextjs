"use client";
import { Suspense, use, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { firstDeepLink, type NavEntry } from "@/lib/unavailable-modules";
import { Icon } from "@/components/ui/icon";
import styles from "./navigation.module.css";
function current(path: string, href: string) {
  // Section roots own their sub-pages, except the finder, whose siblings are separate drawer entries.
  return path === href ||
    (href !== "/opportunities" && path.startsWith(`${href}/`))
    ? "page"
    : undefined;
}
/** The "new" dot (getOpportunitiesNewFlags); streamed, so a slow flag never holds the drawer. */
function NewDot({ flag }: { flag: Promise<boolean> }) {
  return use(flag) ? (
    <span className={styles.newDot} role="img" aria-label="New" />
  ) : null;
}
function Item({
  item,
  path,
  isNew,
}: {
  item: NavEntry;
  path: string;
  isNew: Promise<boolean>;
}) {
  const body = (
    <>
      <Icon name={item.icon} />
      <span className={styles.name}>{item.label}</span>
      {item.isNew && (
        <Suspense fallback={null}>
          <NewDot flag={isNew} />
        </Suspense>
      )}
    </>
  );
  if (item.external)
    return (
      <a
        id={`navigation-${item.id}`}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.item}
      >
        {body}
        <span className="sr-only"> (opens in new tab)</span>
        <Icon name="external-link" size={12} className={styles.end} />
      </a>
    );
  return (
    <Link
      id={`navigation-${item.id}`}
      href={item.href}
      prefetch={false}
      className={styles.item}
      aria-current={current(path, item.href)}
    >
      {body}
    </Link>
  );
}
function Group({
  item,
  path,
  isNew,
}: {
  item: NavEntry;
  path: string;
  isNew: Promise<boolean>;
}) {
  const children = item.children ?? [];
  // Opens on the page of one of its children; otherwise collapsed, as the original.
  const [open, setOpen] = useState(() =>
    children.some((child) => current(path, child.href) !== undefined),
  );
  return (
    <>
      <button
        id={`navigation-${item.id}`}
        type="button"
        className={styles.item}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={item.icon} />
        <span className={styles.name}>{item.label}</span>
        {item.isNew && (
          <Suspense fallback={null}>
            <NewDot flag={isNew} />
          </Suspense>
        )}
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size={12}
          className={styles.end}
        />
      </button>
      {open && (
        <ul
          id={`navigation-${item.id}-list`}
          className={`${styles.list} ${styles.children} enter-expand`}
        >
          {children.map((child) => (
            <li key={child.id}>
              <Item item={child} path={path} isNew={isNew} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
/** Draws the server-filtered drawer; listing an entry grants nothing (each route checks access itself). */
export function Navigation({
  items,
  isNew,
}: {
  items: NavEntry[];
  isNew: Promise<boolean>;
}) {
  const path = usePathname();
  const split = items.findIndex((item) => item.id === firstDeepLink);
  const [main, deep] =
    split === -1 ? [items, []] : [items.slice(0, split), items.slice(split)];
  const list = (id: string, entries: NavEntry[]) => (
    <ul id={id} className={styles.list}>
      {entries.map((item) => (
        <li key={item.id}>
          {item.children ? (
            <Group item={item} path={path} isNew={isNew} />
          ) : (
            <Item item={item} path={path} isNew={isNew} />
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <nav id="navigation" aria-label="Main navigation" className={styles.nav}>
      {list("navigation-main", main)}
      {deep.length > 0 && (
        <>
          <hr className={styles.divider} />
          {list("navigation-deep-links", deep)}
        </>
      )}
    </nav>
  );
}
