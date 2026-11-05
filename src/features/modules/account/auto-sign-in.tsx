"use client";
import { useEffect } from "react";

/** Legacy VBCS goes straight to IDCS: submit the sign-in form once, as soon as the login page loads. */
export function AutoSignIn({ formId }: { formId: string }) {
  useEffect(() => {
    document.querySelector<HTMLFormElement>(`#${formId}`)?.requestSubmit();
  }, [formId]);
  return null;
}
