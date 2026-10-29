export interface Choice {
  value: string;
  label: string;
}
export interface ListingChoices {
  statuses: Choice[];
  categories: Choice[];
  investigators: Choice[];
  assignees: Choice[];
  departments: Choice[];
  sponsors: Choice[];
  activities: Choice[];
  proposalTypes: Choice[];
  sorts: Choice[];
  errors: string[];
}
/** The listing's choice groups: each is read on its own, so a slow lookup never holds the other filters. */
export const CHOICE_GROUPS = [
  "codes",
  "people",
  "sponsors",
  "departments",
  "sorts",
] as const;
export type ChoiceGroup = (typeof CHOICE_GROUPS)[number];
/** One group's choices; the other groups' keys are absent. */
export type ChoiceGroupResult = Partial<ListingChoices> & { errors: string[] };
