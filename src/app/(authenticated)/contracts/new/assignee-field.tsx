"use client";
import { useState } from "react";
import { loadContractAssignees } from "./actions";

export function AssigneeField({ label }: { label: string }) {
  const [choices, setChoices] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    if (loaded) return;
    setLoaded(true);
    try {
      setChoices(await loadContractAssignees());
    } catch {
      setError("Assigned To choices are unavailable.");
    }
  }
  return (
    <label>
      {label}
      <select name="assigned_to" defaultValue="" onFocus={load}>
        <option value="">Select Assigned To</option>
        {choices.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error && <span role="status">{error}</span>}
    </label>
  );
}
