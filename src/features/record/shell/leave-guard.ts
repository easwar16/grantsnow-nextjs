"use client";
import { useEffect, type RefObject } from "react";
import {
  DISCARD_DIALOG,
  inAppDestination,
  mustAsk,
  type LeaveGuard,
} from "@/features/modules/opportunities/eoi/unsaved";
import type { ConfirmOptions } from "@/components/dialog/action-dialog";

/**
 * A record's unsaved-changes exit gate (legacy beforeExit prompts): while the guard says there are changes, every
 * in-app link asks first and the browser asks on unload. `onDiscard` runs before the navigation it allowed.
 * ponytail: browser Back / Forward is not intercepted (App Router has no blocking API); add one when Next ships it.
 */
export function useLeaveGuard(
  guard: RefObject<LeaveGuard | null>,
  ask: (options: ConfirmOptions) => Promise<boolean>,
  go: (href: string) => void,
  onDiscard: () => void,
) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!mustAsk(guard.current)) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = inAppDestination(
        e,
        {
          href: link.href,
          target: link.target,
          download: link.hasAttribute("download"),
        },
        window.location,
      );
      if (href === null) return;
      // Window capture runs before React's document listeners, so the Link never sees the click.
      e.preventDefault();
      e.stopPropagation();
      void ask(DISCARD_DIALOG).then((discard) => {
        if (!discard) return;
        guard.current = null;
        onDiscard();
        go(href);
      });
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (mustAsk(guard.current)) e.preventDefault();
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [guard, ask, go, onDiscard]);
}
