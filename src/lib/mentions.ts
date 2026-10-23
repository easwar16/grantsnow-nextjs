/** A person the comment editor can @mention (legacy feed: getPreAwardGetPersonListAllADP, i.e. getPersonListAll through transformResponse). */
export interface MentionPerson {
  id: string;
  name: string;
  /** The org unit, shown under the name (legacy DepartmentName). */
  detail: string;
  email: string;
}

/**
 * The anchor legacy's rte-modified UserMentionCustomization writes for a person mention, attributes in its order.
 * The person list has no first/last split, so FirstName is the full name and LastName is left out; a person with
 * no email gets no mailto link.
 */
export function mentionAttributes(p: MentionPerson): [string, string][] {
  return [
    ["class", "mention oj-link-standalone oj-link-subtle-primary"],
    ["data-mention", `@${p.name}`],
    ["data-person-id", p.id],
    ["data-first-name", p.name],
    ...(p.email
      ? ([
          ["data-email-address", p.email],
          ["href", `mailto:${p.email}`],
        ] as [string, string][])
      : []),
    ["data-mention-type", "person"],
  ];
}

/** The text a mention shows. */
export const mentionText = (p: MentionPerson) => `@${p.name}`;

const MENTION_LIMIT = 1000;
/** Legacy's feed: `full_name` contains the query, case-insensitive (`$co`), up to its `dropdownLimit` of 1000. */
export function matchMentions(people: MentionPerson[], query: string) {
  const q = query.toLowerCase();
  return people
    .filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, MENTION_LIMIT);
}

/** The @query being typed just before the caret, or null: `@` at the start or after a space or opening bracket. */
export function mentionQuery(before: string) {
  const match = /(?:^|[\s([{"'])@([^@\n]{0,40})$/.exec(before);
  return match ? { query: match[1], length: match[1].length + 1 } : null;
}
