/** The Web Speech API surface the chatbot uses (GN-Angular chatbot.ts). */
export type Recognition = {
  lang: string;
  onresult: (event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void;
  onend: () => void;
  start(): void;
  stop(): void;
};
export type RecognitionCtor = new () => Recognition;

/** The recognition constructor, if the browser has one; Chrome still ships it prefixed. */
export function speechRecognition(
  scope: object = globalThis,
): RecognitionCtor | undefined {
  const s = scope as Record<string, RecognitionCtor | undefined>;
  return s.SpeechRecognition ?? s.webkitSpeechRecognition;
}

/** The first alternative of the first result, as GN-Angular writes it into the input. */
export const transcriptOf = (event: Parameters<Recognition["onresult"]>[0]) =>
  event.results[0]?.[0]?.transcript ?? "";
