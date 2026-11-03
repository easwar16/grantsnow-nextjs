"use client";
import { State } from "@/components/feedback/state";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <State
      title="This page is unavailable"
      message="Please retry or contact your administrator."
      code="UPSTREAM"
      retry={reset}
    />
  );
}
