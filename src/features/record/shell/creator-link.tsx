"use client";
import { useState } from "react";
import type { Endpoint } from "@/lib/api";
import { CreatorDialog } from "./creator-dialog";
import type { CreatorCard } from "./creator-types";

/** Every module's Created by (legacy createdByClick): the creator's name as a link to their contact card. */
export function CreatorLink<P>({
  id,
  name,
  endpoint,
  params,
}: {
  /** The link's id; the dialog takes `${id}-card`. */
  id: string;
  name: React.ReactNode;
  endpoint: Endpoint<P, CreatorCard>;
  params: P;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        id={id}
        className="gn-link"
        onClick={() => setOpen(true)}
      >
        {name}
      </button>
      {open && (
        <CreatorDialog
          id={`${id}-card`}
          endpoint={endpoint}
          params={params}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
