"use client";
import { useState } from "react";
import { download } from "@/lib/api/http";

export function DueDiligencePrint({ id, access, respondent, options }: {
  id: string; access: string; respondent: string;
  options: { code: string; label: string; enabled: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!options.length) return null;
  const print = async (code: string) => {
    setOpen(false); setBusy(true); setError("");
    if (code === "report-vbcs-ethics") {
      window.print();
      setBusy(false);
      return;
    }
    const result = await download(`/due-diligence/${id}/print`, undefined, { access, respondent, code });
    if (result.ok) {
      const url = URL.createObjectURL(result.data.blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = result.data.filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else setError(result.error.message);
    setBusy(false);
  };
  return <div id="due-diligence-print">
    <button type="button" className="gn-btn gn-btn--outlined" disabled={busy}
      aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {busy ? "Preparing…" : "Print"}
    </button>
    {open && <div role="menu" aria-label="Due Diligence reports">
      {options.map((row) => <button key={row.code} type="button" role="menuitem"
        disabled={!row.enabled || busy} onClick={() => void print(row.code)}>{row.label}</button>)}
    </div>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
