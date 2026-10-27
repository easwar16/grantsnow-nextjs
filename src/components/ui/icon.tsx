/**
 * App icon names → Oracle `oj-ux-ico-*` glyphs (D14), from the gallery bundle the root layout loads.
 * `material` is the agreed Material Symbols fallback; switching sets means changing only this map.
 * Ported from GN-Angular `shared/icon/icon.ts`.
 */
const icons = {
  menu: { ux: "menu", material: "menu" },
  help: { ux: "help", material: "help" },
  bell: { ux: "notification", material: "notifications" },
  "caret-down": { ux: "caret-down", material: "arrow_drop_down" },
  "chevron-down": { ux: "chevron-down", material: "expand_more" },
  "chevron-up": { ux: "chevron-up", material: "expand_less" },
  "chevron-left": { ux: "chevron-left", material: "chevron_left" },
  "chevron-right": { ux: "chevron-right", material: "chevron_right" },
  "chevron-double-left": {
    ux: "chevron-double-left",
    material: "keyboard_double_arrow_left",
  },
  "chevron-double-right": {
    ux: "chevron-double-right",
    material: "keyboard_double_arrow_right",
  },
  flag: { ux: "priority-highest", material: "flag" },
  chart: { ux: "chart-running-aggregate", material: "show_chart" },
  money: { ux: "currency-money", material: "payments" },
  dynamic: { ux: "dynamic-content", material: "dynamic_feed" },
  info: { ux: "information", material: "info" },
  expand: { ux: "expand", material: "open_in_full" },
  "arrow-up": { ux: "arrow-up", material: "arrow_upward" },
  "arrow-down": { ux: "arrow-down", material: "arrow_downward" },
  "arrow-left": { ux: "arrow-left", material: "arrow_back" },
  "arrow-right": { ux: "arrow-right", material: "arrow_forward" },
  "arrow-circle-up": { ux: "arrow-circle-up", material: "arrow_circle_up" },
  "arrow-circle-down": {
    ux: "arrow-circle-down",
    material: "arrow_circle_down",
  },
  close: { ux: "close", material: "close" },
  "close-circle": { ux: "close-circle", material: "cancel" },
  home: { ux: "home", material: "home" },
  "external-link": { ux: "external-link", material: "open_in_new" },
  account: { ux: "account", material: "person" },
  analytics: { ux: "analytics", material: "analytics" },
  "file-stage": { ux: "file-stage", material: "description" },
  folder: { ux: "folder", material: "folder" },
  adapter: { ux: "adapter", material: "cable" },
  split: { ux: "split", material: "call_split" },
  "add-level": { ux: "add-level", material: "playlist_add" },
  "file-spreadsheet": { ux: "file-spreadsheet", material: "table" },
  "composite-form": { ux: "composite-form", material: "dynamic_form" },
  // The bundle's own spelling.
  "due-diligence": { ux: "due-dillegence", material: "fact_check" },
  deposits: { ux: "deposits", material: "savings" },
  signature: { ux: "signature", material: "draw" },
  report: { ux: "report-package", material: "summarize" },
  billboard: { ux: "billboard", material: "campaign" },
  administration: { ux: "administration", material: "admin_panel_settings" },
  support: { ux: "support-services", material: "support_agent" },
  "document-link": { ux: "document-link", material: "link" },
  "user-configuration": {
    ux: "user-configuration",
    material: "manage_accounts",
  },
  settings: { ux: "settings", material: "settings" },
  accessibility: { ux: "accessibility", material: "accessibility" },
  logout: { ux: "logout", material: "logout" },
  email: { ux: "email", material: "mail" },
  "email-unread": { ux: "email-unread", material: "mark_email_unread" },
  bookmark: { ux: "bookmark", material: "bookmark_border" },
  "bookmark-selected": { ux: "bookmark-selected", material: "bookmark" },
  share: { ux: "share", material: "share" },
  notes: { ux: "notes", material: "sticky_note_2" },
  workflow: { ux: "workflow-role", material: "account_tree" },
  "opportunity-logo": { ux: "customer-refund", material: "request_quote" },
  overflow: { ux: "overflow-h", material: "more_horiz" },
  trash: { ux: "trash", material: "delete" },
  reset: { ux: "reset", material: "restart_alt" },
  send: { ux: "send", material: "send" },
  mic: { ux: "mic-on", material: "mic" },
  employee: { ux: "employee", material: "badge" },
  save: { ux: "save", material: "save" },
  cancel: { ux: "cancel", material: "block" },
  calendar: { ux: "calendar", material: "calendar_today" },
  contact: { ux: "contact", material: "account_circle" },
  chat: { ux: "chat-on", material: "chat" },
  search: { ux: "search", material: "search" },
  "search-list": { ux: "search-list", material: "manage_search" },
  "reset-filters": { ux: "reset-filters", material: "filter_alt_off" },
  filter: { ux: "filter", material: "filter_alt" },
  "data-document": { ux: "data-document", material: "article" },
  view: { ux: "view", material: "visibility" },
  list: { ux: "list", material: "view_list" },
  copy: { ux: "copy", material: "content_copy" },
  link: { ux: "link", material: "link" },
  "smart-filter": { ux: "smart-filter", material: "filter_list" },
  "new-application": { ux: "new-application", material: "note_add" },
  "grid-view": { ux: "grid-view-small", material: "grid_view" },
  "collapse-menu": { ux: "collapse-menu", material: "left_panel_close" },
  "document-attachment": {
    ux: "document-attachment",
    material: "description",
  },
  pen: { ux: "pen", material: "edit" },
  edit: { ux: "edit", material: "edit" },
  comment: { ux: "comment", material: "comment" },
  action: { ux: "action", material: "bolt" },
  attachment: { ux: "attachment", material: "attach_file" },
  "clock-history": { ux: "clock-history", material: "history" },
  audits: { ux: "audits", material: "fact_check" },
  success: { ux: "success-s", material: "check_circle" },
  code: { ux: "code", material: "code" },
  plus: { ux: "plus", material: "add" },
  draft: { ux: "draft", material: "draft" },
  download: { ux: "download", material: "download" },
} as const satisfies Record<string, { ux: string; material: string }>;

export type IconName = keyof typeof icons;

/** One glyph; decorative (aria-hidden) unless `label` names it. Size follows font-size (16px default). */
export function Icon({
  name,
  label,
  size,
  className,
}: {
  name: IconName;
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`gn-icon oj-ux-ico-${icons[name].ux}${className ? ` ${className}` : ""}`}
      style={size === undefined ? undefined : { fontSize: size }}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    />
  );
}
