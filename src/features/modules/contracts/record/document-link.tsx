"use client";
import { contracts } from "@/lib/api";

/** A Contract Document download link (the summary is a server component). */
export function DocumentLink({
  id,
  kind,
  children,
}: {
  id: string;
  kind: "tags" | "template" | "contract";
  children: React.ReactNode;
}) {
  return (
    <a
      id={`contract-${id}-document-${kind}`}
      href={contracts.documentUrl(id, kind)}
    >
      {children}
    </a>
  );
}
