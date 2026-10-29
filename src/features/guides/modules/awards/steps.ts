import type { GuideStep } from "../../types";
// Row ids carry the award key, so each row step points at the first award that shows that control.
const row = (suffix: string) => `#awards-rows [id$="-${suffix}"]`;
const steps: Record<string, GuideStep[]> = {
  "awards-tour": [
    {
      title: "Awards",
      body: "This tour shows the awards list and what you can do from it. Press Esc to leave at any time.",
    },
    {
      target: "awards-status",
      title: "Award status",
      body: "The top of the panel filters the list by status, from All through to Abandoned.",
      side: "right",
    },
    {
      target: "awards-filters",
      title: "Filters",
      body: "Below the statuses, narrow the list by number, title, org unit, people, parties and dates.",
      side: "right",
    },
    {
      target: "awards-clear",
      title: "Clear filters",
      body: "Reset every filter in the panel.",
      side: "right",
    },
    {
      target: "awards-panel-toggle",
      title: "Hide the panel",
      body: "Collapse the filter panel when you want more room for the list.",
      side: "bottom",
    },
    {
      target: "awards-create",
      title: "Create Award",
      body: "Start a new award.",
      side: "bottom",
    },
    {
      target: "awards-layout",
      title: "List or card view",
      body: "Switch between the list and the card layout.",
      side: "bottom",
    },
    {
      target: "awards-advanced-toggle",
      title: "Advanced filter",
      body: "Build conditions across award fields for a more precise search.",
      side: "bottom",
    },
    {
      selector: row("number"),
      title: "Award number",
      body: "The award's reference, with its status beside it.",
      side: "bottom",
    },
    {
      selector: row("title"),
      title: "Award title",
      body: "Below the number; select it to open the award.",
      side: "bottom",
    },
    {
      selector: row("link"),
      title: "Link",
      body: "Shows which proposal and contract this award is linked to.",
      side: "left",
    },
    {
      selector: row("clone"),
      title: "Clone",
      body: "Copy this award into a new one.",
      side: "left",
    },
  ],
  "awards-find": [
    {
      target: "awards-status",
      title: "Pick a status",
      body: "Start with the award status you want, from All through to Abandoned.",
      side: "right",
    },
    {
      target: "awards-filters",
      title: "Narrow it down",
      body: "Add a number, title, org unit, person, party or date range.",
      side: "right",
    },
    {
      target: "awards-advanced-toggle",
      title: "Advanced filter",
      body: "For conditions the panel does not cover, use the advanced filter.",
      side: "bottom",
    },
    {
      target: "awards-clear",
      title: "Start again",
      body: "Clear every filter and begin a new search.",
      side: "right",
    },
    {
      target: "awards-count",
      title: "How many match",
      body: "The count of awards matching your filters. Scroll the list to load more.",
      side: "top",
    },
  ],
  "awards-row": [
    {
      selector: "#awards-rows [id^='award-']",
      title: "An award",
      body: "Each row is one award. The next steps show what you can do from it.",
      side: "top",
    },
    {
      selector: row("number"),
      title: "Award number",
      body: "The award's reference, with its status beside it.",
      side: "bottom",
    },
    {
      selector: row("title"),
      title: "Award title",
      body: "Below the number; select it to open the award.",
      side: "bottom",
    },
    {
      selector: row("link"),
      title: "Link",
      body: "Opens the records linked to this award, such as its proposal and contract.",
      side: "left",
    },
    {
      selector: row("clone"),
      title: "Clone",
      body: "Copy this award into a new one.",
      side: "left",
    },
    {
      selector: row("view"),
      title: "View",
      body: "Open the award's record.",
      side: "left",
    },
  ],
};
export default steps;
