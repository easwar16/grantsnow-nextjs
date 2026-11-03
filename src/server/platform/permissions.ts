/** One page's rights on a record (VBCS `current_user.access[page]`). */
export interface PageAccess {
  read: boolean;
  edit: boolean;
  delete: boolean;
}

/** The user's rights on one record (D38): by page name, plus the readable pages with their ids (lock levels). */
export interface ObjectAccess {
  roles: Map<string, PageAccess>;
  pages: { id: number; name: string }[];
}

export interface ObjectRoleRow {
  page_id?: number | null;
  page_name: string;
  read_access: string | null;
  edit_access?: string | null;
  delete_access?: string | null;
}

/** A user_roles row (getSecurityUser_roles, legacy `dashboard_access[page_name]`). */
export type RoleRow = {
  page_name: string;
  read_access: string | null;
  edit_access?: string | null;
  delete_access?: string | null;
};
