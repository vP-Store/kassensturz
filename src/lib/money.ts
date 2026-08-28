const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const plain = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatEuro(n: number): string {
  return Number.isFinite(n) ? euro.format(round2(n)) : "–";
}

export function formatPlain(n: number): string {
  return Number.isFinite(n) ? plain.format(round2(n)) : "";
}

/** Rundet auf Cent — verhindert 0.1 + 0.2 = 0.30000000000000004. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Akzeptiert "1.234,56", "1234.56", "12,5" und "12". */
export function parseEuro(raw: string): number {
  const t = String(raw).trim().replace(/\s/g, "").replace(/€/g, "");
  if (!t) return NaN;
  const hasComma = t.includes(",");
  const cleaned = hasComma ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : NaN;
}

export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export function formatDayMonthYear(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

export function formatShortDate(iso: string): string {
  return parseIso(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
