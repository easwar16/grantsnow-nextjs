"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { DynamicForm } from "@/features/record/dynamic-form/dynamic-form";
import { AWARD_MODULE } from "@/shared/awards/award-record";
import type { MilestonesView } from "./installments-types";
import styles from "./tabs.module.css";

/**
 * The Milestones tab (legacy awards-milestones, kept as is): the table is never filled, and Add Milestone opens the
 * AWARDS-MILESTONES dynamic form, whose Submit has no action in legacy, so nothing is saved here either.
 */
export function MilestonesTab({ view }: { view: MilestonesView }) {
  const t = view.texts;
  const [open, setOpen] = useState(false);
  return (
    <div id="award-record-milestones" className={styles.tab}>
      <div className={styles.milestoneActions}>
        <button
          type="button"
          id="award-milestones-add"
          className="gn-btn gn-btn--outlined"
          disabled={!view.canAdd}
          onClick={() => setOpen(true)}
        >
          <Icon name="add-level" size={14} />
          {t.add}
        </button>
      </div>
      <div className="gn-table-scroll">
        <table id="award-milestones-table" className="gn-table">
          <thead>
            <tr>
              <th scope="col">{t.description}</th>
              <th scope="col">{t.date}</th>
              <th scope="col">{t.amount}</th>
              <th scope="col">{t.status}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                id="award-milestones-empty"
                colSpan={4}
                className="gn-table-empty"
              >
                {t.noData}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {open && (
        <ActionDialog
          id="award-milestone-dialog"
          title={t.dialogTitle}
          onClose={() => setOpen(false)}
        >
          <DynamicForm
            objectType={AWARD_MODULE}
            slot="AWARDS-MILESTONES"
            parentId={view.awardId}
            objectId={view.awardId}
            objectNumber={view.number}
            editable
            hideEmpty
          />
          <div className={styles.milestoneFoot}>
            {/* Legacy's Submit has no action bound. */}
            <button
              type="button"
              id="award-milestone-submit"
              className="gn-btn gn-btn--primary"
            >
              {t.submit}
            </button>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
