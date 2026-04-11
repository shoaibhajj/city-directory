"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AutosaveState } from "./autosave-indicator";

type UseDebouncedAutosaveOptions<T> = {
  value: T;
  isValid: boolean;
  onSave: (value: T) => Promise<void>;
  delay?: number;
};

export function useDebouncedAutosave<T>({
  value,
  isValid,
  onSave,
  delay = 2000,
}: UseDebouncedAutosaveOptions<T>) {
  const [state, setState] = useState<AutosaveState>("idle");
  const [, startTransition] = useTransition();

  // Track the last serialized value we saved or initialized with
  const previousSerializedRef = useRef<string | null>(null);
  // Track whether we've mounted yet (skip first render)
  const mountedRef = useRef(false);
  // Stable ref to the latest onSave so the timeout closure never goes stale
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const serialized = JSON.stringify(value);

    // Skip the very first render — set the baseline and do nothing
    if (!mountedRef.current) {
      mountedRef.current = true;
      previousSerializedRef.current = serialized;
      return;
    }

    // Nothing actually changed — do not touch state at all
    if (serialized === previousSerializedRef.current) return;

    // Only start the autosave timer if the form is valid
    if (!isValid) {
      // Show dirty without triggering a cascading render:
      // use a microtask so this setState is not synchronous in the effect body
      const id = window.setTimeout(() => setState("dirty"), 0);
      return () => window.clearTimeout(id);
    }

    // Schedule autosave — setState inside the timeout is async, not synchronous
    const timer = window.setTimeout(() => {
      setState("saving");

      startTransition(async () => {
        try {
          await onSaveRef.current(value);
          previousSerializedRef.current = serialized;
          setState("saved");
        } catch {
          setState("error");
        }
      });
    }, delay);

    // Show dirty immediately but async via microtask — not synchronous in effect body
    const dirtyTimer = window.setTimeout(() => setState("dirty"), 0);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(dirtyTimer);
    };
  }, [value, isValid, delay]);

  return { state, setState };
}
