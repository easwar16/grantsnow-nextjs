import type { GuideStep } from "../../types";
const steps: Record<string, GuideStep[]> = {
  "opportunities-tour": [
    {
      title: "Funding opportunities",
      body: "Find and track funding calls that match your research. Press Esc to leave at any time.",
    },
    {
      target: "finder-search",
      title: "Search",
      body: "Search opportunity titles and descriptions; results update when you leave the box or press Enter.",
      side: "bottom",
    },
    {
      target: "finder-advanced-toggle",
      title: "Advanced filter",
      body: "Combine keyword, funder and amount conditions.",
      side: "bottom",
    },
    {
      target: "opportunity-filters",
      title: "Filters",
      body: "Narrow by funder, status and funding type. Hide this panel with the toggle beside the search box.",
      side: "right",
    },
    {
      target: "finder-tabs",
      title: "Views",
      body: "Switch between the opportunity views; counts show on each tab.",
      side: "bottom",
    },
    {
      target: "finder-sort",
      title: "Date sort",
      body: "Choose which date orders the results and flip the direction.",
      side: "right",
    },
    {
      target: "finder-list",
      title: "Results",
      body: "Open an opportunity for details. More results load as you scroll.",
      side: "top",
    },
  ],
  "opportunities-search": [
    {
      target: "finder-search",
      title: "Type a search",
      body: "Enter words from the opportunity title or description, then press Enter.",
      side: "bottom",
    },
    {
      target: "finder-tabs",
      title: "Choose a view",
      body: "Pick the tab that holds the opportunities you want.",
      side: "bottom",
    },
    {
      target: "finder-list",
      title: "Open a result",
      body: "Select an opportunity to see its details.",
      side: "top",
    },
  ],
  "opportunities-filter": [
    {
      target: "finder-panel-toggle",
      title: "Show filters",
      body: "Open or close the filter panel.",
      side: "bottom",
    },
    {
      target: "opportunity-filters",
      title: "Choose filters",
      body: "Tick funders, statuses and funding types to narrow the results.",
      side: "right",
    },
    {
      target: "finder-clear",
      title: "Clear filters",
      body: "Reset every filter in one click.",
      side: "right",
    },
    {
      target: "finder-advanced-toggle",
      title: "Advanced filter",
      body: "For keyword, funder and amount conditions together, use the advanced filter.",
      side: "bottom",
    },
  ],
  // Card ids carry the record key, so each step points at the first card that shows that control.
  "opportunities-card": [
    {
      selector: "#finder-list .opportunity-card",
      title: "An opportunity",
      body: "Each card is one funding opportunity. The next steps show what you can do from it.",
      side: "top",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-link"]',
      title: "Opportunity title",
      body: "Opens the funder's page for this opportunity in a new tab.",
      side: "bottom",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-more-info"]',
      title: "More info",
      body: "View this opportunity's details in GrantsNow.",
      side: "bottom",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-status"]',
      title: "Status",
      body: "Open, Closed or Upcoming: whether the opportunity is taking applications.",
      side: "bottom",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-bookmark"]',
      title: "Bookmark",
      body: "Save the opportunity so you can find it again quickly.",
      side: "bottom",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-share"]',
      title: "Share",
      body: "Send this opportunity to colleagues.",
      side: "bottom",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-notes"]',
      title: "Opportunity notes",
      body: "Keep your own notes about this opportunity.",
      side: "bottom",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-apply"]',
      title: "Apply",
      body: "Start an application. It opens with a Summary of the opportunity and Application Details, where you create the application.",
      side: "top",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-convert"]',
      title: "Convert",
      body: "Convert the opportunity to an outline proposal with its basic details.",
      side: "top",
    },
    {
      selector: '#finder-list .opportunity-card [id$="-convert-to-proposal"]',
      title: "Convert to Proposal",
      body: "Convert the opportunity straight to a proposal.",
      side: "top",
    },
  ],
};
export default steps;
