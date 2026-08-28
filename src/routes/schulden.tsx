import { useState } from "react";
import { Banknote, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, ConfirmDialog, Empty, Field, Input, Modal, Section, Select } from "@/components/ui";
import { formatEuro, formatPlain, parseEuro } from "@/lib/money";
import { deleteDebt, payDebtRate, upsertDebt, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Debt } from "@/lib/types";

type Draft = {
  id?: string;
  name: string;
  total: string;
  remaining: string;
  rate: string;
  dueDay: string;
  accountId: string;
};

export function SchuldenPage() {
  const db = useDb();
  const accounts = db.accounts.filter((a) => !a.archived);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pay, setPay] = useState<{ debt: Debt; amount: string; from: string } | null>(null);
  const [toDelete, setToDelete] = useState<Debt | null>(null);

  const totalRemaining = db.debts.reduce((s, d) => s + d.remaining, 0);
  const monthlyRates = db.debts.reduce((s, d) => s + d.monthlyRate, 0);

  function save() {
    if (!draft) return;
    const total = parseEuro(draft.total);
    const remaining = draft.remaining.trim() === "" ? total : parseEuro(draft.remaining);
    const rate = draft.rate.trim() === "" ? 0 : parseEuro(draft.rate);
    if (!draft.name.trim()) return toast.error("Bitte einen Namen eingeben");
    if (!Number.isFinite(total) || total <= 0) return toast.error("Gesamtbetrag prüfen");
    if (!Number.isFinite(remaining) || remaining < 0) return toast.error("Restbetrag prüfen");
    if (!Number.isFinite(rate) || rate < 0) return toast.error("Rate prüfen");
    const day = Number(draft.dueDay);
    upsertDebt({
      id: draft.id,
      name: draft.name.trim(),
      total,
      remaining,
      monthlyRate: rate,
      dueDay: day >= 1 && day <= 31 ? day : null,
      accountId: draft.accountId || null,
    });
    toast.ok(draft.id ? "Geändert" : "Angelegt");
    setDraft(null);
  }

  return (
    <AppShell
      title="Schulden"
      action={
        <Button
          size="sm"
          onClick={() =>
            setDraft({ name: "", total: "", remaining: "", rate: "", dueDay: "", accountId: accounts[0]?.id ?? "" })
          }
        >
          Neu
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Restschuld</p>
          <p className="tabular-nums">{formatEuro(totalRemaining)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Raten im Monat</p>
          <p className="tabular-nums">{formatEuro(monthlyRates)}</p>
        </div>
      </div>

      {db.debts.length === 0 ? (
        <Section className="mt-3">
          <Empty>Keine Schulden eingetragen. Auch gut.</Empty>
        </Section>
      ) : (
        <ul className="mt-3 space-y-3">
          {db.debts.map((d) => {
            const paid = Math.max(0, d.total - d.remaining);
            const pct = d.total > 0 ? Math.min(100, (paid / d.total) * 100) : 0;
            const monthsLeft = d.monthlyRate > 0 ? Math.ceil(d.remaining / d.monthlyRate) : null;
            return (
              <li key={d.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Rate {formatEuro(d.monthlyRate)}
                      {d.dueDay ? ` am ${d.dueDay}.` : ""}
                      {monthsLeft !== null ? ` · noch ${monthsLeft} Raten` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Rate für ${d.name} buchen`}
                      title="Rate zahlen"
                      onClick={() =>
                        setPay({
                          debt: d,
                          amount: d.monthlyRate ? formatPlain(d.monthlyRate) : "",
                          from: d.accountId ?? accounts[0]?.id ?? "",
                        })
                      }
                    >
                      <Banknote className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${d.name} löschen`}
                      onClick={() => setToDelete(d)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-positive" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm tabular-nums">
                  noch {formatEuro(d.remaining)}
                  <span className="text-muted-foreground"> von {formatEuro(d.total)}</span>
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() =>
                    setDraft({
                      id: d.id,
                      name: d.name,
                      total: formatPlain(d.total),
                      remaining: formatPlain(d.remaining),
                      rate: formatPlain(d.monthlyRate),
                      dueDay: d.dueDay ? String(d.dueDay) : "",
                      accountId: d.accountId ?? "",
                    })
                  }
                >
                  bearbeiten
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Schuld bearbeiten" : "Neue Schuld"}>
        {draft ? (
          <div className="space-y-4">
            <Field label="Name" htmlFor="s-name">
              <Input
                id="s-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="z. B. Autokredit"
              />
            </Field>
            <Field label="Gesamtbetrag" htmlFor="s-total">
              <Input
                id="s-total"
                inputMode="decimal"
                value={draft.total}
                onChange={(e) => setDraft({ ...draft, total: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Noch offen" htmlFor="s-rest" hint="Leer lassen = Gesamtbetrag.">
              <Input
                id="s-rest"
                inputMode="decimal"
                value={draft.remaining}
                onChange={(e) => setDraft({ ...draft, remaining: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Monatliche Rate" htmlFor="s-rate">
              <Input
                id="s-rate"
                inputMode="decimal"
                value={draft.rate}
                onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Fällig am" htmlFor="s-day">
              <Input
                id="s-day"
                inputMode="numeric"
                value={draft.dueDay}
                onChange={(e) => setDraft({ ...draft, dueDay: e.target.value })}
                placeholder="Tag im Monat, z. B. 5"
              />
            </Field>
            <Field label="Konto" htmlFor="s-acc">
              <Select
                id="s-acc"
                value={draft.accountId}
                onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
              >
                <option value="">Kein festes Konto</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>
                Abbrechen
              </Button>
              <Button className="flex-1" onClick={save}>
                Speichern
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!pay} onClose={() => setPay(null)} title="Rate zahlen">
        {pay ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Für „{pay.debt.name}" — die Restschuld sinkt und die Ausgabe wird gebucht.
            </p>
            <Field label="Betrag" htmlFor="p-amount">
              <Input
                id="p-amount"
                inputMode="decimal"
                value={pay.amount}
                onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                className="font-display h-14 text-2xl"
              />
            </Field>
            <Field label="Von Konto" htmlFor="p-from">
              <Select id="p-from" value={pay.from} onChange={(e) => setPay({ ...pay, from: e.target.value })}>
                <option value="">Nur Restschuld senken, nicht buchen</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              className="w-full"
              onClick={() => {
                const value = parseEuro(pay.amount);
                if (!Number.isFinite(value) || value <= 0) {
                  toast.error("Betrag prüfen");
                  return;
                }
                payDebtRate(pay.debt.id, value, pay.from || null);
                toast.ok("Rate gebucht");
                setPay(null);
              }}
            >
              Rate buchen
            </Button>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Schuld löschen?"
        body={`„${toDelete?.name ?? ""}" wird entfernt.`}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            deleteDebt(toDelete.id);
            toast.ok("Gelöscht");
          }
        }}
      />
    </AppShell>
  );
}
