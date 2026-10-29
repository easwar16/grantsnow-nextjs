"use client";
import dynamic from "next/dynamic";
// Client-only: tours touch the DOM and storage, so nothing renders on the server.
export const GuideMount = dynamic(
  () => import("./guide-launcher").then((m) => m.GuideLauncher),
  { ssr: false },
);
