import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { accountsWithBalance } from "@/lib/compute";
import { isoDate, parseEuro } from "@/lib/money";
import { saveTransaction, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Transaction, TxType } from "@/lib/types";

const TYPES: [TxType, string][] = [
  ["expense", "Ausgabe"],
  ["income", "Einnahme"],
  ["transfer", "Umbuchung"],
];

export function TransactionForm({
  initial,
  onDone,
  submitLabel = "Buchen",
}: {
  initial?: Transaction;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const db = useDb();
  const accounts = accountsWithBalance(db).filter((a) => !a.archived || a.id === initial?.accountId);

  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [toId, setToId] = useState(initial?.transferAccountId ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [bookedOn, setBookedOn] = useState(initial?.bookedOn ?? isoDate());
  const [note, setNote] = useState(initial?.note ?? "");

  const fromAccount = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toId);
  const categories = db.categories.filter(
    (c) => !c.archived && (type === "income" ? c.kind === "income" : c.kind === "expense"),
  );
  const chosenCategory = categories.find((c) => c.id === categoryId);

  // Hinweis statt stiller Fehlbuchung: Kategorie und Konto gehören zu
  // verschiedenen Bereichen — in der ersten Version fiel das nie auf.
  const realmMismatch =
    type !== "transfer" && chosenCategory && fromAccount && chosenCategory.realm !== fromAccount.realm;
  const crossRealmTransfer =
    type === "transfer" && fromAccount && toAccount && fromAccount.realm !== toAccount.realm;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseEuro(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Bitte einen Betrag größer als 0 eingeben");
      return;
    }
    if (!accountId) {
      toast.error("Bitte ein Konto wählen");
      return;
    }
    if (type === "transfer" && (!toId || toId === accountId)) {
      toast.error("Bitte zwei verschiedene Konten wählen");
      return;
    }
    saveTransaction({
      id: initial?.id,
      type,
      amount: value,
      accountId,
      transferAccountId: type === "transfer" ? toId : null,
      categoryId: type === "transfer" ? null : categoryId || null,
      bookedOn,
      note: note.trim() || null,
      recurringId: initial?.recurringId ?? null,
    });
    toast.ok(initial ? "Buchung geändert" : "Gespeichert");
    if (!initial) {
      setAmount("");
      setNote("");
    }
    onDone?.();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setType(id)}
            aria-pressed={type === id}
            className={cn(
              "h-11 rounded-md border text-sm transition-colors",
              type === id
                ? "border-foreground bg-muted text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Field label="Betrag" htmlFor="amt">
        <Input
          id="amt"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="font-display h-14 text-2xl"
        />
      </Field>

      <Field label={type === "transfer" ? "Von Konto" : "Konto"} htmlFor="acc">
        <Select id="acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.realm}
            </option>
          ))}
        </Select>
      </Field>

      {type === "transfer" ? (
        <Field label="Nach Konto" htmlFor="to">
          <Select id="to" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">bitte wählen</option>
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.realm}
                </option>
              ))}
          </Select>
        </Field>
      ) : (
        <Field label="Kategorie" htmlFor="cat">
          <Select id="cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Ohne Kategorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.realm}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {realmMismatch || crossRealmTransfer ? (
        <p className="flex items-start gap-2 rounded-lg border border-caution/40 bg-caution/10 px-3 py-2 text-xs text-caution">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {crossRealmTransfer
            ? "Umbuchung zwischen Privat und Gewerbe — für die Steuer eine Entnahme oder Einlage."
            : "Kategorie und Konto gehören zu verschiedenen Bereichen. Die Auswertung folgt der Kategorie."}
        </p>
      ) : null}

      <Field label="Datum" htmlFor="date">
        <Input id="date" type="date" value={bookedOn} onChange={(e) => setBookedOn(e.target.value)} />
      </Field>

      <Field label="Notiz" htmlFor="note">
        <Input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="optional, z. B. Wocheneinkauf"
        />
      </Field>

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
