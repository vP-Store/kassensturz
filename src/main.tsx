import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";
import { readThemeChoice, runAutoBook } from "@/lib/store";
import { applyTheme } from "@/lib/theme";
import "@/styles.css";

applyTheme(readThemeChoice());

// Alles nachholen, was seit dem letzten Öffnen fällig war.
try {
  runAutoBook();
} catch (err) {
  console.error("[kassensturz] Automatische Buchungen fehlgeschlagen", err);
}

const el = document.getElementById("app");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

// Service Worker für Offline-Betrieb und Installation.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err) => {
      console.error("[kassensturz] Service Worker nicht registriert", err);
    });
  });
}
