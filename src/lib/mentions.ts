/** A person the comment editor can @mention (legacy feed: getPreAwardGetPersonListAllADP, i.e. getPersonListAll through transformResponse). */
export interface MentionPerson {
  id: string;
  name: string;
  /** The org unit, shown under the name (legacy DepartmentName). */
  detail: string;
  email: string;
}
