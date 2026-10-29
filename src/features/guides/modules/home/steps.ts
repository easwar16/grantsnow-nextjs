import type { GuideStep } from "../../types";
// Tab ids are `home-tab-<key>`; a step with `open` selects that tab first, and its steps are skipped where the tab is not shown.
const attention: GuideStep[] = [
  {
    open: "home-tab-need-attention",
    target: "home-need-attention",
    title: "Need Attention",
    body: "Queues of records waiting for you, one panel per queue.",
    side: "top",
  },
  {
    selector: '#home-need-attention [id$="-views"]',
    title: "List or calendar",
    body: "Switch a queue between a list and a calendar of its deadlines.",
    side: "bottom",
  },
  {
    selector: '#home-need-attention [id*="-link-"]',
    title: "Open a record",
    body: "Select a reference to open the record. Scroll the list to load more.",
    side: "right",
  },
  {
    selector: '#home-need-attention [id$="-help"]',
    title: "What this queue holds",
    body: "Use the help button to see what each queue lists.",
    side: "bottom",
  },
];
const insights: GuideStep[] = [
  {
    open: "home-tab-insights",
    target: "home-insights",
    title: "Insights",
    body: "Charts that summarise your organisation's grant activity.",
    side: "top",
  },
  {
    target: "insights-filters",
    title: "Period filters",
    body: "Narrow every chart by year, quarter or month.",
    side: "bottom",
  },
  {
    target: "insights-filter-clear",
    title: "Clear filters",
    body: "Return the charts to the full period.",
    side: "bottom",
  },
  {
    selector: '#home-insights [id^="insight-"][id$="-expand"]',
    title: "Expand a chart",
    body: "Open a chart at full size to read it more easily.",
    side: "left",
  },
];
const featured: GuideStep[] = [
  {
    open: "home-tab-opportunities",
    target: "featured-panel",
    title: "Featured opportunities",
    body: "Featured funding opportunities, as the same cards and actions as on the Opportunities page.",
    side: "top",
  },
];
const notifications: GuideStep[] = [
  {
    open: "home-tab-notifications",
    target: "notifications-panel",
    title: "Notifications",
    body: "Your notifications; an open envelope marks a read message. Scroll to load more.",
    side: "top",
  },
];
const charts: GuideStep[] = [
  {
    open: "home-tab-dynamic-charts",
    target: "dynamic-chart-tabs",
    title: "Dynamic charts",
    body: "Charts grouped by module; pick a module here.",
    side: "bottom",
  },
  {
    selector: '[id^="dynamic-module-"] [id$="-menu"]',
    title: "Chart options",
    body: "Change what a chart compares or open its full report, where available.",
    side: "left",
  },
];
const steps: Record<string, GuideStep[]> = {
  "home-tour": [
    {
      title: "Welcome to GrantsNow",
      body: "This tour shows the main parts of your dashboard. Press Esc to leave at any time.",
    },
    {
      target: "home-organization",
      title: "Organisation",
      body: "Switch organisation here; the dashboard reloads for the one you pick.",
      side: "bottom",
    },
    {
      target: "home-kpis",
      title: "Key figures",
      body: "Headline counts for the selected organisation.",
      side: "bottom",
    },
    {
      target: "home-tabs",
      title: "Dashboard tabs",
      body: "Each tab is one part of your dashboard. The tour opens them in turn.",
      side: "bottom",
    },
    attention[0],
    insights[0],
    insights[1],
    featured[0],
    notifications[0],
    charts[0],
    {
      open: "home-tab-need-attention",
      target: "shell-menu-button",
      title: "Navigation",
      body: "Open the menu to reach Proposals, Awards and other modules you can access.",
      side: "right",
    },
    {
      target: "guide-menu-button",
      title: "Guides",
      body: "Run this tour again, or a short guide for one task, from here.",
      side: "bottom",
    },
  ],
  "home-organization": [
    {
      target: "home-organization",
      title: "Pick an organisation",
      body: "Choose the organisation whose work you want to see.",
      side: "bottom",
    },
    {
      target: "home-kpis",
      title: "Figures update",
      body: "Key figures and dashboard tabs reload for the organisation you picked.",
      side: "bottom",
    },
  ],
  "home-announcements": [
    {
      target: "home-announcements-toggle",
      title: "Announcements",
      body: "Messages from your administrators. Expand or collapse them here.",
      side: "bottom",
    },
    {
      target: "home-announcements-next",
      title: "More announcements",
      body: "Step through announcements; they pause while you hover or focus them.",
      side: "bottom",
    },
  ],
  "home-kpis": [
    {
      target: "home-kpis",
      title: "Key figures",
      body: "Headline counts for the selected organisation.",
      side: "bottom",
    },
    {
      selector: '#home-kpis [id^="kpi-"]',
      title: "One figure",
      body: "Each tile is one count; switch organisation to see another's.",
      side: "bottom",
    },
  ],
  "home-attention": attention,
  "home-insights": insights,
  "home-featured": featured,
  "home-notifications": notifications,
  "home-dynamic-charts": charts,
};
export default steps;
