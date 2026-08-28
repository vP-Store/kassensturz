import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Check, SkipForward } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PeriodBar } from "@/components/period-bar";
import { Button, Card, Empty, Section } from "@/components/ui";
import {
  accountName,
  accountsWithBalance,
  budgetTotal,
  categoryName,
  methodLabel,
  openFixed,
  openFixedSum,
  openIncomeSum,
  periodTransactions,
  realmBalance,
  sumExpense,
  sumIncome,
  totalBalance,
} from "@/lib/compute";
import { cycleEnd, cycleStart, daysUntil, nextPayday, periodKeyFor } from "@/lib/cycle";
import { formatDayMonth, formatDayMonthYear, formatEuro, formatShortDate, round2 } from "@/lib/money";
import { bookRecurring, skipRecurring, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function HomePage() {
  const db = useDb();
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState(() =>
    periodKeyFor(db.settings.periodMode, now, db.settings.incomeDay),
  );

  const accounts = accountsWithBalance(db);
  const txs = periodTransactions(db, period);
  const available = totalBalance(accounts);
  const privat = realmBalance(accounts, "privat");
  const gewerbe = realmBalance(accounts, "gewerbe");
  const fixed = openFixed(db, now);
  const fixedSum = openFixedSum(db, now);
  // Erwartete Einnahmen bis zum nächsten Eingang gehören in die Rechnung,
  // sonst sieht der Zyklus schlechter aus, als er ist.
  const comingIn = openIncomeSum(db, now);
  const afterFixed = round2(available - fixedSum + comingIn);
  const payday = nextPayday(now, db.settings.incomeDay);
  const daysLeft = Math.max(1, daysUntil(payday, now));
  const perDay = afterFixed / daysLeft;
  const income = sumIncome(db, txs);
  const expense = sumExpense(db, txs);
  const planned = budgetTotal(db, period);
  const late = fixed.filter((f) => f.daysLate > 0);

  const chart = [
    { name: "Privat", ein: sumIncome(db, txs, "privat"), aus: sumExpense(db, txs, "privat") },
    { name: "Gewerbe", ein: sumIncome(db, txs, "gewerbe"), aus: sumExpense(db, txs, "gewerbe") },
  ];

  return (
    <AppShell title="Übersicht">
      <PeriodBar period={period} onChange={setPeriod} />

      {db.recurrings.length === 0 && db.transactions.length === 0 ? (
        <Card className="mb-3">
          <p className="text-sm font-medium">Noch nichts eingerichtet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Trage unter <Link to="/konten" className="underline underline-offset-4">Konten</Link> deinen
            aktuellen Kontostand ein und lege unter{" "}
            <Link to="/fixkosten" className="underline underline-offset-4">Fixkosten</Link> an, was jeden
            Monat abgeht. Hast du schon eine Sicherungsdatei, spiel sie unter{" "}
            <Link to="/einstellungen" className="underline underline-offset-4">Einstellungen</Link> ein.
          </p>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <Card>
          <p className="mb-2 min-h-8 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Verfügbares Geld
          </p>
          <p className="font-display text-2xl font-medium tracking-tight tabular-nums">
            {formatEuro(available)}
          </p>
        </Card>
        <Card>
          <p className="mb-2 min-h-8 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Rest bis zum Eingang
          </p>
          <p
            className={cn(
              "font-display text-2xl font-medium tracking-tight tabular-nums",
              afterFixed < db.settings.bufferWarn ? "text-destructive" : "text-positive",
            )}
          >
            {formatEuro(afterFixed)}
          </p>
        </Card>
      </section>

      <div className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <div className="flex justify-between py-0.5">
          <span className="text-muted-foreground">Auf den Konten</span>
          <span className="tabular-nums">{formatEuro(available)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted-foreground">Noch erwartete Einnahmen</span>
          <span className="tabular-nums text-positive">+ {formatEuro(comingIn)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted-foreground">Offene Fixkosten</span>
          <span className="tabular-nums text-destructive">− {formatEuro(fixedSum)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-1.5 font-medium">
          <span>Rest am {formatDayMonth(cycleEnd(now, db.settings.incomeDay))}</span>
          <span className={cn("tabular-nums", afterFixed < 0 && "text-destructive")}>
            {formatEuro(afterFixed)}
          </span>
        </div>
      </div>

      {/* Die Zahl, die man morgens wirklich braucht */}
      <Card className="mt-3 text-center">
        <p className="text-xs tracking-wider text-muted-foreground uppercase">
          Noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"} bis zum Eingang
        </p>
        <p
          className={cn(
            "font-display mt-1 text-3xl tabular-nums",
            perDay < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {formatEuro(perDay)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">pro Tag zum Ausgeben</p>
      </Card>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Zyklus {formatDayMonth(cycleStart(now, db.settings.incomeDay))} –{" "}
        {formatDayMonth(cycleEnd(now, db.settings.incomeDay))} · nächster Eingang{" "}
        {daysUntil(payday, now) === 0 ? "heute" : formatDayMonthYear(payday)}
      </p>

      {afterFixed < 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            In diesem Zyklus fehlen {formatEuro(Math.abs(afterFixed))}. Schau in den Fixkosten, was
            sich verschieben oder kürzen lässt.
          </span>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Card className="p-3">
          <p className="text-muted-foreground">Privat</p>
          <p className="tabular-nums">{formatEuro(privat)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-muted-foreground">Gewerbe</p>
          <p className="tabular-nums">{formatEuro(gewerbe)}</p>
        </Card>
      </div>

      {/* Fixkosten direkt hier abhaken — sonst zählen sie ewig als offen */}
      <Section
        className="mt-3"
        title={`Offene Fixkosten (${fixed.length})`}
        action={<span className="text-sm font-medium tabular-nums">{formatEuro(fixedSum)}</span>}
      >
        {fixed.length === 0 ? (
          <Empty>Bis zum nächsten Eingang ist alles bezahlt.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {fixed.slice(0, 6).map((f) => (
              <li key={f.key} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(f.dueOn)} · {f.realm}
                    {f.daysLate > 0 ? (
                      <span className="text-destructive"> · {f.daysLate} Tage überfällig</span>
                    ) : null}
                    {!f.isNext ? " · später im Zyklus" : ""}
                  </p>
                </div>
                <span className="text-sm tabular-nums">{formatEuro(f.amount)}</span>
                {f.isNext ? (
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`${f.name} als bezahlt buchen`}
                      title="Als bezahlt buchen"
                      onClick={() => {
                        bookRecurring(f.id);
                        toast.ok(`${f.name} gebucht`);
                      }}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${f.name} überspringen`}
                      title="Diesen Termin überspringen"
                      onClick={() => {
                        skipRecurring(f.id);
                        toast.ok(`${f.name} übersprungen`);
                      }}
                    >
                      <SkipForward className="size-4" />
                    </Button>
                  </>
                ) : (
                  <span className="w-[4.5rem] shrink-0" />
                )}
              </li>
            ))}
          </ul>
        )}
        {fixed.length > 6 ? (
          <Link
            to="/fixkosten"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            {fixed.length - 6} weitere Termine ansehen
          </Link>
        ) : null}
        {late.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {late.length} {late.length === 1 ? "Position ist" : "Positionen sind"} überfällig. Haken
            setzen bucht sie und schiebt sie auf den nächsten Termin.
          </p>
        ) : null}
      </Section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted-foreground">Einnahmen</p>
          <p className="mt-1 text-lg tabular-nums text-positive">{formatEuro(income)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Ausgaben</p>
          <p className="mt-1 text-lg tabular-nums text-destructive">{formatEuro(expense)}</p>
        </Card>
      </div>

      <Section className="mt-3" title="Budget in diesem Zeitraum">
        <p className="text-sm text-muted-foreground">
          Methode: {methodLabel(db.settings.budgetMethod)} · Rest{" "}
          <span className="tabular-nums">{formatEuro(income - expense)}</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", expense > planned && planned > 0 ? "bg-destructive" : "bg-positive")}
            style={{ width: `${planned > 0 ? Math.min(100, (expense / planned) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatEuro(expense)} von {planned > 0 ? formatEuro(planned) : "noch keinem Budget"} ausgegeben
        </p>
        <Link to="/budget" className="mt-3 inline-block text-sm underline underline-offset-4">
          Budget einstellen
        </Link>
      </Section>

      <Section className="mt-3" title="Einnahmen und Ausgaben">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
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
              <Bar dataKey="ein" name="Einnahmen" radius={[6, 6, 0, 0]}>
                {chart.map((c) => (
                  <Cell key={`e-${c.name}`} fill="var(--color-positive)" />
                ))}
              </Bar>
              <Bar dataKey="aus" name="Ausgaben" radius={[6, 6, 0, 0]}>
                {chart.map((c) => (
                  <Cell key={`a-${c.name}`} fill="var(--color-destructive)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section
        className="mt-3"
        title="Gewerbe-Überschuss"
        action={
          <span className="text-sm tabular-nums">
            {formatEuro(sumIncome(db, txs, "gewerbe") - sumExpense(db, txs, "gewerbe"))}
          </span>
        }
      >
        <p className="text-sm text-muted-foreground">
          {formatEuro(sumIncome(db, txs, "gewerbe"))} rein, {formatEuro(sumExpense(db, txs, "gewerbe"))} raus.
          Keine Steuererklärung — nur der Kassenstand.
        </p>
      </Section>

      <Section
        className="mt-3"
        title="Letzte Buchungen"
        action={
          <Link to="/buchungen" className="text-sm text-muted-foreground underline underline-offset-4">
            alle
          </Link>
        }
      >
        {txs.length === 0 ? (
          <Empty>In diesem Zeitraum noch nichts gebucht.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {txs.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {t.note || categoryName(db.categories, t.categoryId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(t.bookedOn)} · {accountName(db.accounts, t.accountId)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm tabular-nums",
                    t.type === "income" ? "text-positive" : t.type === "expense" ? "text-destructive" : "",
                  )}
                >
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : "→"} {formatEuro(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
