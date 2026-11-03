"use client";
import {
  usePathname,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment,
} from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { saveBlob } from "@/features/record/dynamic-form/api";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claims } from "@/lib/api";
import {
  FUND_MODULE,
  FUND_TAB_DEFS,
  fundTabs,
  pageOf,
  parseFundRecordFilters,
  serializeFundRecordFilters,
  type FundRecordFilters,
  type FundTab,
} from "@/shared/claims/fund-record";
import type { FundShellModel } from "../types";
import styles from "./record.module.css";

const asTab = (segment: string | null): FundTab =>
  (fundTabs as readonly string[]).includes(segment ?? "")
    ? (segment as FundTab)
    : "summary";

/**
 * A fund's record (legacy claims-funds-inquiry-info-page): List, Export, the tabs, and the filter bar the Budget and
 * Claims tabs read (Status on Claims only). Funds Inquiry has no record panel, comments or audit trail.
 */
export function FundRecordShell({
  model,
  children,
}: {
  model: FundShellModel;
  children: React.ReactNode;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams(),
    tab = asTab(useSelectedLayoutSegment()),
    toast = useToast(),
    { run, isActive } = useInFlight();
  const { labels: t, filters: options } = model;
  const filters = parseFundRecordFilters(search);
  const query = serializeFundRecordFilters(filters);
  const href = (to: FundTab) =>
    `/claims/funds-inquiry/${model.appFundId}/${to}${query ? `?${query}` : ""}`;
  // Legacy's filters start on each list's first code.
  const shown = {
    func: filters.func || options.functions[0]?.value || "",
    object: filters.object || options.objects[0]?.value || "",
    status: filters.status || options.statuses[0]?.value || "",
  };
  const change = (key: keyof FundRecordFilters, value: string) => {
    const next = serializeFundRecordFilters({ ...filters, [key]: value });
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  };
  const exportable = model.canExport && tab !== "attachments";
  const exportReport = () =>
    run(async () => {
      const r = await claims.exportFund(model.appFundId, {
        tab,
        filters: Object.fromEntries(new URLSearchParams(query)),
      });
      if (!r.ok) return toast.error(r.error);
      saveBlob(r.data.blob, r.data.filename);
    }, "export");
  const select = (
    key: keyof FundRecordFilters,
    label: string,
    list: { value: string; label: string }[],
  ) => (
    <div className="gn-field">
      <label className="gn-label" htmlFor={`claims-fund-filter-${key}-trigger`}>
        {label}
      </label>
      <Select
        id={`claims-fund-filter-${key}`}
        label={label}
        options={list}
        value={shown[key]}
        clearable={false}
        onChange={(value) => change(key, value)}
      />
    </div>
  );
  return (
    <RecordFrame
      prefix="claims-fund"
      back={{ href: "/claims/funds-inquiry", label: t.list }}
      record={false}
      toolbarEnd={
        exportable && (
          <button
            type="button"
            id="claims-fund-export"
            className="gn-btn gn-btn--outlined"
            disabled={isActive("export")}
            onClick={exportReport}
          >
            <Icon name="download" size={14} />
            {t.export}
          </button>
        )
      }
      tabs={model.tabs.map((x) => ({
        key: x.tab,
        href: href(x.tab),
        name: x.name,
        icon: FUND_TAB_DEFS[x.tab].icon,
        finalized: false,
      }))}
      current={tab}
      panel={[]}
      finalize={null}
      objectType={FUND_MODULE}
      page={pageOf(tab)}
      labels={{
        comments: "",
        audit: null,
        auditTitle: "",
        close: "Close",
        finalize: "",
        finalized: "",
        tabs: t.tabs,
      }}
    >
      {(tab === "budget" || tab === "claims") && (
        <section
          id="claims-fund-filters"
          className={styles.filters}
          aria-label="Fund filters"
        >
          {select("func", t.func, options.functions)}
          {select("object", t.object, options.objects)}
          {tab === "claims" && select("status", t.status, options.statuses)}
        </section>
      )}
      {children}
    </RecordFrame>
  );
}
