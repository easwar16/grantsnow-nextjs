"use client";

import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { proposals, useApi } from "@/lib/api";
import styles from "../proposal-record.module.css";

export function StaffContact({
  type,
  id,
  costHeaderId,
  versionId,
  name,
}: {
  type: string;
  id: string;
  costHeaderId: string;
  versionId: number | null;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const contact = useApi(
    proposals.staffContact,
    open ? { type, id, costHeaderId, versionId } : null,
  );
  const dialogId = `proposal-${id}-staff-contact-${costHeaderId}`;
  const fields = contact.data
    ? [
        ["Full Name", contact.data.fullName],
        ["Employee number", contact.data.employeeNumber],
        ["Email", contact.data.email],
        ["Org Unit", contact.data.orgUnit],
        ["Position", contact.data.position],
        ["School", contact.data.school],
        ["Address", contact.data.address],
      ]
    : [];
  return (
    <>
      <button
        type="button"
        id={`${dialogId}-open`}
        className={styles.budgetName}
        onClick={() => setOpen(true)}
      >
        {name}
      </button>
      {open && (
        <ActionDialog
          id={dialogId}
          title="Staff Details"
          width="51.576vw"
          onClose={() => setOpen(false)}
        >
          {contact.error ? (
            <State
              title="Staff details unavailable"
              message={contact.error.message}
              retry={contact.retry}
            />
          ) : !contact.data ? (
            <Skeleton kind="lines" count={7} label="Loading Staff details" />
          ) : (
            <div className={styles.staffContactFields}>
              {fields.map(([label, value], index) => (
                <div id={`${dialogId}-field-${index}`} key={label}>
                  <strong>{label}</strong>
                  <span>{value || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </ActionDialog>
      )}
    </>
  );
}
