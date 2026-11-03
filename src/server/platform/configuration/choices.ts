import "server-only";
/** A filter's option as the listings' drawers take it. */
export interface Choice {
  value: string;
  label: string;
}

/** One dropdown's options read on their own, so a slow or failed list never holds the others; a failure is empty
 * and carries its message for the page to toast. */
export interface ChoiceList<T = Choice> {
  options: T[];
  errors: string[];
}
