/** Navigation placeholders only: these entries confer no Oracle permissions. */
export const unavailableModules = [
  { id: "ethics", label: "Ethics", icon: "document" },
  { id: "due-diligence", label: "Due Diligence", icon: "person" },
  { id: "awards", label: "Awards", icon: "archive" },
  { id: "contracts", label: "Contracts", icon: "document" },
  { id: "cga", label: "CGA", icon: "archive" },
  { id: "reports", label: "Reports", icon: "document" },
  { id: "announcements", label: "Announcements", icon: "message" },
  {
    id: "administration",
    label: "Administration",
    icon: "person",
    utility: true,
  },
  {
    id: "customer-support",
    label: "Customer Support",
    icon: "person",
    utility: true,
  },
  {
    id: "api-documentation",
    label: "API Documentation",
    icon: "document",
    utility: true,
  },
] as const;
