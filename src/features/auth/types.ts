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
  modules: Record<string, boolean>;
  landing: string;
}
export interface Authenticated {
  session: AppSession;
  user: UserContext;
}
