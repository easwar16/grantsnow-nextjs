import type { GuideModule } from "../../types";
export const opportunities: GuideModule = {
  id: "opportunities",
  label: "Opportunities",
  route: "/opportunities",
  access: "opportunities-finder",
  guides: [
    {
      id: "opportunities-tour",
      version: 1,
      title: "Tour funding opportunities",
      auto: true,
    },
    {
      id: "opportunities-search",
      version: 1,
      title: "Search for an opportunity",
    },
    { id: "opportunities-filter", version: 1, title: "Filter opportunities" },
    {
      id: "opportunities-card",
      version: 1,
      title: "Work with an opportunity",
    },
  ],
  steps: () => import("./steps"),
};
