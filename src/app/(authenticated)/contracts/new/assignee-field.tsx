"use client";
import { FormSelect } from "@/components/ui/form-select";
import { useState } from "react";
import { contracts, useApi } from "@/lib/api";

export function AssigneeField({ label }: { label: string }) {
  const [reached, setReached] = useState(false);
  const { data, error, loading } = useApi(
    contracts.assignees,
    reached ? {} : null,
  );
  const load = () => setReached(true);
  return (
    <label>
      {label}
      {/* The people load when the field is first reached, as before. */}
      <span onFocusCapture={load} onPointerDownCapture={load}>
        <FormSelect
          id="contract-new-assigned-to"
          name="assigned_to"
          label={label}
          options={data ?? []}
          busy={reached && loading}
        />
      </span>
      {error && (
        <span id="contract-new-assigned-to-error" role="status">
          Assigned To choices are unavailable.
        </span>
      )}
    </label>
  );
}
