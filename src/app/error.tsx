"use client";
import { State } from "@/components/feedback/state";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main">
      <State
        title="We couldn’t load this page"
        message="Please retry. If the problem persists, contact your administrator."
        code="UPSTREAM"
        retry={reset}
      />
    </main>
  );
}
