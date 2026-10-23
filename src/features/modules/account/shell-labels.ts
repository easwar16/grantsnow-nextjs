/** Shell texts from RB `dashboard` (group, key, legacy fallback), resolved on the server for the client shell. */
export const shellLabelKeys = {
  navigation: [
    "labels",
    "app_title_navigation_drawer",
    "Application Navigation Drawer",
  ],
  logo: ["labels", "app_logo_tooltip", "Grants Now Logo"],
  notifications: ["button-labels", "notifications", "Notifications"],
  viewAll: ["button-labels", "view-all", "View all"],
  noData: ["helper-texts", "no-data", "No data to display."],
  manageProfile: ["button-labels", "manage-profile", "Manage profile"],
  preferences: ["button-labels", "preferences", "Preferences"],
  accessibility: ["labels", "accessibility", "Accessibility"],
  signOut: ["labels", "app_sign_out", "Sign Out"],
  warning: ["dialog-titles", "warning", "Warning"],
  sessionExpired: [
    "labels",
    "session-expired",
    "Session expired due to inactivity. Please login again",
  ],
  login: ["button-labels", "login", "Login"],
  close: ["button-labels", "close", "Close"],
  moreInfo: ["button-labels", "more_info", "More Info"],
  save: ["button-labels", "save", "Save"],
  userPreferences: ["header-labels", "user-preferences", "Preferences"],
  accessibilityTitle: ["header-labels", "accessibility", "Accessibility"],
  theme: ["header-labels", "theme", "Theme"],
  infolets: ["header-labels", "infolets", "Infolets"],
  needAttention: ["button-labels", "need-attention", "Need Attention"],
  insights: ["button-labels", "insights", "Insights"],
  opportunities: ["button-labels", "opportunities", "Opportunities"],
  manageProfileTitle: ["dialog-titles", "manage-profile", "Manage profile"],
  profile: ["labels", "profile", "Profile"],
  preference: ["labels", "preference", "Preference"],
  digitalPresence: ["labels", "digital-presence", "Digital Presence"],
  manage: ["labels", "manage", "Manage"],
  researchAreas: [
    "labels",
    "research-areas-of-interest",
    "Research areas of interest",
  ],
  favouriteFunders: ["labels", "favourite-funders", "Favourite Funders"],
  researchKeywords: [
    "labels",
    "research-keyword-preference",
    "Research keyword preference",
  ],
  selectStatus: ["labels", "select-status", "Status"],
  startDatetime: ["labels", "start-datetime", "Start Datetime"],
  endDatetime: ["labels", "end-datetime", "End Datetime"],
  statusMessage: ["labels", "status-message", "Status Message"],
  selectOrg: ["labels", "select-org", "Select Org"],
  selectProxy: ["labels", "select-proxy", "Select Proxy"],
  orgName: ["table-headers", "org-name", "Org Name"],
  proxyName: ["table-headers", "proxy-name", "Proxy Name"],
  profileSaved: [
    "warning-messages",
    "profile-saved",
    "Profile saved successfully!",
  ],
  statusUpdated: [
    "success-msg",
    "status-updated",
    "Status Updated Successfully",
  ],
  dataIncomplete: ["error-msg", "data-incomplete", "Data Incomplete"],
  statusOoo: [
    "warning-messages",
    "status-ooo",
    "The status is set to Out of Office",
  ],
} as const satisfies Record<string, readonly [string, string, string]>;
export type ShellLabels = Record<keyof typeof shellLabelKeys, string> & {
  /** More Info texts (sanitised RB descriptions) for the Preferences headings; null when none. */
  themeHelp: string | null;
  infoletsHelp: string | null;
};
