/** A selectable theme: the two VBCS presets (themeRegistry) plus the organisation's getCustomTheme rows. */
export interface Theme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background?: string;
  text?: string;
  dark: boolean;
}
export const DEFAULT_THEME = "theme-default";
export const presetThemes: Theme[] = [
  {
    id: DEFAULT_THEME,
    name: "Default",
    primary: "#315357",
    secondary: "#f0cc71",
    dark: false,
  },
  {
    id: "theme-dark",
    name: "Dark",
    primary: "#0a0a0a",
    secondary: "#f0a957",
    background: "#1f1e1c",
    text: "#f5f4f2",
    dark: true,
  },
];
// Colours land in a style attribute, so only plain hex / rgb() / hsl() values pass.
const colour = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d.,%\s/]+\))$/i;
export const isColour = (value: unknown): value is string =>
  typeof value === "string" && colour.test(value.trim());
/** GN-Angular's id for an admin theme, as stored in dashboardPreferences.theme. */
export const customThemeId = (legalId: unknown, name: string) =>
  `apitheme:${String(legalId)}:${name}`;
/** The saved theme, or the default preset when the id is unknown (GN-Angular applyTheme). */
export function findTheme(themes: Theme[], id: string | undefined) {
  return themes.find((t) => t.id === id) ?? presetThemes[0];
}
/** GN-Angular applyTheme's variables: brand always, background and text only when the theme sets them. */
export function themeVariables(theme: Theme): Record<string, string> {
  return {
    "--gn-brand": theme.primary,
    "--gn-brand-deep": theme.primary,
    ...(theme.background ? { "--gn-bg": theme.background } : {}),
    ...(theme.text ? { "--gn-text": theme.text } : {}),
  };
}
