"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { constants } from "@/lib/constants";

// Legacy updateAnnouncementCurrentItem (app-flow.js) advances the film strip every 5 s and loops.
/** The next slide index, wrapping at both ends like the legacy film strip's looping="page". */
export const stepSlide = (index: number, delta: number, count: number) =>
  count < 1 ? 0 : (((index + delta) % count) + count) % count;
/** `id` comes from the page (Home, the finder); its parts take `${id}-toggle`, `${id}-strip` and so on. */
export function Announcements({
  id,
  title,
  messages,
  error,
}: {
  id: string;
  /** RB `labels.announcements`. */
  title: string;
  messages: string[];
  error?: string;
}) {
  const [index, setIndex] = useState(0),
    [expanded, setExpanded] = useState(true),
    // Hover or keyboard focus holds the current item so it can be read (WCAG 2.2.2); legacy never paused.
    [paused, setPaused] = useState(false);
  const count = messages.length,
    current = Math.min(index, Math.max(count - 1, 0));
  useEffect(() => {
    if (!expanded || paused || count < 2) return;
    const timer = setInterval(
      () => setIndex((i) => stepSlide(i, 1, count)),
      constants.timing.announcementAdvanceMs,
    );
    return () => clearInterval(timer);
  }, [expanded, paused, count]);
  if (error)
    return (
      <p id={`${id}-error`} className="notice" role="status">
        Announcements unavailable. {error}
      </p>
    );
  if (!count) return null;
  return (
    <section id={id} className="announcements" aria-label={title}>
      <h2 className="announcements-toggle">
        <button
          id={`${id}-toggle`}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          <Icon name={expanded ? "chevron-down" : "chevron-right"} />
          <span>{title}</span>
        </button>
      </h2>
      {expanded && (
        <div
          id={`${id}-strip`}
          className="announcement-strip enter-expand"
          role="region"
          aria-roledescription="carousel"
          aria-label={title}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <button
            id={`${id}-previous`}
            type="button"
            aria-label="Previous announcement"
            onClick={() => setIndex(stepSlide(current, -1, count))}
          >
            <Icon name="chevron-left" />
          </button>
          {/* Rotating content is not live (WAI carousel pattern); it is once paused or stepped by hand. */}
          <div
            className="announcement-viewport"
            aria-live={paused ? "polite" : "off"}
          >
            <div
              className="announcement-track"
              style={{ transform: `translateX(${-current * 100}%)` }}
            >
              {messages.map((html, i) => (
                <div
                  key={i}
                  className="announcement-content"
                  aria-hidden={i !== current}
                  inert={i !== current}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ))}
            </div>
          </div>
          <button
            id={`${id}-next`}
            type="button"
            aria-label="Next announcement"
            onClick={() => setIndex(stepSlide(current, 1, count))}
          >
            <Icon name="chevron-right" />
          </button>
          <span className="sr-only">
            Displaying page {current + 1} of {count}
          </span>
        </div>
      )}
    </section>
  );
}
