import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { CONTRACT_STATUS_TONE } from "@/features/modules/contracts/format";
import { FormSelect } from "@/components/ui/form-select";
import { Suspense } from "react";
import type { ContractQuery } from "@/features/modules/contracts/schema";
import {
  contractSearch,
  contractLevels,
} from "@/features/modules/contracts/schema";
import {
  canCreateContract,
  listContracts,
} from "@/server/modules/contracts/service";
import {
  contractSortChoices,
  contractTypeChoices,
  contractOrgChoices,
} from "@/server/modules/contracts/lookups";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { dateDisplay } from "@/lib/format";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { Icon } from "@/components/ui/icon";
import {
  label,
  resourceVisible,
  resources,
} from "@/server/platform/configuration/resources";
import styles from "./contracts.module.css";
import { ContractFilterForm } from "./contract-filter-form";

export function ContractFilters({ query }: { query: ContractQuery }) {
  return (
    <ContractFilterForm key={contractSearch(query)}>
      <input type="hidden" name="status" value={query.status} />
      <fieldset id="contracts-filter-levels" className={styles.levels}>
        <legend>Reference Object</legend>
        {contractLevels.map(([value, text]) => (
          <label key={value}>
            <input
              id={`contracts-filter-level-${value.toLowerCase()}`}
              type="checkbox"
              name="level"
              value={value}
              defaultChecked={query.level.split(",").includes(value)}
            />
            {text}
          </label>
        ))}
      </fieldset>
      <label className={styles.insideField}>
        <span>Contract Number</span>
        <input
          id="contracts-filter-number"
          name="number"
          defaultValue={query.number}
          aria-label="Contract Number"
          placeholder=" "
        />
      </label>
      <div className={styles.sortRow}>
        <Suspense
          fallback={
            <SelectLoading name="sort" title="Date Sort" value={query.sort} />
          }
        >
          <FilterSelect
            name="sort"
            title="Date Sort"
            value={query.sort}
            choices={contractSortChoices()}
          />
        </Suspense>
        <input type="hidden" name="direction" value={query.direction} />
        <button
          type="submit"
          id="contracts-filter-direction"
          className={styles.sortDirection}
          name="direction"
          value={query.direction === "DESC" ? "ASC" : "DESC"}
          aria-label={`Sort ${query.direction === "DESC" ? "ascending" : "descending"}`}
          title={`Sort ${query.direction === "DESC" ? "ascending" : "descending"}`}
        >
          <Icon
            name={
              query.direction === "DESC"
                ? "arrow-circle-down"
                : "arrow-circle-up"
            }
          />
        </button>
      </div>
      <Suspense
        fallback={
          <SelectLoading
            name="contractType"
            title="Contract Type"
            value={query.contractType}
          />
        }
      >
        <FilterSelect
          name="contractType"
          title="Contract Type"
          value={query.contractType}
          choices={contractTypeChoices()}
        />
      </Suspense>
      <Suspense
        fallback={
          <SelectLoading
            name="orgUnit"
            title="Org Unit"
            value={query.orgUnit}
          />
        }
      >
        <FilterSelect
          name="orgUnit"
          title="Org Unit"
          value={query.orgUnit}
          choices={contractOrgChoices()}
        />
      </Suspense>
      <label className={styles.insideField}>
        <span>Reference Object Number</span>
        <input
          id="contracts-filter-reference"
          name="referenceNumber"
          defaultValue={query.referenceNumber}
          aria-label="Reference Object Number"
          placeholder=" "
        />
      </label>
      <label className={styles.insideField}>
        <span>Start Date</span>
        <input
          id="contracts-filter-from"
          type="date"
          name="from"
          defaultValue={query.from}
          aria-label="Start Date"
        />
      </label>
      <label className={styles.insideField}>
        <span>End Date</span>
        <input
          id="contracts-filter-to"
          type="date"
          name="to"
          defaultValue={query.to}
          aria-label="End Date"
        />
      </label>
    </ContractFilterForm>
  );
}

type SelectProps = {
  name: "sort" | "contractType" | "orgUnit";
  title: string;
  value: string;
};
function SelectLoading({
  name,
  title,
  value,
  busy = true,
}: SelectProps & { busy?: boolean }) {
  return (
    <label
      className={`${styles.insideField} ${value ? "" : styles.emptySelect}`}
    >
      <span>{title}</span>
      <FormSelect
        id={`contracts-filter-${name}`}
        name={name}
        label={title}
        options={value ? [{ value, label: value }] : []}
        defaultValue={value}
        disabled
        busy={busy}
      />
    </label>
  );
}
async function FilterSelect({
  name,
  title,
  value,
  choices,
}: SelectProps & { choices: Promise<{ value: string; label: string }[]> }) {
  let options: { value: string; label: string }[];
  try {
    options = await choices;
  } catch {
    return (
      <>
        <SelectLoading name={name} title={title} value={value} busy={false} />
        <p className={styles.lookupError} role="status">
          {title} choices are unavailable.
        </p>
      </>
    );
  }
  return (
    <label
      className={`${styles.insideField} ${value ? "" : styles.emptySelect}`}
    >
      <span>{title}</span>
      {/* Keyed on the URL value, so Clear and back / forward show the query's choice. */}
      <FormSelect
        key={value}
        id={`contracts-filter-${name}`}
        name={name}
        label={title}
        options={options}
        defaultValue={value}
        submitOnChange
      />
    </label>
  );
}

export async function NewContractAction() {
  let canCreate: boolean;
  let rb: Awaited<ReturnType<typeof resources>>;
  try {
    [canCreate, rb] = await Promise.all([canCreateContract(), resources()]);
  } catch {
    return null;
  }
  return canCreate &&
    resourceVisible(rb, "contract", "button-labels", "listing-new-contract") ? (
    <Link
      id="contracts-new"
      href="/contracts/new"
      className={styles.newContract}
      prefetch={false}
    >
      <span aria-hidden="true">＋</span>
      {label(
        rb,
        "contract",
        "button-labels",
        "listing-new-contract",
        "New Contract",
      )}
    </Link>
  ) : null;
}

export async function ContractResults({ query }: { query: ContractQuery }) {
  let result;
  try {
    result = await listContracts(query);
  } catch (error) {
    const failure = publicError(error);
    return (
      <State
        title="Contracts unavailable"
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [format, rb] = await Promise.all([displayFormat(), resources()]);
  const metadata = (row: (typeof result.rows)[number]) =>
    [
      ["list-contract-type", "Contract Type", row.type],
      ["list-reference-object", "Reference Object", row.level],
      [
        "list-reference-object-number",
        "Reference Object Number",
        row.reference,
      ],
      ["list-start-date", "Start Date", dateDisplay(row.start, format)],
      ["list-end-date", "End Date", dateDisplay(row.end, format)],
      ["list-creation-date", "Created On", dateDisplay(row.created, format)],
      [
        "list-last-update-date",
        "Last Updated On",
        dateDisplay(row.updated, format),
      ],
      [
        "list-deadline-date",
        "Deadline Date",
        dateDisplay(row.deadline, format),
      ],
      ["list-org-unit", "Org Unit", row.organization],
      ["list-assigned-to", "Assigned To", row.assignedTo],
    ].filter(
      ([key, , value]) =>
        value &&
        value !== "—" &&
        resourceVisible(rb, "contract", "labels", key),
    );

  return (
    <>
      {result.rows.length === 0 ? (
        <div className={styles.empty} role="status">
          No contracts match these filters.
        </div>
      ) : (
        <div className={styles.cards}>
          {result.rows.map((row) => (
            <article
              className={styles.card}
              key={row.id}
              aria-label={`${row.number} ${row.title}`}
            >
              <div className={styles.overline}>
                <Icon name="data-document" />
                <strong>{row.number}</strong>
                {/* Legacy showed the badge on any code, so a code without a name gave an empty pill. */}
                {row.status && (
                  <StatusBadge tone={CONTRACT_STATUS_TONE[row.statusCode]}>
                    {row.status}
                  </StatusBadge>
                )}
              </div>
              <Link
                id={`contract-${row.id}-view`}
                className={styles.view}
                href={`/contracts/${row.id}`}
                aria-label={`View ${row.number}`}
                title="View contract"
                prefetch={false}
              >
                <Icon name="link" />
              </Link>
              <h2>
                <Link
                  id={`contract-${row.id}-title`}
                  href={`/contracts/${row.id}`}
                  prefetch={false}
                >
                  {row.title}
                </Link>
              </h2>
              <dl className={styles.metadata}>
                {metadata(row).map(([key, fallback, value]) => (
                  <div key={key}>
                    <dt>{label(rb, "contract", "labels", key, fallback)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
      <footer className={styles.pager}>
        <span>
          {result.total === undefined
            ? `${result.rows.length} loaded`
            : `${result.offset + result.rows.length} of ${result.total}`}
        </span>
        <div>
          {query.page > 1 && (
            <Link
              id="contracts-previous"
              href={`/contracts?${contractSearch({ ...query, page: query.page - 1 })}`}
            >
              Previous
            </Link>
          )}
          <span>Page {query.page}</span>
          {result.hasMore && (
            <Link
              id="contracts-next"
              href={`/contracts?${contractSearch({ ...query, page: query.page + 1 })}`}
            >
              Next
            </Link>
          )}
        </div>
      </footer>
    </>
  );
}
