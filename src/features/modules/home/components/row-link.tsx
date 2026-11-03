"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/feedback/toast";
import { home, isOffline } from "@/lib/api";
import type { AttentionRow } from "../types";
/** Denial toast text: RB `error-msg.access-not-granted`, and the legacy fixed detail. */
export interface AccessDeniedText {
  summary: string;
  detail: string;
}
/** A queue record's link; Ethics records ask the Ethics access check first, as legacy did. */
export function RowLink({
  id,
  row,
  denied,
  className,
  children,
}: {
  id?: string;
  row: AttentionRow;
  denied: AccessDeniedText;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter(),
    toast = useToast(),
    [checking, setChecking] = useState(false);
  if (!row.ethics)
    return (
      <Link id={id} className={className} href={row.href} prefetch={false}>
        {children}
      </Link>
    );
  async function open(event: React.MouseEvent<HTMLAnchorElement>) {
    // Every click waits for the check, new-tab clicks included, so a denied user is never routed.
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    const r = await home.ethicsAccess(AbortSignal.timeout(30_000));
    setChecking(false);
    if (!r.ok)
      toast.error(
        isOffline(r)
          ? { message: "Ethics access could not be checked." }
          : r.error,
      );
    else if (r.data.allowed === true) router.push(row.href);
    else toast.show("error", denied.summary, denied.detail);
  }
  return (
    <a
      id={id}
      className={className}
      href={row.href}
      aria-busy={checking || undefined}
      onClick={(event) => void open(event)}
    >
      {children}
    </a>
  );
}
