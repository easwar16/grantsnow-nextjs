import type { GuideModule } from "../../types";
export const awards: GuideModule = {
  id: "awards",
  label: "Awards",
  route: "/awards",
  access: "awards",
  guides: [
    {
      id: "awards-tour",
      version: 1,
      title: "Tour the awards list",
      auto: true,
    },
    { id: "awards-find", version: 1, title: "Find an award" },
    { id: "awards-row", version: 1, title: "Work with an award" },
  ],
  steps: () => import("./steps"),
};
