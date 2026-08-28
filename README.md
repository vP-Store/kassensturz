# Kassensturz

Haushaltsbuch für Privat und Gewerbe. Läuft komplett im Browser: kein Server,
kein Login, kein Konto. Alle Daten bleiben auf dem Gerät und die App
funktioniert offline — auch vom Homescreen aus.

## Was sie kann

- **Übersicht** — verfügbares Geld, verfügbar nach Fixkosten und „so viel darfst
  du pro Tag ausgeben, bis das nächste Geld kommt“
- **Zyklus statt Kalendermonat** — der Monat beginnt an deinem Zahltag; der Tag
  ist frei einstellbar
- **Fixkosten** — mit einem Tipp abhaken; das bucht sie und schiebt sie auf den
  nächsten Termin. Wahlweise ganz automatisch
- **Buchen** in drei Sekunden, Buchungen suchen, ändern, löschen
- **Budget** nach Kategorie-Limits, Umschlägen, 50/30/20 oder Zero-based
- **Berichte** — wohin das Geld fließt, Verlauf über sechs Zeiträume
- **Sparziele und Schulden** — Einzahlung oder Rate wird gebucht *und* der Stand
  angepasst
- **Privat und Gewerbe** getrennt ausgewertet, oben trotzdem die Summe
- **Hell, dunkel oder automatisch** nach Systemeinstellung
- **Sicherung** als JSON, Buchungen als CSV — Import inklusive

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # erzeugt dist/ inkl. Service Worker
npm run preview
```

## Veröffentlichen

Ein Push auf `main` baut die App und stellt sie über GitHub Pages bereit
(`.github/workflows/deploy.yml`). Einmalig in den Repository-Einstellungen unter
**Settings → Pages → Source** „GitHub Actions“ auswählen.

Der Basispfad kommt aus `VITE_BASE`; im Workflow wird automatisch der
Repository-Name eingesetzt.

## Daten

Alles liegt im `localStorage` des Browsers unter `kassensturz.db.v2`. Das heißt:

- kein Konto, kein Server, keine Kosten
- die Daten gehören zu *diesem* Browser auf *diesem* Gerät
- für den Umzug auf ein neues Gerät: Einstellungen → Sicherung herunterladen,
  auf dem neuen Gerät wieder einspielen

Im Quellcode stehen bewusst **keine** persönlichen Zahlen. `src/lib/seed-data.ts`
enthält nur neutrale Konten und Kategorien, damit man sofort loslegen kann.
Eigene Fixkosten kommen entweder direkt in der App dazu oder über eine
eingespielte Sicherungsdatei.

## Technik

React 19, TanStack Router (Hash-Routing, damit tiefe Links auf GitHub Pages
funktionieren), Tailwind 4, Recharts, TypeScript, Vite. Kein Backend.
