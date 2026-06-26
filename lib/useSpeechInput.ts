"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceError = { field: string; message: string };

export type VoiceControl = {
  supported: boolean;
  listeningField: string | null;
  interim: string;
  error: VoiceError | null;
  start: (field: string, currentValue: string, onText: (text: string) => void) => void;
  stop: () => void;
};

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function friendlyError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access denied. Allow mic permissions and try again.";
    case "audio-capture":
      return "No microphone found.";
    case "no-speech":
      return "Didn't catch anything. Tap the mic and try again.";
    case "network":
      return "Speech service unreachable. Check your connection.";
    default:
      return "Voice input failed. Try again or just type.";
  }
}

/**
 * One recognition session at a time. Text composition rule:
 * field = (text at listen start) + (accumulated FINAL transcripts) + (current interim).
 * Interim text is replaced on every event — never appended — which is what
 * prevents the classic duplicated-words bug.
 */
export function useSpeechInput(): VoiceControl {
  const [supported, setSupported] = useState(false);
  const [listeningField, setListeningField] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);

  const recognitionRef = useRef<any>(null);
  const baseRef = useRef("");
  const finalsRef = useRef("");
  const fieldRef = useRef<string | null>(null);
  const onTextRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
    return () => {
      try { recognitionRef.current?.abort(); } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
  }, []);

  const start = useCallback((field: string, currentValue: string, onText: (text: string) => void) => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Switching fields mid-session: kill the old session first.
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    baseRef.current = currentValue.trim();
    finalsRef.current = "";
    fieldRef.current = field;
    onTextRef.current = onText;
    setError(null);
    setInterim("");

    recognition.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          finalsRef.current = `${finalsRef.current} ${transcript}`.trim();
        } else {
          interimText += transcript;
        }
      }
      interimText = interimText.trim();
      setInterim(interimText);
      const composed = [baseRef.current, finalsRef.current, interimText]
        .filter(Boolean)
        .join(" ");
      onTextRef.current(composed);
    };

    recognition.onerror = (event: any) => {
      // "aborted" fires when we intentionally switch fields — not a user-facing error.
      if (event.error === "aborted") return;
      const at = fieldRef.current;
      if (at) setError({ field: at, message: friendlyError(event.error || "") });
    };

    recognition.onend = () => {
      // Commit whatever was recognized; interim that never finalized stays in
      // the field because onresult already wrote the composed value.
      setListeningField(null);
      setInterim("");
      fieldRef.current = null;
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListeningField(field);
    } catch {
      setError({ field, message: "Couldn't start the microphone. Try again." });
    }
  }, []);

  return { supported, listeningField, interim, error, start, stop };
}
