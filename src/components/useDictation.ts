"use client";

import { useEffect, useRef, useState } from "react";

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

/** Speak your answer instead of typing it. Uses the browser's built-in speech recognition (Chrome, Edge, Safari). */
export function useDictation(onText: (text: string) => void) {
  const rec = useRef<Rec | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState("");
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-CA";
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) cb.current(text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      setError(e.error === "not-allowed" ? "Microphone access is blocked. Allow it in the address bar and try again." : "");
    };
    rec.current = r;
    return () => r.stop();
  }, []);

  const toggle = () => {
    if (!rec.current) return;
    setError("");
    if (listening) {
      rec.current.stop();
      setListening(false);
    } else {
      try {
        rec.current.start();
        setListening(true);
      } catch {
        /* already started */
      }
    }
  };

  return { supported, listening, toggle, error };
}
