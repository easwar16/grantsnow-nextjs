"use client";
import { useSyncExternalStore } from "react";
import { useFormat } from "@/components/layout/shell-context";
import { dateTimeDisplay, stampDisplay } from "@/lib/format";

const noop = () => () => {};
/**
 * A timestamp in the viewer's time zone and the configured date format: `stamp` is legacy's `HH:mm:ss` converter,
 * `minutes` its `hh:mm a`. The server cannot know the zone, so it renders nothing and the browser fills it in.
 */
export function LocalTime({
  value,
  kind = "stamp",
}: {
  value: string | null | undefined;
  kind?: "stamp" | "minutes";
}) {
  const format = useFormat();
  const browser = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!browser) return null;
  return (
    <>
      {kind === "stamp"
        ? stampDisplay(value, format)
        : dateTimeDisplay(value, format)}
    </>
  );
}
