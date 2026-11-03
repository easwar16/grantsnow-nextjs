"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { attachments, useApi } from "@/lib/api";
import { useStoreApi } from "@/lib/store/app-store";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { fileProblem } from "@/features/record/dynamic-form/engine";
import {
  folderNameProblem,
  folderTree,
  type AttachmentItem,
  type AttachmentList,
  type AttachmentsView,
  type FolderNode,
} from "./model";
import { saveBlob } from "@/features/record/dynamic-form/api";
import styles from "./attachments.module.css";
import { functions } from "@/lib/functions";

type Labels = AttachmentsView["labels"];

/**
 * The shared attachments panel (legacy `object-attachments`, 8788): folder tree, detail pane with preview, download
 * and delete, the add-document dialog and (behind its RB row) external links. A host passes the server-built view.
 */
export function AttachmentsPanel({ view }: { view: AttachmentsView }) {
  const { id, labels, canEdit, storage } = view;
  const store = useStoreApi();
  const { data, error, retry } = useApi(attachments.list, view.query);
  const toast = useToast();
  const { run, isActive } = useInFlight();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(
    null,
  );
  const [target, setTarget] = useState<FolderNode | null>(null);
  const confirm = useConfirm(`${id}-delete-dialog`);
  const tree = useMemo(
    () => folderTree(view.folders, data?.items ?? []),
    [view.folders, data],
  );
  const selected = data?.items.find((a) => a.id === selectedId) ?? null;
  // The preview's object URL lives until another file is chosen or the panel leaves.
  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview.url)),
    [preview],
  );
  /** After any write the held list is dropped and read again (9326: writes pass forceRefresh). */
  const refresh = useCallback(() => {
    store.forget(attachments.list.key(view.query));
    retry();
  }, [store, view.query, retry]);
  const choose = useCallback((item: AttachmentItem) => {
    setPreview(null);
    setSelectedId(item.id);
  }, []);
  const download = useCallback(
    (item: AttachmentItem) =>
      run(async () => {
        const r = await attachments.documentBytes(view.query, item.id);
        if (r.ok) saveBlob(r.data, item.downloadName);
        else toast.error(r.error);
      }, `download-${item.id}`),
    [run, toast, view.query],
  );
  const showPreview = (item: AttachmentItem) =>
    run(async () => {
      const r = await attachments.documentBytes(view.query, item.id);
      if (!r.ok) return toast.error(r.error);
      // A type the pane cannot render safely downloads instead (actionsMenuActionChain).
      if (item.previewType === null) saveBlob(r.data, item.downloadName);
      else
        setPreview({
          url: URL.createObjectURL(
            new Blob([r.data], { type: item.previewType }),
          ),
          type: item.previewType,
        });
    }, `preview-${item.id}`);
  const remove = (item: AttachmentItem) =>
    run(async () => {
      const ok = await confirm.ask({
        title: labels.deleteWarningTitle,
        message: labels.deleteWarningText,
        confirm: labels.confirmDelete,
        cancel: labels.cancel,
        danger: true,
      });
      setPreview(null);
      if (!ok) return;
      const r = await attachments.deleteDocument(view.query, item.id);
      if (r.ok) {
        setSelectedId(null);
        toast.show("success", "Record deleted successfully.");
      } else toast.error(r.error);
      refresh();
    }, `delete-${item.id}`);

  const detail = (
    <div id={`${id}-detail`} className={styles.detail}>
      <dl className={styles.fields}>
        {(
          [
            ["file-name", labels.fileName, selected?.name],
            ["description", labels.description, selected?.description],
            ["file-size", labels.fileSize, selected?.sizeKb],
            ["file-type", labels.fileType, selected?.typeLabel],
            ["uploaded-by", labels.uploadedBy, selected?.uploadedBy],
            ["uploaded-on", labels.lastUpdatedDate, selected?.uploadedOn],
          ] as const
        ).map(([key, name, value]) => (
          <div key={key} id={`${id}-${key}`} className={styles.field}>
            <dt>{name}</dt>
            <dd>{value ?? ""}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <button
          type="button"
          id={`${id}-preview`}
          className="gn-btn gn-btn--solid"
          disabled={!selected || !storage || isActive(`preview-${selected.id}`)}
          onClick={() => selected && void showPreview(selected)}
        >
          <Icon name="view" size={14} />
          {labels.preview}
        </button>
        <button
          type="button"
          id={`${id}-download`}
          className="gn-btn gn-btn--solid"
          disabled={
            !selected || !storage || isActive(`download-${selected.id}`)
          }
          onClick={() => selected && void download(selected)}
        >
          <Icon name="download" size={14} />
          {labels.download}
        </button>
        {canEdit && (
          <button
            type="button"
            id={`${id}-delete`}
            className="gn-btn gn-btn--solid"
            disabled={
              !selected || !storage || isActive(`delete-${selected.id}`)
            }
            onClick={() => selected && void remove(selected)}
          >
            <Icon name="trash" size={14} />
            {labels.delete}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div id={id} className={styles.panel}>
      {!storage && (
        <p id={`${id}-storage-off`} className={styles.notice} role="status">
          File storage is not connected here, so documents cannot be opened or
          changed.
        </p>
      )}
      <div className={styles.main}>
        <div className={styles.treeBox}>
          {data === undefined ? (
            error ? (
              <State
                id={`${id}-error`}
                title="Attachments unavailable"
                message={error.message}
                action={error.action}
                code={error.code}
                retry={retry}
              />
            ) : (
              <Skeleton kind="list" label="Loading attachments" />
            )
          ) : tree.length === 0 ? (
            <State id={`${id}-empty`} title={labels.noData} />
          ) : (
            <ul
              id={`${id}-tree`}
              className={styles.tree}
              aria-label={labels.treeAriaLabel}
            >
              {tree.map((node) => (
                <FolderBranch
                  key={node.path}
                  id={id}
                  node={node}
                  labels={labels}
                  canAdd={canEdit && storage}
                  selectedId={selectedId}
                  onSelect={choose}
                  onOpen={download}
                  onAdd={setTarget}
                />
              ))}
            </ul>
          )}
        </div>
        {detail}
      </div>
      {view.showLinks && data?.links && (
        <LinksSection
          id={`${id}-links`}
          query={view.query}
          labels={labels}
          canEdit={canEdit}
          allowConfidential={view.allowConfidential}
          links={data.links}
          onChanged={refresh}
        />
      )}
      <div id={`${id}-preview-pane`} className={styles.previewPane}>
        {preview && selected ? (
          <object
            data={preview.url}
            type={preview.type}
            name={selected.name}
            title={selected.name}
            className={`${styles.object} enter-fade`}
          />
        ) : (
          <p className={styles.previewHint}>{labels.documentPreview}</p>
        )}
      </div>
      {target && (
        <AddDocumentDialog
          id={`${id}-add-dialog`}
          view={view}
          folder={target}
          onClose={() => setTarget(null)}
          onUploaded={refresh}
        />
      )}
      {confirm.element}
    </div>
  );
}

const FolderBranch = memo(function FolderBranch({
  id,
  node,
  labels,
  canAdd,
  selectedId,
  onSelect,
  onOpen,
  onAdd,
}: {
  id: string;
  node: FolderNode;
  labels: Labels;
  canAdd: boolean;
  selectedId: number | null;
  onSelect: (item: AttachmentItem) => void;
  onOpen: (item: AttachmentItem) => void;
  onAdd: (node: FolderNode) => void;
}) {
  // Legacy expands every folder that holds something.
  const [open, setOpen] = useState(
    node.files.length > 0 || node.folders.length > 0,
  );
  const key = `${id}-folder-${functions.ids.idPart(node.path.replaceAll("~~", "-"))}`;
  return (
    <li id={key} className={styles.branch}>
      <div className={styles.row}>
        <button
          type="button"
          id={`${key}-toggle`}
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={`${key}-children`}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
          <Icon name="folder" size={15} />
          <span className={styles.name} title={node.label}>
            {node.label}
          </span>
        </button>
        {canAdd && (
          <button
            type="button"
            id={`${key}-add`}
            className="gn-btn gn-btn--borderless gn-btn--icon"
            title={labels.addDocument}
            aria-label={`${labels.addDocument}: ${node.label}`}
            onClick={() => onAdd(node)}
          >
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div
        id={`${key}-children`}
        className="gn-collapse"
        data-open={open}
        inert={!open}
      >
        <ul className={styles.children}>
          {node.folders.map((child) => (
            <FolderBranch
              key={child.path}
              id={id}
              node={child}
              labels={labels}
              canAdd={canAdd}
              selectedId={selectedId}
              onSelect={onSelect}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          ))}
          {node.files.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                id={`${id}-file-${item.id}`}
                className={styles.file}
                aria-pressed={item.id === selectedId}
                title={item.name}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onOpen(item)}
              >
                <Icon name="document-attachment" size={14} />
                <span className={styles.name}>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
});

function AddDocumentDialog({
  id,
  view,
  folder,
  onClose,
  onUploaded,
}: {
  id: string;
  view: AttachmentsView;
  folder: FolderNode;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { labels } = view;
  const toast = useToast();
  const { run, busy } = useInFlight();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [addFolder, setAddFolder] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [description, setDescription] = useState("");
  const [confidential, setConfidential] = useState<"Y" | "N">("N");
  const [dragging, setDragging] = useState(false);
  const pick = (picked: File | undefined) => {
    if (!picked) return;
    const issue = fileProblem(
      { name: picked.name, size: picked.size },
      view.maxMb,
      view.accept,
    );
    setProblem(issue);
    setFile(issue === null ? picked : null);
  };
  const folderIssue =
    addFolder && newFolder.trim() !== ""
      ? folderNameProblem(newFolder.trim())
      : null;
  const submit = () =>
    run(async () => {
      if (!file || folderIssue) return;
      const r = await attachments.uploadDocument(view.query, file, {
        folder: folder.path,
        newFolder: addFolder ? newFolder.trim() : "",
        description,
        ...(view.allowConfidential ? { confidential } : {}),
      });
      if (!r.ok) {
        toast.error(r.error);
        onUploaded();
        return;
      }
      toast.show("success", "Attachment uploaded successfully");
      onUploaded();
      onClose();
    });
  return (
    <ActionDialog
      id={id}
      title={labels.addNewDocumentTitle}
      width="60vw" /* legacy dialogAddNewDocument oj-md-width-3/5 */
      busy={busy}
      closeLabel={labels.cancel}
      onClose={onClose}
    >
      <form
        id={`${id}-form`}
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <InsideField htmlFor={`${id}-folder`} label={labels.folderName} filled>
          <input
            id={`${id}-folder`}
            className="gn-control"
            value={folder.label}
            readOnly
          />
        </InsideField>
        <label className={styles.switch} htmlFor={`${id}-new-folder`}>
          <input
            id={`${id}-new-folder`}
            type="checkbox"
            role="switch"
            checked={addFolder}
            onChange={(e) => setAddFolder(e.target.checked)}
          />
          {labels.newFolder}
        </label>
        <div className="gn-collapse" data-open={addFolder} inert={!addFolder}>
          <div>
            <InsideField
              htmlFor={`${id}-new-folder-name`}
              label={labels.newFolderName}
              filled={newFolder !== ""}
            >
              <input
                id={`${id}-new-folder-name`}
                className="gn-control"
                value={newFolder}
                maxLength={80}
                aria-invalid={folderIssue !== null || undefined}
                aria-describedby={
                  folderIssue ? `${id}-new-folder-error` : undefined
                }
                onChange={(e) => setNewFolder(e.target.value)}
              />
            </InsideField>
            {folderIssue && (
              <p id={`${id}-new-folder-error`} className={styles.error}>
                {folderIssue}
              </p>
            )}
          </div>
        </div>
        <label
          id={`${id}-drop`}
          htmlFor={`${id}-file`}
          className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="attachment" size={18} />
          <span className={styles.dropTitle}>
            {file ? file.name : "Drag and Drop"}
          </span>
          <span className={styles.dropHint}>
            {file
              ? `${(file.size / 1024).toFixed(1)}KB`
              : "Select or drop files here."}
          </span>
          <input
            id={`${id}-file`}
            type="file"
            className="sr-only"
            accept={view.accept || undefined}
            aria-describedby={`${id}-note`}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {problem && (
          <p id={`${id}-file-error`} className={styles.error} role="alert">
            {problem}
          </p>
        )}
        <div id={`${id}-note`} className={styles.note}>
          <p className={styles.noteTitle}>{labels.pleaseNote}</p>
          <p>{labels.fileShouldNotExceed}</p>
        </div>
        <InsideField
          htmlFor={`${id}-description`}
          label={labels.description}
          filled={description !== ""}
          multiline
        >
          <textarea
            id={`${id}-description`}
            className="gn-control"
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </InsideField>
        {view.allowConfidential && (
          <Confidential
            id={`${id}-confidential`}
            labels={labels}
            value={confidential}
            onChange={setConfidential}
          />
        )}
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-cancel`}
            className="gn-btn gn-btn--outlined"
            disabled={busy}
            onClick={onClose}
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            id={`${id}-add`}
            className="gn-btn gn-btn--primary"
            disabled={!file || folderIssue !== null || busy}
          >
            <Icon name="plus" size={14} />
            {labels.add}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

function Confidential({
  id,
  labels,
  value,
  onChange,
}: {
  id: string;
  labels: Labels;
  value: "Y" | "N";
  onChange: (v: "Y" | "N") => void;
}) {
  return (
    <fieldset id={id} className={styles.radios}>
      <legend>{labels.confidential}</legend>
      {(["Y", "N"] as const).map((v) => (
        <label key={v} htmlFor={`${id}-${v.toLowerCase()}`}>
          <input
            id={`${id}-${v.toLowerCase()}`}
            type="radio"
            name={id}
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {v === "Y" ? labels.yes : labels.no}
        </label>
      ))}
    </fieldset>
  );
}

function LinksSection({
  id,
  query,
  labels,
  canEdit,
  allowConfidential,
  links,
  onChanged,
}: {
  id: string;
  query: string;
  labels: Labels;
  canEdit: boolean;
  allowConfidential: boolean;
  links: NonNullable<AttachmentList["links"]>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { run, isActive } = useInFlight();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [confidential, setConfidential] = useState<"Y" | "N">("N");
  const reset = () => {
    setAdding(false);
    setTitle("");
    setAddress("");
    setConfidential("N");
  };
  const add = () =>
    run(async () => {
      if (title.trim() === "" || address.trim() === "") return;
      const r = await attachments.addLink(query, {
        title: title.trim(),
        url: address.trim(),
        ...(allowConfidential ? { confidential } : {}),
      });
      if (r.ok) reset();
      else toast.error(r.error);
      onChanged();
    }, "add");
  const remove = (linkId: number) =>
    run(async () => {
      const r = await attachments.deleteLink(query, linkId);
      if (!r.ok) toast.error(r.error);
      onChanged();
    }, `delete-${linkId}`);
  return (
    <section id={id} className={styles.links} aria-labelledby={`${id}-title`}>
      <div className={styles.linksHead}>
        <h3 id={`${id}-title`}>{labels.linksHeader}</h3>
        {canEdit && (
          <button
            type="button"
            id={`${id}-toggle`}
            className="gn-btn gn-btn--borderless"
            aria-expanded={adding}
            aria-controls={`${id}-form`}
            onClick={() => (adding ? reset() : setAdding(true))}
          >
            {labels.addLink}
          </button>
        )}
      </div>
      {canEdit && (
        <div className="gn-collapse" data-open={adding} inert={!adding}>
          <form
            id={`${id}-form`}
            className={styles.linkForm}
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <InsideField
              htmlFor={`${id}-title-input`}
              label={labels.linkTitle}
              filled={title !== ""}
              required
            >
              <input
                id={`${id}-title-input`}
                className="gn-control"
                value={title}
                maxLength={200}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
            </InsideField>
            <InsideField
              htmlFor={`${id}-url-input`}
              label={labels.linkUrl}
              filled={address !== ""}
              required
            >
              <input
                id={`${id}-url-input`}
                className="gn-control"
                value={address}
                maxLength={2000}
                required
                onChange={(e) => setAddress(e.target.value)}
              />
            </InsideField>
            {allowConfidential && (
              <Confidential
                id={`${id}-confidential`}
                labels={labels}
                value={confidential}
                onChange={setConfidential}
              />
            )}
            <div className={styles.linkButtons}>
              <button
                type="button"
                id={`${id}-cancel`}
                className="gn-btn gn-btn--outlined"
                disabled={isActive("add")}
                onClick={reset}
              >
                {labels.cancel}
              </button>
              <button
                type="submit"
                id={`${id}-add`}
                className="gn-btn gn-btn--primary"
                disabled={
                  isActive("add") ||
                  title.trim() === "" ||
                  address.trim() === ""
                }
              >
                {labels.addLink}
              </button>
            </div>
          </form>
        </div>
      )}
      {links.length > 0 && (
        <ul id={`${id}-list`} className={styles.linkList}>
          {links.map((link) => (
            <li key={link.id} id={`${id}-${link.id}`} className="enter-rise">
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.title}
              </a>
              {canEdit && (
                <button
                  type="button"
                  id={`${id}-${link.id}-delete`}
                  className="gn-btn gn-btn--borderless gn-btn--icon"
                  title={labels.delete}
                  aria-label={`${labels.delete} ${link.title}`}
                  disabled={isActive(`delete-${link.id}`)}
                  onClick={() => void remove(link.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
