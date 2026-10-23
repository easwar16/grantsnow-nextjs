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
