import "server-only";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { attachmentsView } from "@/server/files/attachments";
import { AttachmentsPanel } from "./attachments-panel";
/** A host page's Attachments panel: the server-built view (labels, gates, limits), or why it is unavailable. */
export async function AttachmentsTab({
  host,
  record,
  id,
}: {
  /** A key of the server's host table (`eoi`). */
  host: string;
  record: string;
  /** The page-unique id prefix, e.g. `eoi-attachments`. */
  id: string;
}) {
  const result = await attachmentsView(
    new URLSearchParams({ host, record }),
    id,
  ).then(
    (view) => ({ view }),
    (error: unknown) => ({ error: publicError(error) }),
  );
  if ("error" in result)
    return (
      <State
        id={`${id}-error`}
        title="Attachments unavailable"
        message={result.error.message}
        action={result.error.action}
        code={result.error.code}
      />
    );
  return <AttachmentsPanel view={result.view} />;
}
