/**
 * Datenschicht — alles liegt lokal im Browser (localStorage), damit die App
 * ohne Server, ohne Login und ohne Internet funktioniert.
 *
 * Ein einziges JSON-Objekt hält den kompletten Stand. Das ist bei Haushalts-
 * mengen (einige tausend Buchungen) völlig ausreichend und macht Sicherung
 * und Umzug auf ein anderes Gerät zu einem einzigen Datei-Export.
 */
import { useSyncExternalStore } from "react";
import { advanceDate } from "@/lib/cycle";
import { isoDate, newId, round2 } from "@/lib/money";
import type {
  Account,
  Budget,
  Category,
  Database,
  Debt,
  Goal,
  Recurring,
  Settings,
  Transaction,
} from "@/lib/types";

export const STORAGE_KEY = "kassensturz.db.v2";
const THEME_KEY = "kassensturz.theme";

export const DEFAULT_SETTINGS: Settings = {
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

function seedAccounts(): Account[] {
  const now = new Date().toISOString();
  return [
    { id: newId(), name: "Giro Privat", kind: "giro", realm: "privat", openingBalance: 0, archived: false, createdAt: now },
    { id: newId(), name: "Giro Gewerbe", kind: "gewerbe", realm: "gewerbe", openingBalance: 0, archived: false, createdAt: now },
    { id: newId(), name: "Sparen", kind: "spar", realm: "privat", openingBalance: 0, archived: false, createdAt: now },
    { id: newId(), name: "Bargeld", kind: "cash", realm: "privat", openingBalance: 0, archived: false, createdAt: now },
  ];
}

const SEED_CATEGORIES: Omit<Category, "id" | "archived">[] = [
  { name: "Gehalt", kind: "income", realm: "privat", bucket: "need" },
  { name: "Kindergeld", kind: "income", realm: "privat", bucket: "need" },
  { name: "Sonstige Einnahme", kind: "income", realm: "privat", bucket: "need" },
  { name: "Miete", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Strom / Gas", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Internet / Handy", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Versicherungen", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Lebensmittel", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Mobilität", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Gesundheit", kind: "expense", realm: "privat", bucket: "need" },
  { name: "Abos", kind: "expense", realm: "privat", bucket: "want" },
  { name: "Freizeit", kind: "expense", realm: "privat", bucket: "want" },
  { name: "Kleidung", kind: "expense", realm: "privat", bucket: "want" },
  { name: "Sparen", kind: "expense", realm: "privat", bucket: "save" },
  { name: "Umsatz", kind: "income", realm: "gewerbe", bucket: "need" },
  { name: "Wareneinsatz", kind: "expense", realm: "gewerbe", bucket: "need" },
  { name: "Software / Tools", kind: "expense", realm: "gewerbe", bucket: "need" },
  { name: "Gebühren", kind: "expense", realm: "gewerbe", bucket: "need" },
  { name: "Werbung", kind: "expense", realm: "gewerbe", bucket: "want" },
  { name: "Steuer-Rücklage", kind: "expense", realm: "gewerbe", bucket: "save" },
];

function seedCategories(): Category[] {
  return SEED_CATEGORIES.map((c) => ({ ...c, id: newId(), archived: false }));
}

export function emptyDb(): Database {
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    accounts: seedAccounts(),
    categories: seedCategories(),
    transactions: [],
    recurrings: [],
    budgets: [],
    goals: [],
    debts: [],
  };
}

/* ------------------------------------------------------------------ Speicher */

let cache: Database | null = null;
const listeners = new Set<() => void>();

function safeParse(raw: string | null): Database | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Database>;
    if (!parsed || typeof parsed !== "object") return null;
    const base = emptyDb();
    return {
      version: 2,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : base.accounts,
      categories: Array.isArray(parsed.categories) ? parsed.categories : base.categories,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      recurrings: Array.isArray(parsed.recurrings) ? parsed.recurrings : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
    };
  } catch {
    return null;
  }
}

export function getDb(): Database {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = emptyDb());
  const loaded = safeParse(window.localStorage.getItem(STORAGE_KEY));
  cache = loaded ?? emptyDb();
  if (!loaded) persist(cache);
  return cache;
}

function persist(db: Database): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error("[kassensturz] Speichern fehlgeschlagen", err);
    throw new Error("Speicher voll — bitte alte Buchungen exportieren und löschen.");
  }
}

/** Einzige Schreibstelle: verändert, speichert und benachrichtigt die Oberfläche. */
export function update(mutator: (db: Database) => void): void {
  const next: Database = structuredClone(getDb());
  mutator(next);
  cache = next;
  persist(next);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDb(): Database {
  return useSyncExternalStore(subscribe, getDb, getDb);
}

/* --------------------------------------------------------------- Fixkosten */

/**
 * Behebt den Fehler der ersten Version: fällige Wiederholungen wurden nie
 * weitergeschoben und zählten dadurch monatelang erneut als „offen".
 * Alles mit „automatisch buchen" wird hier nachgeholt.
 */
export function runAutoBook(today: Date = new Date()): number {
  const todayIso = isoDate(today);
  let booked = 0;
  update((db) => {
    for (const r of db.recurrings) {
      if (!r.active || !r.autoBook) continue;
      let guard = 0;
      while (r.nextDate <= todayIso && guard < 240) {
        db.transactions.push({
          id: newId(),
          type: r.type,
          amount: round2(r.amount),
          accountId: r.accountId,
          transferAccountId: null,
          categoryId: r.categoryId,
          bookedOn: r.nextDate,
          note: r.name,
          recurringId: r.id,
          createdAt: new Date().toISOString(),
        });
        r.nextDate = advanceDate(r.nextDate, r.interval);
        booked += 1;
        guard += 1;
      }
    }
  });
  return booked;
}

/** Eine Fixkostenposition jetzt buchen und auf den nächsten Termin schieben. */
export function bookRecurring(id: string, onDate?: string): void {
  update((db) => {
    const r = db.recurrings.find((x) => x.id === id);
    if (!r) return;
    const date = onDate ?? r.nextDate;
    db.transactions.push({
      id: newId(),
      type: r.type,
      amount: round2(r.amount),
      accountId: r.accountId,
      transferAccountId: null,
      categoryId: r.categoryId,
      bookedOn: date,
      note: r.name,
      recurringId: r.id,
      createdAt: new Date().toISOString(),
    });
    r.nextDate = advanceDate(r.nextDate, r.interval);
  });
}

/** Position ohne Buchung überspringen (z. B. einmalig ausgesetzt). */
export function skipRecurring(id: string): void {
  update((db) => {
    const r = db.recurrings.find((x) => x.id === id);
    if (r) r.nextDate = advanceDate(r.nextDate, r.interval);
  });
}

export function upsertRecurring(input: Omit<Recurring, "id"> & { id?: string }): void {
  update((db) => {
    if (input.id) {
      const i = db.recurrings.findIndex((r) => r.id === input.id);
      if (i >= 0) db.recurrings[i] = { ...db.recurrings[i], ...input, id: input.id };
      return;
    }
    db.recurrings.push({ ...input, id: newId(), amount: round2(input.amount) });
  });
}

export function deleteRecurring(id: string): void {
  update((db) => {
    db.recurrings = db.recurrings.filter((r) => r.id !== id);
  });
}

/* ------------------------------------------------------------- Buchungen */

export type TransactionInput = Omit<Transaction, "id" | "createdAt"> & { id?: string };

export function saveTransaction(input: TransactionInput): void {
  update((db) => {
    const clean = { ...input, amount: round2(input.amount) };
    if (input.id) {
      const i = db.transactions.findIndex((t) => t.id === input.id);
      if (i >= 0) db.transactions[i] = { ...db.transactions[i], ...clean, id: input.id };
      return;
    }
    db.transactions.push({
      ...clean,
      id: newId(),
      recurringId: input.recurringId ?? null,
      createdAt: new Date().toISOString(),
    });
  });
}

export function deleteTransaction(id: string): void {
  update((db) => {
    db.transactions = db.transactions.filter((t) => t.id !== id);
  });
}

/* --------------------------------------------------------------- Konten */

export function upsertAccount(input: Omit<Account, "id" | "createdAt"> & { id?: string }): void {
  update((db) => {
    if (input.id) {
      const i = db.accounts.findIndex((a) => a.id === input.id);
      if (i >= 0) db.accounts[i] = { ...db.accounts[i], ...input, id: input.id };
      return;
    }
    db.accounts.push({ ...input, id: newId(), createdAt: new Date().toISOString() });
  });
}

export function setAccountArchived(id: string, archived: boolean): void {
  update((db) => {
    const a = db.accounts.find((x) => x.id === id);
    if (a) a.archived = archived;
  });
}

/* ------------------------------------------------------------ Kategorien */

export function upsertCategory(input: Omit<Category, "id"> & { id?: string }): void {
  update((db) => {
    if (input.id) {
      const i = db.categories.findIndex((c) => c.id === input.id);
      if (i >= 0) db.categories[i] = { ...db.categories[i], ...input, id: input.id };
      return;
    }
    db.categories.push({ ...input, id: newId() });
  });
}

export function setCategoryArchived(id: string, archived: boolean): void {
  update((db) => {
    const c = db.categories.find((x) => x.id === id);
    if (c) c.archived = archived;
  });
}

/* --------------------------------------------------------------- Budgets */

export function setBudget(categoryId: string, period: string, amount: number): void {
  update((db) => {
    const found = db.budgets.find((b) => b.categoryId === categoryId && b.period === period);
    if (found) found.amount = round2(amount);
    else db.budgets.push({ categoryId, period, amount: round2(amount) } satisfies Budget);
  });
}

/* -------------------------------------------------------- Ziele & Schulden */

export function upsertGoal(input: Omit<Goal, "id"> & { id?: string }): void {
  update((db) => {
    if (input.id) {
      const i = db.goals.findIndex((g) => g.id === input.id);
      if (i >= 0) db.goals[i] = { ...db.goals[i], ...input, id: input.id };
      return;
    }
    db.goals.push({ ...input, id: newId() });
  });
}

export function deleteGoal(id: string): void {
  update((db) => {
    db.goals = db.goals.filter((g) => g.id !== id);
  });
}

/**
 * Einzahlung auf ein Sparziel: erhöht den Stand UND bucht — anders als in der
 * ersten Version, wo der Stand von Hand nachgezogen werden musste.
 */
export function depositToGoal(goalId: string, amount: number, fromAccountId: string | null): void {
  update((db) => {
    const g = db.goals.find((x) => x.id === goalId);
    if (!g) return;
    g.current = round2(g.current + amount);
    if (fromAccountId) {
      db.transactions.push({
        id: newId(),
        type: g.accountId ? "transfer" : "expense",
        amount: round2(amount),
        accountId: fromAccountId,
        transferAccountId: g.accountId ?? null,
        categoryId: g.accountId ? null : (db.categories.find((c) => c.name === "Sparen")?.id ?? null),
        bookedOn: isoDate(),
        note: `Sparziel: ${g.name}`,
        recurringId: null,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

export function upsertDebt(input: Omit<Debt, "id"> & { id?: string }): void {
  update((db) => {
    if (input.id) {
      const i = db.debts.findIndex((d) => d.id === input.id);
      if (i >= 0) db.debts[i] = { ...db.debts[i], ...input, id: input.id };
      return;
    }
    db.debts.push({ ...input, id: newId() });
  });
}

export function deleteDebt(id: string): void {
  update((db) => {
    db.debts = db.debts.filter((d) => d.id !== id);
  });
}

/** Rate zahlen: bucht die Ausgabe und senkt die Restschuld in einem Schritt. */
export function payDebtRate(debtId: string, amount: number, fromAccountId: string | null): void {
  update((db) => {
    const d = db.debts.find((x) => x.id === debtId);
    if (!d) return;
    d.remaining = round2(Math.max(0, d.remaining - amount));
    if (fromAccountId) {
      db.transactions.push({
        id: newId(),
        type: "expense",
        amount: round2(amount),
        accountId: fromAccountId,
        transferAccountId: null,
        categoryId: null,
        bookedOn: isoDate(),
        note: `Rate: ${d.name}`,
        recurringId: null,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

/* ------------------------------------------------------------ Einstellungen */

export function updateSettings(patch: Partial<Settings>): void {
  update((db) => {
    db.settings = { ...db.settings, ...patch };
  });
}

export function readThemeChoice(): Settings["theme"] {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

/** Theme liegt zusätzlich einzeln im Speicher, damit index.html es früh liest. */
export function writeThemeChoice(theme: Settings["theme"]): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignorieren */
  }
}

/* ------------------------------------------------------- Sicherung / Umzug */

export function exportJson(): string {
  return JSON.stringify(getDb(), null, 2);
}

export function importJson(raw: string): void {
  const parsed = safeParse(raw);
  if (!parsed) throw new Error("Datei nicht lesbar");
  cache = parsed;
  persist(parsed);
  for (const l of listeners) l();
}

export function resetAll(): void {
  cache = emptyDb();
  persist(cache);
  for (const l of listeners) l();
}
