import { z } from "zod";
import type { Theme } from "./themes";
export const accessibilityKeys = [
  "accFontSize",
  "accDyslexicFont",
  "accLineHeight",
  "accLetterSpacing",
  "accEnlargedCursor",
  "accHighlightLinks",
  "accContrastTheme",
] as const;
// GN-Angular's tile names (image-only tiles; the name is for screen readers).
export const accessibilityLabels = [
  "Bigger Text",
  "Dyslexia Friendly",
  "Line Height",
  "Text Spacing",
  "Cursor",
  "Highlight Links",
  "Contrast",
];
export const accessibilitySchema = z
  .object(
    Object.fromEntries(
      accessibilityKeys.map((key) => [
        key,
        z
          .number()
          .int()
          .refine(
            (value) =>
              [0, 25, 50, 75, 100].includes(value) &&
              (["accFontSize", "accLineHeight", "accLetterSpacing"].includes(
                key,
              ) ||
                value === 0 ||
                value === 100),
          ),
      ]),
    ),
  )
  .strict();
const selections = z
  .array(
    z
      .string()
      .min(1)
      .max(200)
      .refine((v) => !v.includes(",")),
  )
  .max(100);
export const researchSchema = z
  .object({
    research_areas: selections,
    favourite_funder: selections,
    research_keywords: selections,
  })
  .strict();
export const dashboardChange = z
  .object({
    // A preset or an organisation theme id; the server checks it against getCustomTheme before saving.
    theme: z
      .string()
      .regex(/^(theme-(default|dark)|apitheme:[^:\s]{1,40}:[^\n]{1,200})$/)
      .optional(),
    accessibility: accessibilitySchema.optional(),
    needAttention: z.record(z.string(), z.boolean()).optional(),
    insights: z.record(z.string(), z.boolean()).optional(),
    opportunity: z.boolean().optional(),
    notifications: z.boolean().optional(),
  })
  .strict();
/**
 * The drawer's save body: Accessibility sends its levels; Preferences sends the theme, plus the infolets only where
 * they were shown (legacy shows them on Home alone), so a save elsewhere leaves them as stored.
 */
export function preferencesChanges(
  mode: "preferences" | "accessibility",
  draft: AccountData["settings"],
  withInfolets: boolean,
): z.infer<typeof dashboardChange> {
  if (mode === "accessibility") return { accessibility: draft.accessibility };
  if (!withInfolets) return { theme: draft.theme };
  return {
    theme: draft.theme,
    needAttention: draft.needAttention,
    insights: draft.insights,
    ...(draft.opportunity === undefined
      ? {}
      : { opportunity: draft.opportunity }),
    ...(draft.notifications === undefined
      ? {}
      : { notifications: draft.notifications }),
  };
}
export function nextAccessibility(key: string, value: number) {
  return (
    (value +
      (["accFontSize", "accLineHeight", "accLetterSpacing"].includes(key)
        ? 25
        : 100)) %
    (["accFontSize", "accLineHeight", "accLetterSpacing"].includes(key)
      ? 125
      : 200)
  );
}
export type AccountData = {
  fields: { label: string; value: string }[];
  manageAllowed: boolean;
  status: {
    status_code: "ACTIVE" | "OOO";
    effective_start_date: string;
    effective_end_date: string;
    status_msg: string;
    proxy_users: { org_id: string; proxy_pid: string }[];
  };
  organizations: { id: string; name: string }[];
  research: z.infer<typeof researchSchema>;
  researchAllowed: boolean;
  options: Record<string, string[]>;
  settings: {
    theme: string;
    accessibility: Record<string, number>;
    needAttention: Record<string, boolean>;
    insights: Record<string, boolean>;
    opportunity?: boolean;
    notifications?: boolean;
  };
  labels: Record<string, string>;
  /** Preferences panel only: presets plus the organisation's themes. */
  themes: Theme[];
  /** RB `labels.digital-presence` is 'Y' (seeded 'N', so hidden unless the backend switches it on). */
  presenceAllowed: boolean;
};
export const presenceKeys = [
  "linkedin",
  "scholar",
  "research_gate",
  "orc_id",
  "researcher_id",
] as const;
export type DigitalPresence = Record<(typeof presenceKeys)[number], string>;
// Empty, or an http(s) address: these links are shown to other users.
const profileLink = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v),
    "Enter a web address.",
  );
/** H1: the five contracted keys only (legacy SaveDigitalPresenceActionChain). */
export const presenceSchema = z
  .object({
    linkedin: profileLink,
    scholar: profileLink,
    research_gate: profileLink,
    orc_id: profileLink,
    researcher_id: profileLink,
  })
  .strict();
export const personStatusSchema = z
  .object({
    status_code: z.enum(["ACTIVE", "OOO"]),
    effective_start_date: z.string().max(40),
    effective_end_date: z.string().max(40),
    status_msg: z.string().max(2000),
    proxy_users: z
      .array(
        z
          .object({
            org_id: z.string().regex(/^\d+$/),
            proxy_pid: z.string().regex(/^\d+$/),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.status_code === "OOO" &&
      (!v.status_msg.trim() ||
        !v.proxy_users.length ||
        !Number.isFinite(Date.parse(v.effective_start_date)) ||
        !Number.isFinite(Date.parse(v.effective_end_date)) ||
        Date.parse(v.effective_end_date) <=
          Date.parse(v.effective_start_date) ||
        !/(Z|[+-]\d\d:\d\d)$/.test(v.effective_start_date) ||
        !/(Z|[+-]\d\d:\d\d)$/.test(v.effective_end_date))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Out of Office requires a message, proxy and valid start/end dates.",
      });
  });
