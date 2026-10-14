"use client";
import { useEffect, useRef, useState } from "react";
import { LatestRequest } from "./latest-request";
export function useRemote<T>(url: string) {
  const [result, setResult] = useState<{
    url: string;
    data?: T;
    error?: { message: string; code: string };
  }>();
  const [attempt, setAttempt] = useState(0),
    requests = useRef(new LatestRequest());
  useEffect(() => {
    const coordinator = requests.current;
    const request = coordinator.begin();
    fetch(url, { signal: request.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (request.current())
          setResult(
            response.ok
              ? { url, data: body }
              : {
                  url,
                  error: body.error || {
                    code: "UPSTREAM",
                    message: "This request failed.",
                  },
                },
          );
      })
      .catch(() => {
        if (request.current())
          setResult({
            url,
            error: {
              code: "UPSTREAM",
              message: "This request could not be completed.",
            },
          });
      });
    return () => coordinator.cancel();
  }, [url, attempt]);
  return {
    data: result?.url === url ? result.data : undefined,
    error: result?.url === url ? result.error : undefined,
    retry: () => {
      setResult(undefined);
      setAttempt((a) => a + 1);
    },
  };
}
