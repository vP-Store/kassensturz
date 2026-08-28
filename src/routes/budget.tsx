import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PeriodBar } from "@/components/period-bar";
import { Button, Empty, Input, Section, Select } from "@/components/ui";
import {
  bucketSpend,
  budgetFor,
  budgetTotal,
  methodLabel,
  periodTransactions,
  spendInCategory,
  sumIncome,
} from "@/lib/compute";
import { periodKeyFor, shiftPeriod } from "@/lib/cycle";
import { formatEuro, formatPlain, parseEuro } from "@/lib/money";
import { setBudget, updateSettings, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { BudgetMethod, Bucket } from "@/lib/types";

const METHODS: BudgetMethod[] = ["simple", "envelopes", "fifty", "zero"];
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "need", label: "Brauchen" },
  { id: "want", label: "Wollen" },
  { id: "save", label: "Sparen" },
];

export function BudgetPage() {
  const db = useDb();
  const [period, setPeriod] = useState(() =>
    periodKeyFor(db.settings.periodMode, new Date(), db.settings.incomeDay),
  );
  const txs = periodTransactions(db, period);
  const income = sumIncome(db, txs);
  const planned = budgetTotal(db, period);
  const categories = db.categories.filter((c) => !c.archived && c.kind === "expense");
  const { budgetMethod, needsPct, wantsPct, savePct } = db.settings;

  const pctFor: Record<Bucket, number> = { need: needsPct, want: wantsPct, save: savePct };

  return (
    <AppShell title="Budget">
      <PeriodBar period={period} onChange={setPeriod} />

      <Section title="Methode">
        <Select
          value={budgetMethod}
          onChange={(e) => updateSettings({ budgetMethod: e.target.value as BudgetMethod })}
          aria-label="Budgetmethode"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {methodLabel(m)}
            </option>
          ))}
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">
          {budgetMethod === "fifty"
            ? "50 % für das Nötige, 30 % für Wünsche, 20 % sparen — gemessen an den Einnahmen des Zeitraums."
            : budgetMethod === "zero"
              ? "Jeder Euro bekommt eine Aufgabe: Budgets sollen die Einnahmen genau aufbrauchen."
              : budgetMethod === "envelopes"
                ? "Feste Umschläge pro Kategorie, Reste wandern in den nächsten Zeitraum."
                : "Einfache Obergrenzen pro Kategorie."}
        </p>
      </Section>

      {budgetMethod === "fifty" ? (
        <Section className="mt-3" title="Anteile">
          <div className="grid grid-cols-3 gap-2">
            {BUCKETS.map((b) => (
              <div key={b.id}>
                <label className="text-xs text-muted-foreground" htmlFor={`pct-${b.id}`}>
                  {b.label} %
                </label>
                <Input
                  id={`pct-${b.id}`}
                  inputMode="numeric"
                  defaultValue={pctFor[b.id]}
                  onBlur={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    updateSettings(
                      b.id === "need"
                        ? { needsPct: v }
                        : b.id === "want"
                          ? { wantsPct: v }
                          : { savePct: v },
                    );
                  }}
                />
              </div>
            ))}
          </div>
          {needsPct + wantsPct + savePct !== 100 ? (
            <p className="mt-2 text-xs text-caution">
              Die Anteile ergeben {needsPct + wantsPct + savePct} % statt 100 %.
            </p>
          ) : null}
          <ul className="mt-4 space-y-3">
            {BUCKETS.map((b) => {
              const soll = (income * pctFor[b.id]) / 100;
              const ist = bucketSpend(db, txs, b.id);
              return (
                <li key={b.id}>
                  <div className="flex justify-between text-sm">
                    <span>{b.label}</span>
                    <span className="tabular-nums">
                      {formatEuro(ist)} von {formatEuro(soll)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full", ist > soll && soll > 0 ? "bg-destructive" : "bg-positive")}
                      style={{ width: `${soll > 0 ? Math.min(100, (ist / soll) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section
        className="mt-3"
        title="Kategorie-Budgets"
        action={<span className="text-sm tabular-nums text-muted-foreground">{formatEuro(planned)}</span>}
      >
        {budgetMethod === "zero" ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Noch nicht verplant:{" "}
            <span className={cn("tabular-nums", income - planned < 0 && "text-destructive")}>
              {formatEuro(income - planned)}
            </span>
          </p>
        ) : null}
        {categories.length === 0 ? (
          <Empty>Noch keine Ausgabe-Kategorien angelegt.</Empty>
        ) : (
          <ul className="space-y-3">
            {categories.map((c) => {
              const limit = budgetFor(db, c.id, period);
              const spent = spendInCategory(txs, c.id);
              const over = limit > 0 && spent > limit;
              return (
                <li key={c.id}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {c.name}
                        <span className="ml-2 text-xs text-muted-foreground">{c.realm}</span>
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatEuro(spent)} ausgegeben
                        {limit > 0 ? ` · ${formatEuro(Math.max(0, limit - spent))} übrig` : ""}
                      </p>
                    </div>
                    <Input
                      className="h-9 w-28 text-right"
                      inputMode="decimal"
                      aria-label={`Budget für ${c.name}`}
                      defaultValue={limit ? formatPlain(limit) : ""}
                      placeholder="0,00"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const v = raw === "" ? 0 : parseEuro(raw);
                        if (!Number.isFinite(v) || v < 0) {
                          toast.error("Betrag prüfen");
                          e.target.value = limit ? formatPlain(limit) : "";
                          return;
                        }
                        if (v !== limit) setBudget(c.id, period, v);
                      }}
                    />
                  </div>
                  {limit > 0 ? (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full", over ? "bg-destructive" : "bg-positive")}
                        style={{ width: `${Math.min(100, (spent / limit) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => {
            const prev = shiftPeriod(db.settings.periodMode, period, -1, db.settings.incomeDay);
            let copied = 0;
            for (const c of categories) {
              const limit = budgetFor(db, c.id, prev);
              if (limit > 0 && budgetFor(db, c.id, period) === 0) {
                setBudget(c.id, period, limit);
                copied += 1;
              }
            }
            toast.ok(
              copied > 0
                ? `${copied} Budgets aus dem letzten Zeitraum übernommen`
                : "Nichts zu übernehmen",
            );
          }}
        >
          Budgets vom letzten Zeitraum übernehmen
        </Button>
      </Section>
    </AppShell>
  );
}
