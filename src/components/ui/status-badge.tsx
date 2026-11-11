import type { ReactNode } from "react";

/** Legacy oj-badge tones; "neutral" is the plain badge, "rework" legacy's second warning (claims). */
export type StatusTone =
  "neutral" | "info" | "success" | "warning" | "rework" | "danger";

/**
 * The app's one status bubble (legacy oj-badge, measured on live DEV 2026-10-26): 12px text on an 18px line, 0 9px
 * padding, a 9px radius. Subtle (the default) is text-coloured on a translucent tone; `solid` is white on the tone.
 */
export function StatusBadge({
  id,
  tone = "neutral",
  solid = false,
  dot = false,
  className,
  children,
}: {
  id?: string;
  tone?: StatusTone;
  solid?: boolean;
  /** Legacy claim-status: the text after a dot in the tone, with no bubble. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      id={id}
      className={className ? `gn-status ${className}` : "gn-status"}
      data-tone={tone}
      data-solid={solid || undefined}
      data-dot={dot || undefined}
    >
      {children}
    </span>
  );
}
