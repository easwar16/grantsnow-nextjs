"use client";
import { useState } from "react";
export function Announcements({
  messages,
  error,
}: {
  messages: string[];
  error?: string;
}) {
  const [page, setPage] = useState(0);
  if (error)
    return (
      <p className="notice" role="status">
        Announcements unavailable. {error}
      </p>
    );
  if (!messages.length) return null;
  return (
    <details className="announcements" open>
      <summary>Announcements</summary>
      <div
        className="announcement-slide"
        role="region"
        aria-roledescription="carousel"
        aria-label="Announcements"
      >
        <button
          aria-label="Previous announcement"
          onClick={() =>
            setPage((page + messages.length - 1) % messages.length)
          }
        >
          ‹
        </button>
        <div
          className="announcement-content"
          aria-live="polite"
          dangerouslySetInnerHTML={{ __html: messages[page] }}
        />
        <button
          aria-label="Next announcement"
          onClick={() => setPage((page + 1) % messages.length)}
        >
          ›
        </button>
        <span className="sr-only">
          Displaying page {page + 1} of {messages.length}
        </span>
      </div>
    </details>
  );
}
