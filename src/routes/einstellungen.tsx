import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, ConfirmDialog, Field, Input, Section, Select, Switch } from "@/components/ui";
import { backupName, downloadFile, importCsv, toCsv } from "@/lib/csv";
import { exportJson, importJson, resetAll, setCategoryArchived, updateSettings, upsertCategory, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Bucket, PeriodMode, Realm, ThemeChoice } from "@/lib/types";

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Hell" },
  { id: "dark", label: "Dunkel" },
  { id: "system", label: "Automatisch" },
];

export function EinstellungenPage() {
  const db = useDb();
  const [theme, setTheme] = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const [catName, setCatName] = useState("");
  const [catKind, setCatKind] = useState<"expense" | "income">("expense");
  const [catRealm, setCatRealm] = useState<Realm>("privat");
  const [catBucket, setCatBucket] = useState<Bucket>("need");

  async function readFile(file: File): Promise<string> {
    return await file.text();
  }

  return (
    <AppShell title="Einstellungen">
      <Section title="Aussehen">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                updateSettings({ theme: t.id });
              }}
              className={cn(
                "h-11 rounded-md border text-sm transition-colors",
                theme === t.id
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Automatisch folgt der Einstellung deines Handys — tagsüber hell, nachts dunkel.
        </p>
      </Section>

      <Section className="mt-3" title="Haushalt und Zyklus">
        <Field label="Name" htmlFor="hh-name">
          <Input
            id="hh-name"
            defaultValue={db.settings.householdName}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== db.settings.householdName) {
                updateSettings({ householdName: v });
                toast.ok("Gespeichert");
              }
            }}
          />
        </Field>
        <Field
          className="mt-4"
          label="Tag des Geldeingangs"
          htmlFor="income-day"
          hint="Ab diesem Tag beginnt dein Monat — davon hängen „offene Fixkosten“ und das Tagesbudget ab."
        >
          <Input
            id="income-day"
            inputMode="numeric"
            defaultValue={db.settings.incomeDay}
            onBlur={(e) => {
              const v = Math.min(31, Math.max(1, Number(e.target.value) || 1));
              e.target.value = String(v);
              if (v !== db.settings.incomeDay) {
                updateSettings({ incomeDay: v });
                toast.ok("Gespeichert");
              }
            }}
          />
        </Field>
        <Field
          className="mt-4"
          label="Zeitraum für Budget und Berichte"
          htmlFor="period-mode"
          hint="Beides auf denselben Zeitraum zu stellen verhindert, dass eine Ausgabe je nach Seite in einem anderen Monat auftaucht."
        >
          <Select
            id="period-mode"
            value={db.settings.periodMode}
            onChange={(e) => updateSettings({ periodMode: e.target.value as PeriodMode })}
          >
            <option value="cycle">Gehaltszyklus ({db.settings.incomeDay}. bis {db.settings.incomeDay}.)</option>
            <option value="month">Kalendermonat</option>
          </Select>
        </Field>
      </Section>

      <Section className="mt-3" title="Sicherung">
        <p className="text-sm text-muted-foreground">
          Deine Daten liegen nur auf diesem Gerät. Lade dir ab und zu eine Sicherung herunter — damit
          holst du alles auf ein neues Handy.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              downloadFile(backupName("json"), exportJson(), "application/json");
              toast.ok("Sicherung geladen");
            }}
          >
            <Download className="size-4" /> Sicherung
          </Button>
          <Button variant="outline" onClick={() => jsonInput.current?.click()}>
            <Upload className="size-4" /> Einspielen
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              downloadFile(backupName("csv"), toCsv(db), "text/csv");
              toast.ok("CSV geladen");
            }}
          >
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => csvInput.current?.click()}>
            <Upload className="size-4" /> CSV lesen
          </Button>
        </div>
        <input
          ref={jsonInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              importJson(await readFile(file));
              toast.ok("Sicherung eingespielt");
            } catch {
              toast.error("Datei konnte nicht gelesen werden");
            }
          }}
        />
        <input
          ref={csvInput}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const res = importCsv(await readFile(file));
              toast.ok(`${res.imported} Buchungen gelesen${res.skipped ? `, ${res.skipped} übersprungen` : ""}`);
            } catch {
              toast.error("CSV konnte nicht gelesen werden");
            }
          }}
        />
      </Section>

      <Section className="mt-3" title="Kategorie anlegen">
        <div className="space-y-3">
          <Input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Name der Kategorie"
            aria-label="Name der Kategorie"
          />
          <div className="grid grid-cols-3 gap-2">
            <Select
              value={catKind}
              onChange={(e) => setCatKind(e.target.value as "expense" | "income")}
              aria-label="Art"
            >
              <option value="expense">Ausgabe</option>
              <option value="income">Einnahme</option>
            </Select>
            <Select value={catRealm} onChange={(e) => setCatRealm(e.target.value as Realm)} aria-label="Bereich">
              <option value="privat">Privat</option>
              <option value="gewerbe">Gewerbe</option>
            </Select>
            <Select value={catBucket} onChange={(e) => setCatBucket(e.target.value as Bucket)} aria-label="Topf">
              <option value="need">Brauchen</option>
              <option value="want">Wollen</option>
              <option value="save">Sparen</option>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!catName.trim()) return toast.error("Bitte einen Namen eingeben");
              upsertCategory({
                name: catName.trim(),
                kind: catKind,
                realm: catRealm,
                bucket: catBucket,
                archived: false,
              });
              setCatName("");
              toast.ok("Kategorie angelegt");
            }}
          >
            Anlegen
          </Button>
        </div>
      </Section>

      <Section className="mt-3" title={`Kategorien (${db.categories.filter((c) => !c.archived).length})`}>
        <ul className="divide-y divide-border">
          {db.categories.map((c) => (
            <li key={c.id} className="py-1">
              <Switch
                id={`cat-${c.id}`}
                label={`${c.name} · ${c.kind === "income" ? "Einnahme" : "Ausgabe"} · ${c.realm}`}
                checked={!c.archived}
                onChange={(v) => setCategoryArchived(c.id, !v)}
              />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Ausgeschaltete Kategorien verschwinden aus den Auswahllisten, alte Buchungen bleiben.
        </p>
      </Section>

      <Section className="mt-3" title="Neu anfangen">
        <p className="text-sm text-muted-foreground">
          Löscht alle Buchungen, Konten und Einstellungen auf diesem Gerät.
        </p>
        <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirmReset(true)}>
          Alles zurücksetzen
        </Button>
      </Section>

      <p className="mt-6 text-center text-xs text-muted-foreground">Kassensturz · Version 2.0</p>

      <ConfirmDialog
        open={confirmReset}
        title="Wirklich alles löschen?"
        body="Alle Daten auf diesem Gerät werden entfernt. Lade vorher eine Sicherung herunter, wenn du sie behalten willst."
        confirmLabel="Alles löschen"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          toast.ok("Zurückgesetzt");
        }}
      />
    </AppShell>
  );
}
