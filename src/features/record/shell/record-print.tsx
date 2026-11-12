"use client";
import { ActionMenu } from "@/components/ui/action-menu";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { ApiResult } from "@/lib/api/http";

/** Legacy prints this one on the page itself (window print) rather than generating a report file. */
const PAGE_REPORT = "report-vbcs-ethics";

/**
 * A record's Print menu (legacy print menu button): each configured report, enabled as the server says; a generated
 * file is saved under the server's name.
 */
export function RecordPrint({
  id,
  label,
  options,
  generate,
}: {
  id: string;
  label: string;
  options: { code: string; label: string; enabled: boolean }[];
  generate: (
    code: string,
  ) => Promise<ApiResult<{ blob: Blob; filename: string }>>;
}) {
  const fail = useActionFailure();
  const { run, isActive } = useInFlight();
  if (options.length === 0) return null;
  const print = (code: string) =>
    void run(async () => {
      if (code === PAGE_REPORT) return window.print();
      const result = await generate(code);
      if (!result.ok) return fail(result.error);
      const url = URL.createObjectURL(result.data.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, "print");
  return (
    <ActionMenu
      id={id}
      label={label}
      icon="report"
      className="gn-btn gn-btn--outlined gn-btn--icon"
      disabled={isActive("print")}
      items={options.map((row) => ({
        key: row.code,
        label: row.label,
        disabled: !row.enabled,
        run: () => print(row.code),
      }))}
    />
  );
}
