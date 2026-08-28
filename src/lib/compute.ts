import { advanceDate, cycleEnd, isInPeriod, periodRange, startOfDay } from "@/lib/cycle";
import { isoDate, round2 } from "@/lib/money";
import type {
  Account,
  AccountWithBalance,
  Bucket,
  Category,
  Database,
  Realm,
  Transaction,
} from "@/lib/types";

/** Kontostände aus Startsaldo + allen Buchungen. */
export function accountsWithBalance(db: Database): AccountWithBalance[] {
  const balances = new Map<string, number>();
  for (const a of db.accounts) balances.set(a.id, a.openingBalance);
  for (const t of db.transactions) {
    if (t.type === "income") {
      balances.set(t.accountId, (balances.get(t.accountId) ?? 0) + t.amount);
    } else if (t.type === "expense") {
      balances.set(t.accountId, (balances.get(t.accountId) ?? 0) - t.amount);
    } else {
      balances.set(t.accountId, (balances.get(t.accountId) ?? 0) - t.amount);
      if (t.transferAccountId) {
        balances.set(t.transferAccountId, (balances.get(t.transferAccountId) ?? 0) + t.amount);
      }
    }
  }
  return db.accounts.map((a) => ({ ...a, balance: round2(balances.get(a.id) ?? 0) }));
}

export function realmBalance(accounts: AccountWithBalance[], realm: Realm): number {
  return round2(
    accounts.filter((a) => !a.archived && a.realm === realm).reduce((s, a) => s + a.balance, 0),
  );
}

export function totalBalance(accounts: AccountWithBalance[]): number {
  return round2(accounts.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0));
}

export function accountName(accounts: Account[], id: string | null): string {
  if (!id) return "–";
  return accounts.find((a) => a.id === id)?.name ?? "gelöscht";
}

export function categoryName(categories: Category[], id: string | null): string {
  if (!id) return "Ohne Kategorie";
  return categories.find((c) => c.id === id)?.name ?? "gelöscht";
}

/** Buchungen eines Zeitraums. */
export function periodTransactions(db: Database, periodKey: string): Transaction[] {
  const range = periodRange(db.settings.periodMode, periodKey, db.settings.incomeDay);
  return db.transactions
    .filter((t) => isInPeriod(t.bookedOn, range))
    .sort((a, b) => (a.bookedOn === b.bookedOn ? b.createdAt.localeCompare(a.createdAt) : b.bookedOn.localeCompare(a.bookedOn)));
}

/**
 * Der Bereich, dem eine Buchung zugeordnet wird: die Kategorie entscheidet,
 * das Konto ist nur Rückfallebene. In der ersten Version zählten die Berichte
 * nur das Konto — dadurch landete eine Gewerbe-Kategorie auf einem Privatkonto
 * in der falschen Auswertung.
 */
export function txRealm(db: Database, t: Transaction): Realm {
  const cat = t.categoryId ? db.categories.find((c) => c.id === t.categoryId) : undefined;
  if (cat) return cat.realm;
  return db.accounts.find((a) => a.id === t.accountId)?.realm ?? "privat";
}

export function sumIncome(db: Database, txs: Transaction[], realm?: Realm): number {
  return round2(
    txs
      .filter((t) => t.type === "income" && (!realm || txRealm(db, t) === realm))
      .reduce((s, t) => s + t.amount, 0),
  );
}

export function sumExpense(db: Database, txs: Transaction[], realm?: Realm): number {
  return round2(
    txs
      .filter((t) => t.type === "expense" && (!realm || txRealm(db, t) === realm))
      .reduce((s, t) => s + t.amount, 0),
  );
}

export function bucketSpend(db: Database, txs: Transaction[], bucket: Bucket): number {
  return round2(
    txs
      .filter((t) => {
        if (t.type !== "expense" || !t.categoryId) return false;
        return db.categories.find((c) => c.id === t.categoryId)?.bucket === bucket;
      })
      .reduce((s, t) => s + t.amount, 0),
  );
}

export function spendInCategory(txs: Transaction[], categoryId: string): number {
  return round2(
    txs.filter((t) => t.type === "expense" && t.categoryId === categoryId).reduce((s, t) => s + t.amount, 0),
  );
}

export function budgetTotal(db: Database, periodKey: string): number {
  return round2(db.budgets.filter((b) => b.period === periodKey).reduce((s, b) => s + b.amount, 0));
}

export function budgetFor(db: Database, categoryId: string, periodKey: string): number {
  return db.budgets.find((b) => b.categoryId === categoryId && b.period === periodKey)?.amount ?? 0;
}

export function byCategory(
  db: Database,
  txs: Transaction[],
  type: "income" | "expense",
  realm?: Realm,
): { id: string; name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    if (realm && txRealm(db, t) !== realm) continue;
    const key = t.categoryId ?? "none";
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([id, amount]) => ({
      id,
      name: id === "none" ? "Ohne Kategorie" : categoryName(db.categories, id),
      amount: round2(amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

/* ----------------------------------------------------------- Fixkosten */

export type OpenFixed = {
  /** Eindeutig pro Termin — eine wöchentliche Position hat mehrere. */
  key: string;
  id: string;
  name: string;
  amount: number;
  dueOn: string;
  daysLate: number;
  realm: Realm;
  interval: string;
  /** Der erste offene Termin dieser Position — nur er lässt sich abhaken. */
  isNext: boolean;
};

/**
 * Alle noch offenen Fixkosten-Termine bis zum nächsten Geldeingang, inklusive
 * überfälliger. Wöchentliche Positionen werden aufgefächert: in einem Zyklus
 * steht ein wöchentlicher Einkauf vier- bis fünfmal an, nicht einmal.
 */
export function openFixed(db: Database, from: Date = new Date()): OpenFixed[] {
  const horizon = isoDate(cycleEnd(from, db.settings.incomeDay));
  const today = startOfDay(from).getTime();
  const out: OpenFixed[] = [];

  for (const r of db.recurrings) {
    if (!r.active || r.type !== "expense") continue;
    const cat = r.categoryId ? db.categories.find((c) => c.id === r.categoryId) : undefined;
    const realm = cat?.realm ?? db.accounts.find((a) => a.id === r.accountId)?.realm ?? "privat";
    let due = r.nextDate;
    let n = 0;
    while (due <= horizon && n < 60) {
      const dueTime = new Date(
        Number(due.slice(0, 4)),
        Number(due.slice(5, 7)) - 1,
        Number(due.slice(8, 10)),
      ).getTime();
      out.push({
        key: `${r.id}-${due}-${n}`,
        id: r.id,
        name: r.name,
        amount: r.amount,
        dueOn: due,
        daysLate: Math.max(0, Math.round((today - dueTime) / 86_400_000)),
        realm,
        interval: r.interval,
        isNext: n === 0,
      });
      due = advanceDate(due, r.interval);
      n += 1;
    }
  }

  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function openFixedSum(db: Database, from: Date = new Date()): number {
  return round2(openFixed(db, from).reduce((s, r) => s + r.amount, 0));
}

/** Erwartete wiederkehrende Einnahmen bis zum nächsten Eingang. */
export function openIncomeSum(db: Database, from: Date = new Date()): number {
  const horizon = isoDate(cycleEnd(from, db.settings.incomeDay));
  return round2(
    db.recurrings
      .filter((r) => r.active && r.type === "income" && r.nextDate <= horizon)
      .reduce((s, r) => s + r.amount, 0),
  );
}

/** Monatliche Belastung aller aktiven Fixkosten, auf den Monat normiert. */
export function monthlyFixedLoad(db: Database): number {
  const factor: Record<string, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  return round2(
    db.recurrings
      .filter((r) => r.active && r.type === "expense")
      .reduce((s, r) => s + r.amount * (factor[r.interval] ?? 1), 0),
  );
}

export function methodLabel(method: string): string {
  if (method === "envelopes") return "Umschläge";
  if (method === "fifty") return "50 / 30 / 20";
  if (method === "zero") return "Zero-based";
  return "Kategorie-Limits";
}

export const INTERVAL_LABEL: Record<string, string> = {
  weekly: "wöchentlich",
  monthly: "monatlich",
  quarterly: "vierteljährlich",
  yearly: "jährlich",
};
