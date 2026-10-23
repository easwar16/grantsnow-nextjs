/**
 * The shared attachments panel (legacy `object-attachments` fragment, 8788) as display models and pure helpers, used by
 * the server routes and the client alike. A host passes only its identity; labels, folders and gates come from its
 * resource bundle on the server (Framework-Patterns F1/F3).
 */
export const ATTACHMENT_LABELS = [
  "addDocument",
  "folderName",
  "newFolder",
  "newFolderName",
  "fileName",
  "description",
  "fileSize",
  "fileType",
  "uploadedBy",
  "lastUpdatedDate",
  "preview",
  "download",
  "delete",
  "add",
  "cancel",
  "confirmDelete",
  "confidential",
  "yes",
  "no",
  "documentPreview",
  "addNewDocumentTitle",
  "deleteWarningTitle",
  "deleteWarningText",
  "pleaseNote",
  "fileShouldNotExceed",
  "noData",
  "treeAriaLabel",
  "linksHeader",
  "addLink",
  "linkTitle",
  "linkUrl",
] as const;
export type AttachmentLabel = (typeof ATTACHMENT_LABELS)[number];

/** What the host page renders the panel from; hidden features are already off. */
export interface AttachmentsView {
  /** The host's id prefix, e.g. `eoi-attachments`. */
  id: string;
  /** The routes' query naming the host and record (`host=eoi&record=3934`); identity is resolved on the server. */
  query: string;
  labels: Record<AttachmentLabel, string>;
  folders: Folder[];
  /** Upload, delete and link changes: page edit right and the page not finalized. */
  canEdit: boolean;
  /** False when file storage (OIC) is not connected here. */
  storage: boolean;
  showLinks: boolean;
  allowConfidential: boolean;
  maxMb: number;
  /** ALLOWED_EXTENSIONS as `.ext,…`; empty allows any. */
  accept: string;
}

export interface AttachmentItem {
  id: number;
  name: string;
  description: string;
  /** `sec_obj_ref_type`: the folder path, `TOP~~sub`. */
  folder: string;
  typeLabel: string;
  sizeKb: string;
  uploadedBy: string;
  uploadedOn: string;
  /** The type the preview pane may render it as; null downloads instead. */
  previewType: string | null;
  downloadName: string;
}
export interface AttachmentLink {
  id: number;
  title: string;
  href: string;
}
export interface AttachmentList {
  items: AttachmentItem[];
  /** Null when the host's links row is hidden. */
  links: AttachmentLink[] | null;
}

export interface Folder {
  key: string;
  label: string;
}
export interface FolderNode<T = AttachmentItem> extends Folder {
  /** The full path, the upload target (`TOP` or `TOP~~sub`). */
  path: string;
  folders: FolderNode<T>[];
  files: T[];
}

/** The `attachments-nodes` bundle value, `KEY:Label,…`, trimmed; no code default, so an empty value has no folders. */
export function parseFolders(value: string): Folder[] {
  return value
    .split(",")
    .map((part) => part.split(":").map((s) => s.trim()))
    .filter(([key]) => key !== undefined && key !== "")
    .map(([key, label]) => ({ key, label: label || key }));
}

/**
 * prepareFolderStructure: the configured folders (empty ones too), each file under its `~~` path, and any folder only
 * the data names added on demand, so no document is hidden in a folder the configuration lacks.
 */
export function folderTree<T extends { folder: string }>(
  folders: Folder[],
  items: T[],
) {
  const top: FolderNode<T>[] = folders.map((f) => ({
    ...f,
    path: f.key,
    folders: [],
    files: [],
  }));
  for (const item of items) {
    const [first, ...rest] = item.folder.split("~~");
    let node: FolderNode<T> | undefined = top.find((f) => f.key === first);
    if (!node) {
      node = { key: first, label: first, path: first, folders: [], files: [] };
      top.push(node);
    }
    for (const part of rest) {
      const path: string = `${node.path}~~${part}`;
      let child: FolderNode<T> | undefined = node.folders.find(
        (c) => c.path === path,
      );
      if (!child) {
        child = { key: part, label: part, path, folders: [], files: [] };
        node.folders.push(child);
      }
      node = child;
    }
    node.files.push(item);
  }
  return top;
}

/** Every folder path in the tree: the places an upload may go. */
export function folderPaths<T>(nodes: FolderNode<T>[]): string[] {
  return nodes.flatMap((n) => [n.path, ...folderPaths(n.folders)]);
}

/** safeLinkUrl: http(s) as is, a scheme-less value as https, any other scheme (javascript:, data:) neutralised. */
export function safeLinkUrl(url: string) {
  const u = url.trim();
  if (u === "") return "#";
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "#";
  return `https://${u.replace(/^\/+/, "")}`;
}

/**
 * ensureExtension: the stored name (legacy keeps it without its extension) takes its storage location's extension.
 * Checked against that extension, not any dot, so `v1.2 report` still becomes `v1.2 report.pdf`.
 */
export function withExtension(name: string, location: string) {
  let decoded = location;
  try {
    decoded = decodeURIComponent(location);
  } catch {
    // A location that is not valid percent-encoding is used as stored.
  }
  const ext = decoded.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (!ext || name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) return name;
  return `${name}.${ext}`;
}
/** The name recorded for an upload: legacy records it without its extension (the storage location keeps it). */
export function recordedName(fileName: string) {
  const base = fileName.replace(/\.[^.]*$/, "");
  return base === "" ? fileName : base;
}

/** One folder name typed for a new sub-folder; no `~~` (the path separator), slashes or control characters. */
export function folderNameProblem(name: string) {
  if (!/^[A-Za-z0-9 _.&()-]{1,80}$/.test(name) || name.trim() !== name)
    return "Use letters, numbers, spaces and - _ . & ( ) in the folder name.";
  return null;
}
