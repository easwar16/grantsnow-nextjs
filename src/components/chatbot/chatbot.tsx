"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useInFlight } from "@/lib/use-in-flight";
import { Skeleton } from "@/components/feedback/skeleton";
import {
  chatPosition,
  dragTo,
  keepInView,
  snapToEdge,
  toEdge,
  type Box,
  type Edge,
  type Point,
} from "./position";
import { Icon } from "@/components/ui/icon";
import styles from "./chatbot.module.css";

type Message =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; html: string; options: string[] };
type Failure = { message: string; action?: string };
type Frame = ReturnType<typeof chatPosition>;
const UNAVAILABLE: Failure = {
  message: "The GrantsNow assistant is unavailable. Please retry.",
};
const KEY_EDGE: Record<string, Edge> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "top",
  ArrowDown: "bottom",
};
// A press that moves less than this is a click, not a drag (as GN-Angular).
const DRAG_THRESHOLD = 5;

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};
/** The dialog frame for the launcher's resting spot, not a mid-transition rect. */
function frameFor(el: HTMLElement, spot: Point | null) {
  const b = { ...boxOf(el), ...spot };
  return chatPosition(
    {
      top: b.top,
      bottom: b.top + b.height,
      right: b.left + b.width,
      height: b.height,
    },
    innerWidth,
    innerHeight,
  );
}

/**
 * The GrantsNow chatbot (D26): a launcher that drags anywhere and snaps to the nearest edge
 * (arrow keys move it to an edge), and a non-modal dialog placed by `chatPosition`.
 * Default spot is bottom-right (owner, 2026-10-22); the spot is not persisted, as the original.
 */
export function Chatbot({
  title,
  placeholder,
}: {
  title: string;
  placeholder: string;
}) {
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: Box } | null>(null);
  const dragged = useRef(false);
  const nextId = useRef(0);
  // null = the default bottom-right spot from CSS.
  const [spot, setSpot] = useState<Point | null>(null);
  const [moving, setMoving] = useState(false);
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const { run, busy } = useInFlight();
  const titleId = useId(),
    hintId = useId();

  useEffect(() => {
    const onResize = () => {
      const el = launcher.current;
      if (!el) return;
      const next =
        spot && keepInView({ ...boxOf(el), ...spot }, innerWidth, innerHeight);
      if (next) setSpot(next);
      if (open) setFrame(frameFor(el, next));
    };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [open, spot]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, busy, failure]);

  const ask = (question: string, show: boolean) =>
    run(async () => {
      setFailure(null);
      if (show)
        setMessages((m) => [
          ...m,
          { id: nextId.current++, from: "user", text: question },
        ]);
      try {
        const response = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          cache: "no-store",
          // Server waits up to 60s for the assistant; this bounds the whole round trip.
          signal: AbortSignal.timeout(70000),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || typeof body?.html !== "string") {
          setFailure(body?.error?.message ? body.error : UNAVAILABLE);
          return;
        }
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            from: "bot",
            html: body.html,
            options: Array.isArray(body.options) ? body.options : [],
          },
        ]);
      } catch {
        setFailure(UNAVAILABLE);
      }
    });

  const show = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (dialog.current?.open) return;
    if (launcher.current) setFrame(frameFor(launcher.current, spot));
    dialog.current?.show();
    setOpen(true);
    input.current?.focus();
    // The first open greets the bot with "hello", as legacy openChatBot does.
    if (messages.length === 0) void ask("hello", false);
  };

  const close = () => {
    dialog.current?.close();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = text.trim();
    if (q === "" || busy) return;
    setText("");
    void ask(q, true);
  };

  const lastBot = messages.findLast((m) => m.from === "bot");

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={styles.launcher}
        data-moving={moving || undefined}
        style={
          spot
            ? { left: spot.left, top: spot.top, right: "auto", bottom: "auto" }
            : undefined
        }
        aria-label={title}
        aria-describedby={hintId}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
        onPointerDown={(e) => {
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            start: boxOf(e.currentTarget),
          };
          dragged.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (
            !dragged.current &&
            Math.abs(dx) < DRAG_THRESHOLD &&
            Math.abs(dy) < DRAG_THRESHOLD
          )
            return;
          dragged.current = true;
          setMoving(true);
          setSpot(dragTo(d.start, dx, dy, innerWidth, innerHeight));
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          drag.current = null;
          setMoving(false);
          if (dragged.current)
            setSpot(
              snapToEdge(boxOf(e.currentTarget), innerWidth, innerHeight),
            );
        }}
        onPointerCancel={(e) => {
          drag.current = null;
          setMoving(false);
          if (dragged.current)
            setSpot(
              snapToEdge(boxOf(e.currentTarget), innerWidth, innerHeight),
            );
          dragged.current = false;
        }}
        onKeyDown={(e) => {
          const edge = KEY_EDGE[e.key];
          if (!edge) return;
          e.preventDefault();
          setSpot(
            toEdge(boxOf(e.currentTarget), edge, innerWidth, innerHeight),
          );
        }}
      >
        <Icon name="chat" size={30} />
      </button>
      <span id={hintId} hidden>
        Drag, or use the arrow keys, to move the chat button to an edge.
      </span>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        style={frame ?? undefined}
        onClose={() => {
          setOpen(false);
          launcher.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
      >
        <div className={styles.head}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.log} ref={log} role="log" aria-live="polite">
          {messages.map((m) =>
            m.from === "user" ? (
              <p key={m.id} className={`${styles.bubble} ${styles.user}`}>
                {m.text}
              </p>
            ) : (
              <div key={m.id} className={styles.answer}>
                {/* Sanitized on the server (sanitizeHtml); tables render inline here, not via window.showTableById. */}
                <div
                  className={styles.bubble}
                  dangerouslySetInnerHTML={{ __html: m.html }}
                />
                {m === lastBot && m.options.length > 0 && (
                  <div className={styles.options}>
                    {m.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        disabled={busy}
                        onClick={() => void ask(o, true)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
          {busy && (
            <Skeleton
              kind="lines"
              count={2}
              label="Waiting for the answer"
              className={styles.pending}
            />
          )}
          {failure && (
            <p className={styles.failure} role="alert">
              {failure.message}
              {failure.action && <span> {failure.action}</span>}
            </p>
          )}
        </div>
        <form className={styles.foot} onSubmit={submit}>
          <input
            ref={input}
            name="question"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            maxLength={2000}
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || text.trim() === ""}
          >
            Send
          </button>
        </form>
      </dialog>
    </>
  );
}
