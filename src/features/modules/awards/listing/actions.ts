import type { ClonePart, CloneToggle } from "@/components/dialog/clone-parts";

/** The listing's actions (legacy awards-start toolbar and row buttons), each gated on the server. */
export interface AwardActionGates {
  create: boolean;
  link: boolean;
  clone: boolean;
  advanced: boolean;
}

type Option = { value: string; label: string };
type Detailed = Option & { detail: string };

export type CreateAwardField =
  | "proposal"
  | "pi"
  | "org"
  | "sponsor"
  | "fullTitle"
  | "name"
  | "start"
  | "end"
  | "amount"
  | "currency"
  | "period";

/** Everything the Create Award dialog shows: RB-gated fields, texts and the lists it picks from. */
export interface CreateAwardSetup {
  fields: Record<
    CreateAwardField,
    { show: boolean; required: boolean; label: string; maxLength?: number }
  >;
  texts: Record<"title" | "create" | "required" | "created", string>;
  proposals: Detailed[];
  pis: (Detailed & { orgUnitId: string; orgUnitName: string })[];
  sponsors: Option[];
  currencies: Option[];
}

export interface CloneSetup {
  parts: ClonePart[];
  texts: Record<"title" | "entire" | "cancel" | "clone", string>;
}

/** An Advanced Query column (a probe column, or a described attribute). */
export type AwardAttribute = Option;
export interface AdvancedSetup {
  attributes: AwardAttribute[];
  operators: Option[];
  texts: Record<
    | "title"
    | "attribute"
    | "operator"
    | "value"
    | "add"
    | "edit"
    | "remove"
    | "save"
    | "cancel"
    | "close"
    | "editTitle",
    string
  >;
}

/**
 * Legacy checkboxValueUpdate: ticking a parent ticks its children and ticking a child ticks its parent; unticking a
 * parent unticks its children, and unticking a parent's last child unticks the parent. Fixed parts stay ticked.
 */
export const toggleClonePart: CloneToggle = (parts, chosen, key, checked) => {
  const children = (k: string) =>
    parts.filter((p) => p.parent === k).map((p) => p.value);
  const parent = parts.find((p) => p.value === key)?.parent ?? null;
  let next = new Set(chosen);
  if (checked) {
    next.add(key);
    if (children(key).length) children(key).forEach((c) => next.add(c));
    else if (parent) next.add(parent);
  } else {
    next.delete(key);
    if (children(key).length) children(key).forEach((c) => next.delete(c));
    else if (parent && !children(parent).some((c) => next.has(c)))
      next.delete(parent);
  }
  for (const p of parts) if (p.fixed) next.add(p.value);
  next = new Set(parts.map((p) => p.value).filter((v) => next.has(v)));
  return [...next];
};
