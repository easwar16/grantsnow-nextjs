import "server-only";
import { cache } from "react";
import { account } from "@/server/oracle/api";
import {
  customThemeId,
  isColour,
  presetThemes,
  type Theme,
} from "@/features/modules/account/themes";
/** Maps getCustomTheme rows; a row without a usable name or colours is dropped, not guessed. */
export function customThemeRows(body: unknown): Theme[] {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((row: Record<string, unknown>) => {
    const name =
      typeof row.display_name === "string" ? row.display_name.trim() : "";
    if (
      name === "" ||
      !isColour(row.primary_color) ||
      !isColour(row.secondary_color)
    )
      return [];
    return [
      {
        id: customThemeId(row.legal_id, name),
        name,
        primary: row.primary_color.trim(),
        secondary: row.secondary_color.trim(),
        ...(isColour(row.background_color)
          ? { background: row.background_color.trim() }
          : {}),
        ...(isColour(row.text_color) ? { text: row.text_color.trim() } : {}),
        dark: row.is_dark === "Y",
      },
    ];
  });
}
/** Presets plus the organisation's themes; on failure the presets alone, as GN-Angular degrades. */
export const availableThemes = cache(async (): Promise<Theme[]> => {
  try {
    return [
      ...presetThemes,
      // Only a good answer is held, so the presets-only fallback is retried.
      ...customThemeRows(await account.customThemes()),
    ];
  } catch (e) {
    // An expired session must still send the user to sign in.
    if ((e as { status?: number }).status === 401) throw e;
    return presetThemes;
  }
});
