// src/lib/useSpeech.ts
import { useCallback, useEffect, useRef } from "react";
import { logError } from "./logger";

type ResultHandler = (text: string) => void | Promise<void>;

export default function useSpeechRecognition(onResult: ResultHandler) {
  const recRef = useRef<any>(null);
  const supported =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    if (!supported) return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let rec: any;
    try {
      rec = new Ctor();
    } catch (err) {
      logError(err);
      return;
    }
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = async (e: any) => {
      try {
        const txt = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
        if (txt) await onResult(txt);
      } catch (err) {
        // ignore handler errors but log
        logError(err);
      } finally {
        try { rec.stop(); } catch (err) { logError(err); }
      }
    };
    rec.onerror = () => {};
    recRef.current = rec;
    return () => {
      try { rec.stop(); } catch (err) { logError(err); }
      recRef.current = null;
    };
  }, [onResult, supported]);

  const start = useCallback(() => {
    try { recRef.current && recRef.current.start(); } catch (err) { logError(err); }
  }, []);

  const stop = useCallback(() => {
    try { recRef.current && recRef.current.stop(); } catch (err) { logError(err); }
  }, []);

  return { start, stop, supported: !!supported };
}
