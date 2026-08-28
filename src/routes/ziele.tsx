import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, ConfirmDialog, Empty, Field, Input, Modal, Section, Select } from "@/components/ui";
import { formatEuro, formatPlain, isoDate, parseEuro } from "@/lib/money";
import { deleteGoal, depositToGoal, upsertGoal, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { daysUntil } from "@/lib/cycle";
import { parseIso } from "@/lib/money";
import type { Goal, Realm } from "@/lib/types";

type Draft = {
  id?: string;
  name: string;
  target: string;
  current: string;
  deadline: string;
  realm: Realm;
  accountId: string;
};

export function ZielePage() {
  const db = useDb();
  const accounts = db.accounts.filter((a) => !a.archived);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deposit, setDeposit] = useState<{ goal: Goal; amount: string; from: string } | null>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  function save() {
    if (!draft) return;
    const target = parseEuro(draft.target);
    const current = draft.current.trim() === "" ? 0 : parseEuro(draft.current);
    if (!draft.name.trim()) return toast.error("Bitte einen Namen eingeben");
    if (!Number.isFinite(target) || target <= 0) return toast.error("Zielbetrag prüfen");
    if (!Number.isFinite(current) || current < 0) return toast.error("Aktueller Stand prüfen");
    upsertGoal({
      id: draft.id,
      name: draft.name.trim(),
      target,
      current,
      deadline: draft.deadline || null,
      realm: draft.realm,
      accountId: draft.accountId || null,
    });
    toast.ok(draft.id ? "Ziel geändert" : "Ziel angelegt");
    setDraft(null);
  }

  return (
    <AppShell
      title="Sparziele"
      action={
        <Button
          size="sm"
          onClick={() =>
            setDraft({
              name: "",
              target: "",
              current: "",
              deadline: "",
              realm: "privat",
              accountId: accounts.find((a) => a.kind === "spar")?.id ?? "",
            })
          }
        >
          Neu
        </Button>
      }
    >
      {db.goals.length === 0 ? (
        <Section>
          <Empty>
            Noch kein Ziel. Ein Ziel hilft, Rücklagen sichtbar zu machen — zum Beispiel drei
            Monatsausgaben als Puffer.
          </Empty>
        </Section>
      ) : (
        <ul className="space-y-3">
          {db.goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
            const days = g.deadline ? daysUntil(parseIso(g.deadline)) : null;
            const missing = Math.max(0, g.target - g.current);
            return (
              <li key={g.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.realm}
                      {g.deadline
                        ? ` · bis ${new Date(g.deadline).toLocaleDateString("de-DE")}${
                            days !== null && days >= 0 ? ` (${days} Tage)` : " (überfällig)"
                          }`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Auf ${g.name} einzahlen`}
                      title="Einzahlen"
                      onClick={() =>
                        setDeposit({ goal: g, amount: "", from: accounts[0]?.id ?? "" })
                      }
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${g.name} löschen`}
                      onClick={() => setToDelete(g)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-positive" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm tabular-nums">
                  {formatEuro(g.current)} von {formatEuro(g.target)}
                  <span className="text-muted-foreground"> · noch {formatEuro(missing)}</span>
                </p>
                {days !== null && days > 0 && missing > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dafür brauchst du {formatEuro((missing / days) * 30)} im Monat.
                  </p>
                ) : null}
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() =>
                    setDraft({
                      id: g.id,
                      name: g.name,
                      target: formatPlain(g.target),
                      current: formatPlain(g.current),
                      deadline: g.deadline ?? "",
                      realm: g.realm,
                      accountId: g.accountId ?? "",
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

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Ziel bearbeiten" : "Neues Ziel"}>
        {draft ? (
          <div className="space-y-4">
            <Field label="Name" htmlFor="g-name">
              <Input
                id="g-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="z. B. Notgroschen"
              />
            </Field>
            <Field label="Zielbetrag" htmlFor="g-target">
              <Input
                id="g-target"
                inputMode="decimal"
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Schon gespart" htmlFor="g-current">
              <Input
                id="g-current"
                inputMode="decimal"
                value={draft.current}
                onChange={(e) => setDraft({ ...draft, current: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Zieldatum" htmlFor="g-deadline">
              <Input
                id="g-deadline"
                type="date"
                value={draft.deadline}
                min={isoDate()}
                onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
              />
            </Field>
            <Field label="Sparkonto" htmlFor="g-acc" hint="Einzahlungen werden auf dieses Konto umgebucht.">
              <Select
                id="g-acc"
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

      <Modal open={!!deposit} onClose={() => setDeposit(null)} title="Einzahlen">
        {deposit ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Auf „{deposit.goal.name}" — der Stand steigt und die Buchung wird gleich mit angelegt.
            </p>
            <Field label="Betrag" htmlFor="d-amount">
              <Input
                id="d-amount"
                inputMode="decimal"
                value={deposit.amount}
                onChange={(e) => setDeposit({ ...deposit, amount: e.target.value })}
                placeholder="0,00"
                className="font-display h-14 text-2xl"
              />
            </Field>
            <Field label="Von Konto" htmlFor="d-from">
              <Select
                id="d-from"
                value={deposit.from}
                onChange={(e) => setDeposit({ ...deposit, from: e.target.value })}
              >
                <option value="">Nur Stand erhöhen, nicht buchen</option>
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
                const value = parseEuro(deposit.amount);
                if (!Number.isFinite(value) || value <= 0) {
                  toast.error("Betrag prüfen");
                  return;
                }
                depositToGoal(deposit.goal.id, value, deposit.from || null);
                toast.ok("Eingezahlt");
                setDeposit(null);
              }}
            >
              Einzahlen
            </Button>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Ziel löschen?"
        body={`„${toDelete?.name ?? ""}" wird entfernt. Bereits gebuchte Einzahlungen bleiben erhalten.`}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            deleteGoal(toDelete.id);
            toast.ok("Gelöscht");
          }
        }}
      />
    </AppShell>
  );
}
