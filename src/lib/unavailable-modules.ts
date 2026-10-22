import type { IconName } from "@/components/ui/icon";
/**
 * The VBCS drawer in its fixed order (shell-page.js getNavigationItems + app-flow.js getDeepLinkItems).
 * Entries confer no Oracle permissions; the server filters them by module access (policy.ts).
 * No `href`: an in-app placeholder at /modules/<id>. `external`: a configured tool opened in a new tab (D23).
 */
// The drawer glyph per module, as GN-Angular's navigation.
export type NavIcon = IconName;
export interface NavDefinition {
  id: string;
  /** Legacy fallback name; the label comes from RB `dashboard / module-name / <id>`. */
  name: string;
  icon: NavIcon;
  href?: string;
  external?: true;
  children?: NavDefinition[];
}
/** Display model the server hands the client drawer. */
export interface NavEntry {
  id: string;
  label: string;
  icon: NavIcon;
  href: string;
  external: boolean;
  /** getOpportunitiesNewFlags: an unseen opportunity (the drawer's "new" dot). */
  isNew?: boolean;
  children?: NavEntry[];
}
export const navigationDefinitions: NavDefinition[] = [
  { id: "home", name: "Home", icon: "home", href: "/home" },
  {
    id: "opportunities-group",
    name: "Opportunities",
    icon: "money",
    children: [
      {
        id: "opportunities-finder",
        name: "All Opportunities",
        icon: "account",
        href: "/opportunities",
      },
      {
        id: "opportunities-analytics",
        name: "Analytics Dashboard",
        icon: "analytics",
        href: "/opportunities/analytics",
      },
      {
        id: "opportunities-eoi-list",
        name: "EOI Application",
        icon: "file-stage",
        href: "/opportunities/eoi",
      },
    ],
  },
  {
    id: "proposals",
    name: "Proposals",
    icon: "file-spreadsheet",
    href: "/proposals",
  },
  { id: "ethics", name: "Ethics", icon: "composite-form" },
  { id: "due-diligence", name: "Due Diligence", icon: "due-diligence" },
  { id: "awards", name: "Awards", icon: "deposits" },
  { id: "contracts", name: "Contracts", icon: "signature" },
  {
    id: "claims-group",
    name: "Claims",
    icon: "money",
    children: [
      { id: "claims-unit-inquiry", name: "Unit Inquiry", icon: "account" },
      { id: "claims-funds-inquiry", name: "Funds Inquiry", icon: "analytics" },
    ],
  },
  { id: "reports", name: "Reports", icon: "report", external: true },
  { id: "announcements", name: "Announcements", icon: "billboard" },
  {
    id: "administration",
    name: "Administration",
    icon: "administration",
    external: true,
  },
  {
    id: "customer-support",
    name: "Contact Support",
    icon: "support",
    external: true,
  },
  {
    id: "apidocs",
    name: "API Documentation",
    icon: "document-link",
    external: true,
  },
];
/** The first deep link (getDeepLinkItems); the drawer draws a divider above it. */
export const firstDeepLink = "administration";
/** Pages reached from the header, not the drawer: Help (legacy tutorials flow) and the bell's View all. */
export const headerPlaceholders: NavDefinition[] = [
  { id: "tutorials", name: "Tutorials", icon: "help" },
  { id: "announcements-notifications", name: "Notifications", icon: "bell" },
];
/** Not-yet-rebuilt modules: in-app placeholders at /modules/<id>. */
export const placeholderModules: NavDefinition[] = [
  ...navigationDefinitions
    .flatMap((item) => item.children ?? [item])
    .filter((item) => !item.href && !item.external),
  ...headerPlaceholders,
];
