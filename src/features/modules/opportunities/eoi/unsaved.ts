/** The unsaved-changes question (GN-Angular confirmDiscard, the original's oj-sp-message-unsaved-changes). */
export const DISCARD_DIALOG = {
  title: "Unsaved changes",
  message: "You have unsaved changes. Leave this page and discard them?",
  confirm: "Discard",
  cancel: "Stay",
  danger: true,
} as const;
/** A tab that may hold unsaved changes: `dirty` is read at the moment of leaving. */
export interface LeaveGuard {
  locked: boolean;
  dirty: () => boolean;
}
/** A locked page is read-only, so it never asks; otherwise ask only when the form differs from what was loaded. */
export const mustAsk = (guard: LeaveGuard | null) =>
  guard !== null && !guard.locked && guard.dirty();
export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}
/**
 * The in-app destination of a plain left click on a link, or null when the click is not an in-app navigation that
 * would leave this page: a modified click (new tab), another target, a download, another origin (beforeunload
 * covers those) or the same page.
 */
export function inAppDestination(
  click: ClickLike,
  link: { href: string; target: string; download: boolean },
  here: { origin: string; pathname: string; search: string },
) {
  if (
    click.defaultPrevented ||
    click.button !== 0 ||
    click.metaKey ||
    click.ctrlKey ||
    click.shiftKey ||
    click.altKey ||
    (link.target !== "" && link.target !== "_self") ||
    link.download
  )
    return null;
  let url: URL;
  try {
    url = new URL(link.href, here.origin);
  } catch {
    return null;
  }
  if (url.origin !== here.origin) return null;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return url.pathname + url.search + url.hash;
}
