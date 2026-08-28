import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { PeriodBar } from "@/components/period-bar";
import { Empty, Section } from "@/components/ui";
import { byCategory, periodTransactions, sumExpense, sumIncome } from "@/lib/compute";
import { periodKeyFor, periodRange, shiftPeriod } from "@/lib/cycle";
import { formatEuro } from "@/lib/money";
import { useDb } from "@/lib/store";
import type { Realm } from "@/lib/types";

function Breakdown({
  rows,
  total,
  tone,
}: {
  rows: { id: string; name: string; amount: number }[];
  total: number;
  tone: "expense" | "income";
}) {
  if (rows.length === 0) return <Empty>Keine Buchungen in diesem Zeitraum.</Empty>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="flex justify-between text-sm">
            <span className="truncate pr-3">{r.name}</span>
            <span className="shrink-0 tabular-nums">
              {formatEuro(r.amount)}
              <span className="ml-2 text-muted-foreground">
                {total > 0 ? Math.round((r.amount / total) * 100) : 0} %
              </span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={tone === "expense" ? "h-full bg-destructive" : "h-full bg-positive"}
              style={{ width: `${total > 0 ? (r.amount / total) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BerichtePage() {
  const db = useDb();
  const [period, setPeriod] = useState(() =>
    periodKeyFor(db.settings.periodMode, new Date(), db.settings.incomeDay),
  );
  const txs = periodTransactions(db, period);
  const expense = sumExpense(db, txs);
  const income = sumIncome(db, txs);

  // Verlauf der letzten sechs Zeiträume
  const history = Array.from({ length: 6 }, (_, i) => {
    const key = shiftPeriod(db.settings.periodMode, period, i - 5, db.settings.incomeDay);
    const list = periodTransactions(db, key);
    const { start } = periodRange(db.settings.periodMode, key, db.settings.incomeDay);
    return {
      key,
      // Kurzes Label — die volle Zeitraumangabe passt nicht unter die Achse.
      name: start.toLocaleDateString("de-DE", { month: "short" }),
      ein: sumIncome(db, list),
      aus: sumExpense(db, list),
    };
  });

  const realms: { id: Realm; label: string }[] = [
    { id: "privat", label: "Privat" },
    { id: "gewerbe", label: "Gewerbe" },
  ];

  return (
    <AppShell title="Berichte">
      <PeriodBar period={period} onChange={setPeriod} />

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Rein</p>
          <p className="tabular-nums text-positive">{formatEuro(income)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Raus</p>
          <p className="tabular-nums text-destructive">{formatEuro(expense)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Rest</p>
          <p className="tabular-nums">{formatEuro(income - expense)}</p>
        </div>
      </div>

      <Section className="mt-3" title="Verlauf">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={56} />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                formatter={(v: number) => formatEuro(v)}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  color: "var(--color-foreground)",
                }}
              />
              <Bar dataKey="ein" name="Einnahmen" radius={[4, 4, 0, 0]}>
                {history.map((h) => (
                  <Cell key={`i-${h.key}`} fill="var(--color-positive)" />
                ))}
              </Bar>
              <Bar dataKey="aus" name="Ausgaben" radius={[4, 4, 0, 0]}>
                {history.map((h) => (
                  <Cell key={`e-${h.key}`} fill="var(--color-destructive)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section className="mt-3" title="Ausgaben nach Kategorie">
        <Breakdown rows={byCategory(db, txs, "expense")} total={expense} tone="expense" />
      </Section>

      <Section className="mt-3" title="Einnahmen nach Quelle">
        <Breakdown rows={byCategory(db, txs, "income")} total={income} tone="income" />
      </Section>

      {realms.map((r) => {
        const ein = sumIncome(db, txs, r.id);
        const aus = sumExpense(db, txs, r.id);
        if (ein === 0 && aus === 0) return null;
        return (
          <Section
            key={r.id}
            className="mt-3"
            title={r.label}
            action={<span className="text-sm tabular-nums">{formatEuro(ein - aus)}</span>}
          >
            <p className="text-sm text-muted-foreground">
              {formatEuro(ein)} rein · {formatEuro(aus)} raus
            </p>
            <div className="mt-3">
              <Breakdown rows={byCategory(db, txs, "expense", r.id)} total={aus} tone="expense" />
            </div>
          </Section>
        );
      })}
    </AppShell>
  );
}
