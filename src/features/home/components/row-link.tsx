"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/feedback/toast";
import type { AttentionRow } from "../types";
/** Denial toast text: RB `error-msg.access-not-granted`, and the legacy fixed detail. */
export interface AccessDeniedText {
  summary: string;
  detail: string;
}
/** A queue record's link; Ethics records ask `/api/home/ethics-access` first, as legacy did. */
export function RowLink({
  row,
  denied,
  className,
  children,
}: {
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
      <Link className={className} href={row.href} prefetch={false}>
        {children}
      </Link>
    );
  async function open(event: React.MouseEvent<HTMLAnchorElement>) {
    // Every click waits for the check, new-tab clicks included, so a denied user is never routed.
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch("/api/home/ethics-access", {
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        }),
        body = await response.json();
      if (!response.ok)
        toast.error(
          body.error ?? { message: "Ethics access could not be checked." },
        );
      else if (body.allowed === true) router.push(row.href);
      else toast.show("error", denied.summary, denied.detail);
    } catch {
      toast.error({ message: "Ethics access could not be checked." });
    } finally {
      setChecking(false);
    }
  }
  return (
    <a
      className={className}
      href={row.href}
      aria-busy={checking || undefined}
      onClick={(event) => void open(event)}
    >
      {children}
    </a>
  );
}
