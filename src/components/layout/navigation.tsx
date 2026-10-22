"use client";
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
function Item({ item, path }: { item: NavEntry; path: string }) {
  const className = item.id === firstDeepLink ? styles.deepLinks : undefined;
  if (item.external)
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <Icon name={item.icon} />
        {item.label}
        <span className="sr-only"> (opens in new tab)</span>
        <Icon name="external-link" size={12} className={styles.externalMark} />
      </a>
    );
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={className}
      aria-current={current(path, item.href)}
    >
      <Icon name={item.icon} />
      {item.label}
    </Link>
  );
}
/** Draws the server-filtered drawer; listing an entry grants nothing (each route checks access itself). */
export function Navigation({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation">
      {items.map((item) =>
        item.children ? (
          <details
            key={item.id}
            className="navigation-group"
            open={item.children.some(
              (child) => current(path, child.href) !== undefined,
            )}
          >
            <summary>
              <Icon name={item.icon} /> {item.label}
            </summary>
            <div>
              {item.children.map((child) => (
                <Item key={child.id} item={child} path={path} />
              ))}
            </div>
          </details>
        ) : (
          <Item key={item.id} item={item} path={path} />
        ),
      )}
    </nav>
  );
}
