"use client";
import { contracts } from "@/lib/api";
import { CreatorLink } from "@/features/record/shell/creator-link";

/** The summary's Created by as the shared creator link (the layout is a server component). */
export function ContractCreatedBy({ id, name }: { id: string; name: string }) {
  return (
    <CreatorLink
      id={`contract-${id}-created-by`}
      name={name}
      endpoint={contracts.creator}
      params={{ id }}
    />
  );
}
