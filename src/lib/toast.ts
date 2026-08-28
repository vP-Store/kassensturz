import { useSyncExternalStore } from "react";

export type Toast = { id: number; text: string; tone: "ok" | "error" };

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  for (const l of listeners) l();
}

function push(text: string, tone: Toast["tone"]) {
  const id = ++seq;
  toasts = [...toasts, { id, text, tone }];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}

export const toast = {
  ok: (text: string) => push(text, "ok"),
  error: (text: string) => push(text, "error"),
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
