export type Realm = "privat" | "gewerbe";
export type TxType = "income" | "expense" | "transfer";
export type RecurringInterval = "monthly" | "quarterly" | "yearly" | "weekly";
export type BudgetMethod = "simple" | "envelopes" | "fifty" | "zero";
export type Bucket = "need" | "want" | "save";
export type AccountKind = "giro" | "spar" | "cash" | "paypal" | "gewerbe" | "other";
export type ThemeChoice = "light" | "dark" | "system";
export type PeriodMode = "cycle" | "month";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  realm: Realm;
  openingBalance: number;
  archived: boolean;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  kind: "income" | "expense";
  realm: Realm;
  bucket: Bucket;
  archived: boolean;
};

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  bookedOn: string;
  note: string | null;
  /** Gesetzt, wenn die Buchung aus einer Fixkostenposition entstanden ist. */
  recurringId?: string | null;
  createdAt: string;
};

export type Recurring = {
  id: string;
  name: string;
  amount: number;
  type: "income" | "expense";
  interval: RecurringInterval;
  accountId: string;
  categoryId: string | null;
  nextDate: string;
  autoBook: boolean;
  active: boolean;
};

export type Budget = {
  categoryId: string;
  period: string;
  amount: number;
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string | null;
  realm: Realm;
  accountId: string | null;
};

export type Debt = {
  id: string;
  name: string;
  total: number;
  remaining: number;
  monthlyRate: number;
  dueDay: number | null;
  accountId: string | null;
};

export type Settings = {
  householdName: string;
  incomeDay: number;
  periodMode: PeriodMode;
  theme: ThemeChoice;
  budgetMethod: BudgetMethod;
  needsPct: number;
  wantsPct: number;
  savePct: number;
  /** Warnschwelle: darunter färbt sich das verfügbare Geld. */
  bufferWarn: number;
};

export type Database = {
  version: number;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurrings: Recurring[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
};

/** Konto mit errechnetem Saldo. */
export type AccountWithBalance = Account & { balance: number };
