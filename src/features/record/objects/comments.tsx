"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { objects, useApi, type ApiResult } from "@/lib/api";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { MentionPerson } from "@/lib/mentions";
import {
  type CommentItem,
  type CommentsView,
  type ObjectPanelProps,
} from "./panel-types";
import styles from "./panels.module.css";

const Editor = dynamic(() => import("./comment-editor"), {
  ssr: false,
  loading: () => <Skeleton kind="lines" count={2} label="Loading editor" />,
});
const NO_PEOPLE: MentionPerson[] = [];
/**
 * A record page's comments (legacy `object-comments`): the page's thread, newest at the bottom, the user's own on
 * the brand side with Edit and Delete, and a rich-text input with @mentions. Writes need the page's edit right; the
 * server checks it and the comment's owner again.
 */
export function ObjectComments(props: ObjectPanelProps) {
  const { id } = props;
  const record = {
    objectType: props.objectType,
    objectId: props.objectId,
    page: props.page,
  };
  const { data, error, retry } = useApi<typeof record, CommentsView>(
    objects.comments,
    record,
  );
  const people = useApi(
    objects.mentionPeople,
    data?.canComment ? record : null,
  ).data;
  const toast = useToast();
  const { run, isActive, busy } = useInFlight();
  const [draft, setDraft] = useState<string | null>(null),
    [editing, setEditing] = useState<{
      item: CommentItem;
      html: string | null;
    } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  // Legacy scrolls the thread to its newest comment after every load.
  useEffect(() => {
    const el = list.current;
    if (el && data) el.scrollTop = el.scrollHeight;
  }, [data]);
  // A mention notification links here with `comment-id`; the comment scrolls into view and flashes.
  useEffect(() => {
    if (!data) return;
    const target = new URLSearchParams(window.location.search).get(
      "comment-id",
    );
    const item = target && data.items.find((c) => String(c.id) === target);
    if (!item) return;
    const el = document.getElementById(`${id}-item-${item.id}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.classList.add(styles.flash);
  }, [data, id]);

  if (error)
    return (
      <div id={id} className={styles.panel}>
        <State
          id={`${id}-error`}
          title="Comments could not be loaded"
          message={error.message}
          code={error.code}
          action={error.action}
          retry={retry}
        />
      </div>
    );
  if (!data)
    return (
      <div id={id} className={styles.panel}>
        <Skeleton kind="lines" count={4} label="Loading comments" />
      </div>
    );
  const { labels, maxLength, warning } = data;
  /** Legacy's rule: a comment and at most maxLength characters of it, else the transient warning. */
  const fits = (html: string | null): html is string => {
    if (html !== null && html.length <= maxLength) return true;
    toast.show("warning", warning, undefined, false);
    return false;
  };
  const write = async (result: Promise<ApiResult<unknown>>) => {
    const r = await result;
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    retry();
    return true;
  };
  const add = () =>
    run(async () => {
      if (!fits(draft)) return;
      if (await write(objects.addComment(record, draft))) setDraft(null);
    }, "add");
  const update = () =>
    run(async () => {
      if (!editing || !fits(editing.html)) return;
      if (
        await write(
          objects.updateComment(record, editing.item.id, editing.html),
        )
      )
        setEditing(null);
    }, "edit");
  const remove = (item: CommentItem) =>
    run(async () => {
      await write(objects.deleteComment(record, item.id));
    }, `delete-${item.id}`);

  return (
    <div id={id} className={styles.panel}>
      <div
        id={`${id}-list`}
        ref={list}
        className={styles.thread}
        aria-busy={busy}
      >
        {data.items.length === 0 ? (
          <p id={`${id}-empty`} className={styles.empty}>
            {labels.noData}
          </p>
        ) : (
          <ul className={styles.comments}>
            {data.items.map((c) => (
              <li
                key={c.id}
                id={`${id}-item-${c.id}`}
                data-comment-id={c.id}
                className={`${styles.comment} ${c.own ? styles.own : ""} enter-rise`}
              >
                <div className={styles.bubble}>
                  <div className={styles.body}>
                    <div
                      className={`${styles.html} ck-content`}
                      dangerouslySetInnerHTML={{ __html: c.html }}
                    />
                    {c.canChange && (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          id={`${id}-edit-${c.id}`}
                          className="gn-btn gn-btn--borderless gn-btn--icon"
                          aria-label={labels.edit}
                          title={labels.edit}
                          disabled={isActive(`delete-${c.id}`)}
                          onClick={() => setEditing({ item: c, html: c.html })}
                        >
                          <Icon name="pen" size={14} />
                        </button>
                        <button
                          type="button"
                          id={`${id}-delete-${c.id}`}
                          className="gn-btn gn-btn--borderless gn-btn--icon"
                          aria-label={labels.delete}
                          title={labels.delete}
                          disabled={isActive(`delete-${c.id}`)}
                          onClick={() => remove(c)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.author}>{c.author}</span>
                    <span>{c.at}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* No composer without the comment right (owner: hidden, not disabled). */}
      {data.canComment && (
        <div id={`${id}-footer`} className={styles.footer}>
          <div className={styles.input}>
            <Editor
              id={`${id}-input`}
              value={draft}
              onChange={setDraft}
              people={people ?? NO_PEOPLE}
              label={labels.send}
              disabled={isActive("add")}
            />
            <span
              id={`${id}-count`}
              className={`${styles.count} ${(draft?.length ?? 0) > maxLength ? styles.over : ""}`}
            >
              {draft?.length ?? 0} / {maxLength}
            </span>
          </div>
          <button
            type="button"
            id={`${id}-send`}
            className="gn-btn gn-btn--borderless gn-btn--icon"
            aria-label={labels.send}
            title={labels.send}
            disabled={isActive("add")}
            onClick={add}
          >
            <Icon name="send" size={24} />
          </button>
        </div>
      )}
      {editing && (
        <ActionDialog
          id={`${id}-edit-dialog`}
          title={labels.editTitle}
          width="50vw" /* legacy EditCommentsPopUp oj-md-width-1/2 */
          busy={isActive("edit")}
          closeLabel={labels.cancel}
          onClose={() => setEditing(null)}
        >
          <Editor
            id={`${id}-edit-dialog-input`}
            value={editing.html}
            onChange={(html) => setEditing((e) => (e ? { ...e, html } : e))}
            people={people ?? NO_PEOPLE}
            label={labels.editTitle}
            disabled={isActive("edit")}
          />
          <div className={styles.dialogFoot}>
            <button
              type="button"
              id={`${id}-edit-dialog-cancel`}
              className="gn-btn gn-btn--solid"
              disabled={isActive("edit")}
              onClick={() => setEditing(null)}
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              id={`${id}-edit-dialog-submit`}
              className="gn-btn gn-btn--primary"
              disabled={isActive("edit")}
              onClick={update}
            >
              {labels.submit}
            </button>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
