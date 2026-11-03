/** A record's Created by card (legacy dialogCreatorDetails): read-only fields in the dialog's order. */
export interface CreatorCard {
  title: string;
  fields: { key: string; label: string; value: string }[];
}
