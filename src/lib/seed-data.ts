/**
 * Startdaten für ein frisch geöffnetes Gerät: ein paar sinnvolle Konten und
 * Kategorien, damit man sofort buchen kann — bewusst ohne persönliche Zahlen.
 *
 * Eigene Fixkosten und Salden kommen entweder direkt in der App dazu oder über
 * Einstellungen → Sicherung → Einspielen aus einer Datei. Wer die App auf ein
 * neues Gerät holt, geht denselben Weg.
 */
import { newId } from "@/lib/money";
import type { Account, Category, Recurring, Settings } from "@/lib/types";

export const SEED_SETTINGS: Settings = {
  householdName: "Unser Haushalt",
  incomeDay: 23,
  periodMode: "cycle",
  theme: "system",
  budgetMethod: "simple",
  needsPct: 50,
  wantsPct: 30,
  savePct: 20,
  bufferWarn: 0,
};

const now = () => new Date().toISOString();

export const SEED_ACCOUNTS: Account[] = [
  { id: newId(), name: "Giro Privat", kind: "giro", realm: "privat", openingBalance: 0, archived: false, createdAt: now() },
  { id: newId(), name: "Giro Gewerbe", kind: "gewerbe", realm: "gewerbe", openingBalance: 0, archived: false, createdAt: now() },
  { id: newId(), name: "Sparen", kind: "spar", realm: "privat", openingBalance: 0, archived: false, createdAt: now() },
  { id: newId(), name: "Bargeld", kind: "cash", realm: "privat", openingBalance: 0, archived: false, createdAt: now() },
];

const CATEGORIES: Omit<Category, "id" | "archived">[] = [
  { name: "Gehalt", kind: "income", realm: "privat", bucket: "need" },
  { name: "Kindergeld", kind: "income", realm: "privat", bucket: "need" },
  { name: "Sonstige Einnahme", kind: "income", realm: "privat", bucket: "need" },
  { name: "Miete", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Strom / Gas", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Internet / Handy", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Versicherungen", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Lebensmittel", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Mobilität", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Raten", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Behörden & Gebühren", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Bankgebühren", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Abos", kind: "expense", realm: "privat", bucket: "want" },
  { name: "Freizeit", kind: "expense", realm: "privat", bucket: "want" },
  { name: "Kleidung", kind: "expense", realm: "privat", bucket: "want" },
  { name: "Sparen", kind: "expense", realm: "privat", bucket: "save" },
  { name: "Umsatz", kind: "income", realm: "gewerbe", bucket: "need" },
  { name: "Software / Tools", kind: "expense", realm: "gewerbe", bucket: "need" },
  { name: "Wareneinsatz", kind: "expense", realm: "gewerbe", bucket: "need" },
  { name: "Gebühren", kind: "expense", realm: "gewerbe", bucket: "need" },
  { name: "Werbung", kind: "expense", realm: "gewerbe", bucket: "want" },
  { name: "Steuer-Rücklage", kind: "expense", realm: "gewerbe", bucket: "save" },
];

export const SEED_CATEGORIES: Category[] = CATEGORIES.map((c) => ({
  ...c,
  id: newId(),
  archived: false,
}));

/** Bewusst leer — Fixkosten sind persönlich und gehören nicht in den Quellcode. */
export const SEED_RECURRINGS: Recurring[] = [];
