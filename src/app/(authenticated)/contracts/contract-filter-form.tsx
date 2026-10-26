"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import styles from "./contracts.module.css";

export function ContractFilterForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <form
      id="contracts-filter-form"
      action="/contracts"
      className={styles.form}
      onChange={(event) => {
        if (
          event.target instanceof HTMLInputElement &&
          event.target.type === "text"
        )
          return;
        if (event.currentTarget.checkValidity())
          event.currentTarget.requestSubmit();
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement &&
          event.target.type === "text"
        ) {
          event.preventDefault();
          if (event.currentTarget.checkValidity())
            event.currentTarget.requestSubmit();
        }
      }}
    >
      <button id="contracts-apply-filters" type="submit" className="sr-only">
        Apply filters
      </button>
      {children}
      <div id="contracts-filter-actions" className={styles.filterActions}>
        <button
          id="contracts-clear-filters"
          type="button"
          onClick={(event) => {
            event.currentTarget.form?.reset();
            router.push("/contracts");
          }}
        >
          <Icon name="reset-filters" />
          Clear
        </button>
      </div>
    </form>
  );
}
