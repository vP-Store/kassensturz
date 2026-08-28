import { isoDate, parseIso } from "@/lib/money";
import type { PeriodMode } from "@/lib/types";

export const MS_DAY = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Der Eingangstag, begrenzt auf die Länge des jeweiligen Monats (31. → 28./30.). */
function dayInMonth(year: number, monthIndex: number, day: number): Date {
  const clamped = Math.min(Math.max(Math.round(day) || 1, 1), 31);
  return new Date(year, monthIndex, Math.min(clamped, lastDayOfMonth(year, monthIndex)));
}

/** Beginn des Zyklus, in dem `from` liegt (der letzte Eingangstag). */
export function cycleStart(from: Date, incomeDay: number): Date {
  const d = startOfDay(from);
  const thisMonth = dayInMonth(d.getFullYear(), d.getMonth(), incomeDay);
  if (d.getTime() >= thisMonth.getTime()) return thisMonth;
  return dayInMonth(d.getFullYear(), d.getMonth() - 1, incomeDay);
}

/** Nächster Eingangstag ab `from` (heute zählt als heute). */
export function nextPayday(from: Date, incomeDay: number): Date {
  const d = startOfDay(from);
  const thisMonth = dayInMonth(d.getFullYear(), d.getMonth(), incomeDay);
  if (d.getTime() <= thisMonth.getTime()) return thisMonth;
  return dayInMonth(d.getFullYear(), d.getMonth() + 1, incomeDay);
}

/** Letzter Tag des laufenden Zyklus — der Tag vor dem nächsten Eingang. */
export function cycleEnd(from: Date, incomeDay: number): Date {
  const start = cycleStart(from, incomeDay);
  const next = dayInMonth(start.getFullYear(), start.getMonth() + 1, incomeDay);
  return new Date(next.getTime() - MS_DAY);
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(from).getTime()) / MS_DAY);
}

/* ---------------------------------------------------------------------------
 * Zeitraum ("Periode") — entweder Kalendermonat oder Gehaltszyklus.
 * Ein Schlüssel identifiziert einen Zeitraum: "2026-08" bzw. "c2026-08-23".
 * ------------------------------------------------------------------------- */

export type PeriodRange = { key: string; start: Date; end: Date };

export function periodKeyFor(mode: PeriodMode, date: Date, incomeDay: number): string {
  if (mode === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return `c${isoDate(cycleStart(date, incomeDay))}`;
}

export function periodRange(mode: PeriodMode, key: string, incomeDay: number): PeriodRange {
  if (mode === "month" || !key.startsWith("c")) {
    const [y, m] = key.replace(/^c/, "").split("-").map(Number);
    const year = y || new Date().getFullYear();
    const monthIndex = (m || 1) - 1;
    return {
      key,
      start: new Date(year, monthIndex, 1),
      end: new Date(year, monthIndex, lastDayOfMonth(year, monthIndex)),
    };
  }
  const start = parseIso(key.slice(1));
  const next = dayInMonth(start.getFullYear(), start.getMonth() + 1, incomeDay);
  return { key, start, end: new Date(next.getTime() - MS_DAY) };
}

export function shiftPeriod(mode: PeriodMode, key: string, delta: number, incomeDay: number): string {
  const { start } = periodRange(mode, key, incomeDay);
  if (mode === "month") {
    const d = new Date(start.getFullYear(), start.getMonth() + delta, 1);
    return periodKeyFor("month", d, incomeDay);
  }
  const moved = dayInMonth(start.getFullYear(), start.getMonth() + delta, incomeDay);
  return `c${isoDate(moved)}`;
}

export function periodLabel(mode: PeriodMode, key: string, incomeDay: number): string {
  const { start, end } = periodRange(mode, key, incomeDay);
  if (mode === "month") {
    return start.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  const e = end.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${s} – ${e}`;
}

export function isInPeriod(iso: string, range: PeriodRange): boolean {
  const t = parseIso(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/** Nächstes Fälligkeitsdatum einer Wiederholung. */
export function advanceDate(iso: string, interval: string): string {
  const d = parseIso(iso);
  const day = d.getDate();
  if (interval === "weekly") {
    d.setDate(d.getDate() + 7);
    return isoDate(d);
  }
  const step = interval === "yearly" ? 12 : interval === "quarterly" ? 3 : 1;
  const target = new Date(d.getFullYear(), d.getMonth() + step, 1);
  target.setDate(Math.min(day, lastDayOfMonth(target.getFullYear(), target.getMonth())));
  return isoDate(target);
}
