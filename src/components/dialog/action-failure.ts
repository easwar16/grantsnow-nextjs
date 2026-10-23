"use client";
import { useCallback } from "react";
import { useToast } from "@/components/feedback/toast";
import type { ApiError } from "@/lib/api";
export type ActionError = ApiError;
/** A failed action as GN-Angular shows it: writes switched off are an info toast, anything else an error. */
export function useActionFailure() {
  const toast = useToast();
  return useCallback(
    (error: ActionError) =>
      error.code === "WRITES_DISABLED"
        ? toast.show("info", error.message)
        : toast.error(error),
    [toast],
  );
}
