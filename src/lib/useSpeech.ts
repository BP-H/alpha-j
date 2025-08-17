// src/lib/useSpeech.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "./logger";

interface SpeechOptions {
  onResult: (text: string) => void | Promise<void>;
  onInterim?: (text: string) => void | Promise<void>;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (e: unknown) => void;
}

/**
 * Thin wrapper around the Web Speech API.
 * Handles restart logic, final and interim results, and exposes start/stop
 * methods. Consumers can subscribe to lifecycle callbacks.
 */
export default function useSpeech({
  onResult,
  onInterim,
  onStart,
  onEnd,
  onError,
}: SpeechOptions) {
  const recRef = useRef<any>(null);
  const activeRef = useRef(false);
  const [error, setError] = useState<string>("");

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
      setError("Speech recognition unavailable");
      return;
    }

    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = !!onInterim;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      onStart?.();
    };

    rec.onend = () => {
      onEnd?.();
      // Safari ends even with continuous=true; restart if still active
      if (activeRef.current) {
        try {
          rec.start();
        } catch (err) {
          logError(err);
        }
      }
    };

    rec.onerror = (e: unknown) => {
      logError(e);
      setError("Speech recognition failed");
      onError?.(e);
    };

    rec.onresult = async (e: any) => {
      try {
        if (onInterim) {
          let temp = "";
          const finals: string[] = [];
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            const t = r[0] && r[0].transcript ? r[0].transcript : "";
            r.isFinal ? finals.push(t) : (temp += t);
          }
          onInterim(temp.trim());
          const final = finals.join(" ").trim();
          if (final) await onResult(final);
        } else {
          const txt = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
          if (txt) await onResult(txt);
        }
      } catch (err) {
        logError(err);
      }
    };

    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch (err) {
        logError(err);
      }
      recRef.current = null;
    };
  }, [onResult, onInterim, onStart, onEnd, onError, supported]);

  const start = useCallback(() => {
    activeRef.current = true;
    try {
      recRef.current && recRef.current.start();
    } catch (err) {
      logError(err);
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    try {
      recRef.current && recRef.current.stop();
    } catch (err) {
      logError(err);
    }
  }, []);

  return { start, stop, supported: !!supported, error };
}

