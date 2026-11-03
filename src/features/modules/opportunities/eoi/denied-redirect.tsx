"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/toast";
import { DetailSkeleton } from "@/components/feedback/skeleton";
/**
 * The original's access redirects: no rights on the record go back to the list ("Access Denied / You don't have
 * access to this AOI"); a tab without access goes to Summary. The server has already refused the content.
 */
export function DeniedRedirect({
  title,
  message,
  href,
}: {
  title: string;
  message: string;
  href: string;
}) {
  const router = useRouter(),
    toast = useToast(),
    done = useRef(false);
  useEffect(() => {
    // Once, though development renders effects twice.
    if (done.current) return;
    done.current = true;
    toast.show("error", title, message);
    router.replace(href);
  }, [router, toast, title, message, href]);
  return <DetailSkeleton label="Redirecting" />;
}
