"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dueDiligence, useApi } from "@/lib/api";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { State } from "@/components/feedback/state";
import { ListSkeleton } from "@/components/feedback/skeleton";

export function DueDiligenceReferenceLink({ id, access }: { id: string; access: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [objects, setObjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const types = useApi(dueDiligence.referenceTypes, open ? { id, access } : null);
  const items = useApi(dueDiligence.referenceItems, open && type ? { id, access, type } : null);
  async function submit() {
    if (!type || !objects.length || busy) return;
    setBusy(true); setError("");
    const result = await dueDiligence.linkReferences(id, access, type, objects);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setOpen(false); setType(""); setObjects([]); router.refresh();
  }
  return <>
    <button id="due-diligence-link-reference" type="button" className="gn-btn gn-btn--outlined"
      onClick={() => setOpen(true)}>Link</button>
    {open && <ActionDialog id="due-diligence-link-dialog" title="Link to reference" busy={busy} onClose={() => setOpen(false)}>
      {types.loading && <ListSkeleton />}
      {types.error && <State title="Reference types unavailable" message={types.error.message} code={types.error.code} retry={types.retry} />}
      <Select id="due-diligence-link-type" label="Reference type" options={types.data ?? []} value={type}
        onChange={(next) => { setType(next); setObjects([]); }} />
      {items.loading && <ListSkeleton />}
      {items.error && <State title="Reference records unavailable" message={items.error.message} code={items.error.code} retry={items.retry} />}
      <MultiSelect id="due-diligence-link-objects" label="Reference number" variant="control"
        options={items.data ?? []} value={objects} onChange={setObjects} disabled={!type || items.loading} />
      {error && <p role="alert">{error}</p>}
      <button id="due-diligence-link-submit" type="button" disabled={!type || !objects.length || busy}
        onClick={() => void submit()}>Submit</button>
    </ActionDialog>}
  </>;
}
