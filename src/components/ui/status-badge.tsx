import type { ReactNode } from "react";

/** Legacy oj-badge tones; "neutral" is the plain badge. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * The app's one status bubble (legacy oj-badge, measured on live DEV 2026-10-26): 12px text on an 18px line, 0 9px
 * padding, a 9px radius. Subtle (the default) is text-coloured on a translucent tone; `solid` is white on the tone.
 */
export function StatusBadge({
  id,
  tone = "neutral",
  solid = false,
  className,
  children,
}: {
  id?: string;
  tone?: StatusTone;
  solid?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      id={id}
      className={className ? `gn-status ${className}` : "gn-status"}
      data-tone={tone}
      data-solid={solid || undefined}
    >
      {children}
    </span>
  );
}
