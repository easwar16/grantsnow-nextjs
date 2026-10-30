"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { Skeleton } from "@/components/feedback/skeleton";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { proposals } from "@/lib/api";
import styles from "../proposal-record.module.css";

type Kind =
  | "quick"
  | "staff"
  | "student"
  | "pool-tech"
  | "non-staff"
  | "research-partner";
type Options = {
  versionId: number;
  sections: { value: string; label: string }[];
  roles: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  items: { category: string; value: string; label: string }[];
  people: { value: string; label: string }[];
};
type Row = {
  section: string;
  category: string;
  item: string;
  description: string;
  personId: string;
  startDate: string;
  endDate: string;
  units: string;
  cost: string;
};
const blank = (kind: Kind): Row => ({
  section: "",
  category: ["staff", "student", "pool-tech"].includes(kind) ? "STAFF" : "",
  item: kind === "student" ? "STUD" : kind === "pool-tech" ? "POOL_TECH" : "",
  description: "",
  personId: "",
  startDate: "",
  endDate: "",
  units: "1",
  cost: "",
});

export function CostingEditor({
  id,
  type,
  kind,
  label,
  disabled,
  icon,
}: {
  id: string;
  type: string;
  kind: Kind;
  label: string;
  disabled?: boolean;
  icon?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [rows, setRows] = useState<Row[]>([blank(kind)]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    if (loading || saving) return;
    setOpen(true);
    setLoading(true);
    setError("");
    setOptions(null);
    setRows([blank(kind)]);
    const result = await proposals.quickCostOptions(type, id, kind);
    if (result.ok) setOptions(result.data);
    else setError(result.error.message);
    setLoading(false);
  };
  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );
  const save = async () => {
    if (!options || saving) return;
    if (
      rows.some(
        (row) =>
          !row.section ||
          !row.category ||
          !row.item ||
          !row.startDate ||
          !row.endDate ||
          row.endDate < row.startDate ||
          !row.units ||
          Number(row.units) <= 0 ||
          (row.category === "STAFF"
            ? !row.personId
            : !row.description.trim() || row.cost === ""),
      )
    ) {
      setError("Complete each cost row before saving.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await proposals.saveQuickCost(type, id, {
      kind,
      versionId: options.versionId,
      rows: rows.map((row) => ({
        section: row.section,
        category: row.category,
        item: row.item,
        description: row.description,
        personId: row.personId ? Number(row.personId) : null,
        startDate: row.startDate,
        endDate: row.endDate,
        units: Number(row.units),
        cost: row.category === "STAFF" ? null : Number(row.cost),
      })),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <button
        id={`proposal-${id}-budget-${kind}-add`}
        type="button"
        className={styles.actionButton}
        disabled={disabled || loading || saving}
        onClick={() => void start()}
      >
        {icon && <Icon name={kind === "quick" ? "quick-cost" : "plus"} />}{" "}
        {label}
      </button>
      {open && (
        <ActionDialog
          id={`proposal-${id}-budget-${kind}-dialog`}
          title={label}
          onClose={() => !saving && setOpen(false)}
        >
          {loading ? (
            <Skeleton kind="lines" label="Loading costing options" />
          ) : options ? (
            <div className={styles.costEditor}>
              {rows.map((row, index) => (
                <fieldset
                  id={`proposal-${id}-budget-${kind}-row-${index}`}
                  key={index}
                >
                  <legend>Cost {index + 1}</legend>
                  <div className={styles.costEditorField}>
                    <label
                      htmlFor={`proposal-${id}-budget-${kind}-section-${index}-trigger`}
                    >
                      Funding section
                    </label>
                    <Select
                      id={`proposal-${id}-budget-${kind}-section-${index}`}
                      label="Funding section"
                      options={options.sections}
                      value={row.section}
                      onChange={(section) => update(index, { section })}
                      required
                    />
                  </div>
                  <div className={styles.costEditorField}>
                    <label
                      htmlFor={`proposal-${id}-budget-${kind}-category-${index}-trigger`}
                    >
                      Cost category
                    </label>
                    <Select
                      id={`proposal-${id}-budget-${kind}-category-${index}`}
                      label="Cost category"
                      options={options.categories.filter((category) =>
                        ["staff", "student", "pool-tech"].includes(kind)
                          ? category.value === "STAFF"
                          : kind === "non-staff"
                            ? !["STAFF", "IND"].includes(category.value)
                            : kind === "research-partner"
                              ? category.value !== "STAFF"
                              : true,
                      )}
                      value={row.category}
                      onChange={(category) =>
                        update(index, { category, item: "", description: "" })
                      }
                      required
                      disabled={["staff", "student", "pool-tech"].includes(
                        kind,
                      )}
                    />
                  </div>
                  <div className={styles.costEditorField}>
                    <label
                      htmlFor={`proposal-${id}-budget-${kind}-item-${index}-trigger`}
                    >
                      {row.category === "STAFF" ? "Project role" : "Cost item"}
                    </label>
                    <Select
                      id={`proposal-${id}-budget-${kind}-item-${index}`}
                      label={
                        row.category === "STAFF" ? "Project role" : "Cost item"
                      }
                      options={
                        row.category === "STAFF"
                          ? options.roles.filter((role) =>
                              kind === "student"
                                ? role.value === "STUD"
                                : kind === "pool-tech"
                                  ? role.value === "POOL_TECH"
                                  : true,
                            )
                          : options.items.filter(
                              (item) => item.category === row.category,
                            )
                      }
                      value={row.item}
                      onChange={(item) => update(index, { item })}
                      required
                    />
                  </div>
                  {row.category === "STAFF" ? (
                    <div className={styles.costEditorField}>
                      <label
                        htmlFor={`proposal-${id}-budget-${kind}-person-${index}-trigger`}
                      >
                        Person
                      </label>
                      <Select
                        id={`proposal-${id}-budget-${kind}-person-${index}`}
                        label="Person"
                        options={options.people}
                        value={row.personId}
                        onChange={(personId) => update(index, { personId })}
                        required
                      />
                    </div>
                  ) : (
                    <label>
                      Item description
                      <input
                        id={`proposal-${id}-budget-${kind}-description-${index}`}
                        value={row.description}
                        onChange={(event) =>
                          update(index, { description: event.target.value })
                        }
                        required
                      />
                    </label>
                  )}
                  <label>
                    Start date
                    <DateInput
                      id={`proposal-${id}-budget-${kind}-start-${index}`}
                      label="Start date"
                      value={row.startDate}
                      onChange={(startDate) => update(index, { startDate })}
                      required
                    />
                  </label>
                  <label>
                    End date
                    <DateInput
                      id={`proposal-${id}-budget-${kind}-end-${index}`}
                      label="End date"
                      value={row.endDate}
                      onChange={(endDate) => update(index, { endDate })}
                      required
                    />
                  </label>
                  <label>
                    Units
                    <input
                      id={`proposal-${id}-budget-${kind}-units-${index}`}
                      type="number"
                      min="0.01"
                      step="any"
                      value={row.units}
                      onChange={(event) =>
                        update(index, { units: event.target.value })
                      }
                      required
                    />
                  </label>
                  {row.category !== "STAFF" && (
                    <label>
                      {kind === "quick" ? "Baseline cost" : "Unit cost"}
                      <input
                        id={`proposal-${id}-budget-${kind}-cost-${index}`}
                        type="number"
                        min="0"
                        step="any"
                        value={row.cost}
                        onChange={(event) =>
                          update(index, { cost: event.target.value })
                        }
                        required
                      />
                    </label>
                  )}
                  {kind === "quick" && rows.length > 1 && (
                    <button
                      id={`proposal-${id}-budget-${kind}-remove-${index}`}
                      type="button"
                      onClick={() =>
                        setRows((current) =>
                          current.filter((_, at) => at !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </fieldset>
              ))}
              {kind === "quick" && (
                <button
                  id={`proposal-${id}-budget-${kind}-add-line`}
                  type="button"
                  className={styles.actionButton}
                  onClick={() =>
                    setRows((current) => [...current, blank(kind)])
                  }
                >
                  <Icon name="plus" /> Add
                </button>
              )}
              <div className={styles.costEditorActions}>
                <button
                  id={`proposal-${id}-budget-${kind}-save`}
                  type="button"
                  className={styles.actionButton}
                  disabled={saving}
                  onClick={() => void save()}
                >
                  <Icon name="save" /> {saving ? "Saving…" : "Save"}
                </button>
                <button
                  id={`proposal-${id}-budget-${kind}-cancel`}
                  type="button"
                  className={styles.actionButton}
                  disabled={saving}
                  onClick={() => setOpen(false)}
                >
                  <Icon name="cancel" /> Cancel
                </button>
              </div>
            </div>
          ) : null}
          {error && <p role="alert">{error}</p>}
        </ActionDialog>
      )}
    </>
  );
}
