import type { GuideModule } from "../../types";
export const home: GuideModule = {
  id: "home",
  label: "Dashboard",
  route: "/home",
  guides: [
    { id: "home-tour", version: 2, title: "Tour the dashboard", auto: true },
    { id: "home-organization", version: 1, title: "Switch organisation" },
    { id: "home-announcements", version: 1, title: "Read announcements" },
    { id: "home-kpis", version: 1, title: "Key figures" },
    { id: "home-attention", version: 1, title: "Work through Need Attention" },
    { id: "home-insights", version: 1, title: "Filter and read Insights" },
    { id: "home-featured", version: 1, title: "Featured opportunities" },
    { id: "home-notifications", version: 1, title: "Notifications" },
    { id: "home-dynamic-charts", version: 1, title: "Dynamic charts" },
  ],
  steps: () => import("./steps"),
};
