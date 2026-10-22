import { describe, expect, it } from "vitest";
import { speechRecognition, transcriptOf } from "@/components/chatbot/speech";

class Std {}
class Prefixed {}

describe("speechRecognition", () => {
  it("prefers the standard constructor over the webkit one", () => {
    expect(
      speechRecognition({
        SpeechRecognition: Std,
        webkitSpeechRecognition: Prefixed,
      }),
    ).toBe(Std);
  });
  it("falls back to the webkit-prefixed constructor", () => {
    expect(speechRecognition({ webkitSpeechRecognition: Prefixed })).toBe(
      Prefixed,
    );
  });
  it("is undefined without either, so the mic button is hidden", () => {
    expect(speechRecognition({})).toBeUndefined();
  });
});

describe("transcriptOf", () => {
  it("takes the first alternative of the first result", () => {
    expect(
      transcriptOf({
        results: [[{ transcript: "my grants" }, { transcript: "my grunts" }]],
      }),
    ).toBe("my grants");
  });
  it("is empty when the recognizer returns no results", () => {
    expect(transcriptOf({ results: [] })).toBe("");
  });
});
