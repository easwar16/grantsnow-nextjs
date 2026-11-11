"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ethics, useApi } from "@/lib/api";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { State } from "@/components/feedback/state";
import { ListSkeleton } from "@/components/feedback/skeleton";

export function EthicsReferenceLink({ id, access }: { id: string; access: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [objects, setObjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const types = useApi(ethics.referenceTypes, open ? { id, access } : null);
  const items = useApi(ethics.referenceItems, open && type ? { id, access, type } : null);
  async function submit() {
    if (!type || !objects.length || busy) return;
    setBusy(true); setError("");
    const result = await ethics.linkReferences(id, access, type, objects);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setOpen(false); setType(""); setObjects([]); router.refresh();
  }
  return <>
    <button id="ethics-link-reference" type="button" className="gn-btn gn-btn--outlined" onClick={() => setOpen(true)}>Link</button>
    {open && <ActionDialog id="ethics-link-dialog" title="Link to reference" busy={busy} onClose={() => setOpen(false)}>
      {types.loading && <ListSkeleton />}
      {types.error && <State title="Reference types unavailable" message={types.error.message} code={types.error.code} retry={types.retry} />}
      <Select id="ethics-link-type" label="Reference type" options={types.data ?? []} value={type}
        onChange={(next) => { setType(next); setObjects([]); }} />
      {items.loading && <ListSkeleton />}
      {items.error && <State title="Reference records unavailable" message={items.error.message} code={items.error.code} retry={items.retry} />}
      <MultiSelect id="ethics-link-objects" label="Reference number" variant="control"
        options={items.data ?? []} value={objects} onChange={setObjects} disabled={!type || items.loading} />
      {error && <p role="alert">{error}</p>}
      <button id="ethics-link-submit" type="button" disabled={!type || !objects.length || busy} onClick={() => void submit()}>Submit</button>
    </ActionDialog>}
  </>;
}
