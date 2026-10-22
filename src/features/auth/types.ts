export interface AppSession {
  token: string;
  expiresAt: number;
  subject: string;
  identityExpiresAt: number;
  fixture: boolean;
  source?: "browser-session";
}
export interface UserContext {
  name: string;
  organization: string;
  organizationId: string;
  personId: string;
  /** Server-side only (D45): a header some writes need; never mapped into client props. */
  legalId?: string;
  modules: Record<string, boolean>;
  landing: string;
}
export interface Authenticated {
  session: AppSession;
  user: UserContext;
}
