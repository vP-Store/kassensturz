import { useEffect, useState } from "react";
import { readThemeChoice, writeThemeChoice } from "@/lib/store";
import type { ThemeChoice } from "@/lib/types";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Theme-Auswahl mit Systemfolge — merkt sich die Wahl über Neustarts hinweg. */
export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(() => readThemeChoice());

  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    const mq = media();
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  return [
    choice,
    (next: ThemeChoice) => {
      writeThemeChoice(next);
      setChoice(next);
      applyTheme(next);
    },
  ];
}
