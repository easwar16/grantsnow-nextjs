"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi, type Endpoint } from "@/lib/api";
import type { ApiResult } from "@/lib/api/http";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { Select, type SelectOption } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { State } from "@/components/feedback/state";
import { ListSkeleton } from "@/components/feedback/skeleton";
import dialog from "@/components/dialog/dialog.module.css";

export type ReferenceLinkTexts = Record<
  "link" | "title" | "type" | "number" | "cancel" | "submit",
  string
>;
type Scope = { id: string; access: string };
/** The module's reference endpoints: the types, one type's records, and the LINK write. */
export interface ReferenceApi {
  types: Endpoint<Scope, SelectOption[]>;
  items: Endpoint<Scope & { type: string }, SelectOption[]>;
  link: (
    id: string,
    access: string,
    type: string,
    objects: string[],
  ) => Promise<ApiResult<unknown>>;
}

/** An application's Link to reference (legacy dialogLinkObject on the Ethics and Due Diligence detail pages). */
export function ReferenceLink({
  id,
  record,
  access,
  api,
  texts: t,
}: {
  /** The element id prefix (`<area>`), from the page. */
  id: string;
  record: string;
  access: string;
  api: ReferenceApi;
  texts: ReferenceLinkTexts;
}) {
  const router = useRouter();
  const fail = useActionFailure();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [objects, setObjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const scope = { id: record, access };
  const types = useApi(api.types, open ? scope : null);
  const items = useApi(api.items, open && type ? { ...scope, type } : null);
  const close = () => {
    setOpen(false);
    setType("");
    setObjects([]);
  };
  async function submit() {
    if (!type || objects.length === 0 || busy) return;
    setBusy(true);
    const result = await api.link(record, access, type, objects);
    setBusy(false);
    if (!result.ok) return fail(result.error);
    close();
    router.refresh();
  }
  return (
    <>
      <button
        id={`${id}-link-reference`}
        type="button"
        className="gn-btn gn-btn--outlined"
        onClick={() => setOpen(true)}
      >
        {t.link}
      </button>
      {open && (
        <ActionDialog
          id={`${id}-link-dialog`}
          title={t.title}
          busy={busy}
          onClose={close}
        >
          <div className={dialog.form}>
            {types.error ? (
              <State
                id={`${id}-link-types-error`}
                title={t.type}
                message={types.error.message}
                code={types.error.code}
                retry={types.retry}
              />
            ) : !types.data ? (
              <ListSkeleton />
            ) : (
              <Select
                id={`${id}-link-type`}
                label={t.type}
                options={types.data}
                value={type}
                onChange={(next) => {
                  setType(next);
                  setObjects([]);
                }}
              />
            )}
            {items.error ? (
              <State
                id={`${id}-link-items-error`}
                title={t.number}
                message={items.error.message}
                code={items.error.code}
                retry={items.retry}
              />
            ) : (
              <MultiSelect
                id={`${id}-link-objects`}
                label={t.number}
                variant="control"
                options={items.data ?? []}
                value={objects}
                onChange={setObjects}
                disabled={!type || items.loading}
              />
            )}
            <div className={dialog.foot}>
              <button
                id={`${id}-link-cancel`}
                type="button"
                className="gn-btn gn-btn--outlined"
                disabled={busy}
                onClick={close}
              >
                {t.cancel}
              </button>
              <button
                id={`${id}-link-submit`}
                type="button"
                className="gn-btn gn-btn--primary"
                disabled={!type || objects.length === 0 || busy}
                onClick={() => void submit()}
              >
                {t.submit}
              </button>
            </div>
          </div>
        </ActionDialog>
      )}
    </>
  );
}
