"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useInFlight } from "@/lib/use-in-flight";
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
import { speechRecognition, transcriptOf, type Recognition } from "./speech";
import styles from "./chatbot.module.css";

type Message =
  | { id: number; from: "user"; text: string; at: Date }
  | {
      id: number;
      from: "bot";
      html: string;
      options: string[];
      /** The quick reply picked from this answer; it stays filled, as the live app shows. */
      chosen?: string;
    };
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

const noSubscribe = () => () => {};
const hasSpeech = () => speechRecognition() !== undefined;

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
  userName,
}: {
  title: string;
  placeholder: string;
  /** Shown with the time under each of the user's messages, as the live app does. */
  userName: string;
}) {
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: Box } | null>(null);
  const dragged = useRef(false);
  const nextId = useRef(0);
  const recognition = useRef<Recognition | null>(null);
  // null = the default bottom-right spot from CSS.
  const [spot, setSpot] = useState<Point | null>(null);
  const [moving, setMoving] = useState(false);
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [listening, setListening] = useState(false);
  // The mic shows only where the browser has the Web Speech API (false on the server).
  const canListen = useSyncExternalStore(noSubscribe, hasSpeech, () => false);
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

  useEffect(() => () => recognition.current?.stop(), []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, busy, failure]);

  const ask = (question: string, show: boolean) =>
    run(async () => {
      setFailure(null);
      if (show)
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            from: "user",
            text: question,
            at: new Date(),
          },
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
    // Modal like the live app: the page behind is dimmed and inert while the chat is open.
    dialog.current?.showModal();
    setOpen(true);
    input.current?.focus();
    // The first open greets the bot with "hello", as legacy openChatBot does.
    if (messages.length === 0) void ask("hello", false);
  };

  const stopListening = () => recognition.current?.stop();

  const toggleMic = () => {
    const Ctor = speechRecognition();
    if (!Ctor) return;
    if (listening) return stopListening();
    const r = new Ctor();
    r.lang = "en-US";
    r.onresult = (e) => setText(transcriptOf(e));
    r.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = r;
    setListening(true);
    r.start();
  };

  const close = () => {
    dialog.current?.close();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = text.trim();
    if (q === "" || busy) return;
    stopListening();
    setText("");
    void ask(q, true);
  };

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
        <span className={styles.bubbleIcon} aria-hidden="true" />
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
          stopListening();
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
          {/* eslint-disable-next-line @next/next/no-img-element -- a 24px static .ico, nothing to optimise */}
          <img src="/images/gn.ico" alt="" width={24} height={24} />
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
              <div key={m.id} className={styles.mine}>
                <p className={`${styles.bubble} ${styles.user}`}>{m.text}</p>
                <small className={styles.meta}>
                  {userName}{" "}
                  {m.at.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            ) : (
              <div key={m.id} className={`${styles.bubble} ${styles.bot}`}>
                {/* Sanitized on the server (sanitizeHtml); tables render inline here, not via window.showTableById. */}
                <div dangerouslySetInnerHTML={{ __html: m.html }} />
                {/* Quick replies sit inside the answer bubble, stacked, as in the live app. */}
                {m.options.length > 0 && (
                  <div className={styles.options}>
                    {m.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        disabled={busy}
                        aria-pressed={m.chosen === o}
                        onClick={() => {
                          setMessages((all) =>
                            all.map((x) =>
                              x.id === m.id ? { ...x, chosen: o } : x,
                            ),
                          );
                          void ask(o, true);
                        }}
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
            <p
              className={`${styles.bubble} ${styles.typing}`}
              role="status"
              aria-label="Thinking"
            >
              …
            </p>
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
          {canListen && (
            <button
              type="button"
              className={styles.icon}
              data-on={listening || undefined}
              aria-pressed={listening}
              aria-label="Speak"
              onClick={toggleMic}
            >
              <Icon name="mic" />
            </button>
          )}
          <button
            type="submit"
            className={styles.icon}
            aria-label="Send"
            disabled={busy || text.trim() === ""}
          >
            <Icon name="send" />
          </button>
        </form>
      </dialog>
    </>
  );
}
