import { useState } from "react";
import { Check, Pencil, SkipForward, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  Button,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Modal,
  Section,
  Select,
  Switch,
} from "@/components/ui";
import { INTERVAL_LABEL, accountName, monthlyFixedLoad } from "@/lib/compute";
import { formatEuro, formatShortDate, isoDate, parseEuro } from "@/lib/money";
import {
  bookRecurring,
  deleteRecurring,
  skipRecurring,
  upsertRecurring,
  useDb,
} from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Recurring, RecurringInterval } from "@/lib/types";

const INTERVALS: RecurringInterval[] = ["monthly", "quarterly", "yearly", "weekly"];

function emptyDraft(accountId: string): Omit<Recurring, "id"> & { id?: string } {
  return {
    name: "",
    amount: 0,
    type: "expense",
    interval: "monthly",
    accountId,
    categoryId: null,
    nextDate: isoDate(),
    autoBook: false,
    active: true,
  };
}

export function FixkostenPage() {
  const db = useDb();
  const accounts = db.accounts.filter((a) => !a.archived);
  const [draft, setDraft] = useState<(Omit<Recurring, "id"> & { id?: string }) | null>(null);
  const [amountText, setAmountText] = useState("");
  const [toDelete, setToDelete] = useState<Recurring | null>(null);

  const expenses = db.recurrings.filter((r) => r.type === "expense");
  const incomes = db.recurrings.filter((r) => r.type === "income");
  const today = isoDate();

  function openNew() {
    setDraft(emptyDraft(accounts[0]?.id ?? ""));
    setAmountText("");
  }

  function openEdit(r: Recurring) {
    setDraft({ ...r });
    setAmountText(String(r.amount).replace(".", ","));
  }

  function save() {
    if (!draft) return;
    const amount = parseEuro(amountText);
    if (!draft.name.trim()) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Bitte einen Betrag größer als 0 eingeben");
      return;
    }
    if (!draft.accountId) {
      toast.error("Bitte ein Konto wählen");
      return;
    }
    upsertRecurring({ ...draft, name: draft.name.trim(), amount });
    toast.ok(draft.id ? "Geändert" : "Angelegt");
    setDraft(null);
  }

  function renderList(items: Recurring[]) {
    if (items.length === 0) return <Empty>Noch nichts angelegt.</Empty>;
    return (
      <ul className="divide-y divide-border">
        {items.map((r) => {
          const late = r.active && r.nextDate < today;
          return (
            <li key={r.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("min-w-0 truncate text-sm", !r.active && "text-muted-foreground line-through")}>
                  {r.name}
                </p>
                <span className="shrink-0 text-sm tabular-nums">{formatEuro(r.amount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {INTERVAL_LABEL[r.interval]} · {formatShortDate(r.nextDate)} ·{" "}
                  {accountName(db.accounts, r.accountId)}
                  {r.autoBook ? " · automatisch" : ""}
                  {late ? <span className="text-destructive"> · überfällig</span> : null}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`${r.name} jetzt buchen`}
                    title="Jetzt buchen"
                    onClick={() => {
                      bookRecurring(r.id);
                      toast.ok(`${r.name} gebucht`);
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${r.name} überspringen`}
                    title="Termin überspringen"
                    onClick={() => skipRecurring(r.id)}
                  >
                    <SkipForward className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`${r.name} bearbeiten`} onClick={() => openEdit(r)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`${r.name} löschen`} onClick={() => setToDelete(r)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <AppShell
      title="Fixkosten"
      action={
        <Button size="sm" onClick={openNew}>
          Neu
        </Button>
      }
    >
      <Section title="Monatliche Belastung">
        <p className="font-display text-2xl tabular-nums">{formatEuro(monthlyFixedLoad(db))}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Alle wiederkehrenden Ausgaben auf einen Monat umgerechnet (jährliche geteilt durch 12).
        </p>
      </Section>

      <Section className="mt-3" title={`Ausgaben (${expenses.length})`}>
        {renderList(expenses)}
      </Section>

      <Section className="mt-3" title={`Einnahmen (${incomes.length})`}>
        {renderList(incomes)}
      </Section>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Position bearbeiten" : "Neue Position"}
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="Name" htmlFor="r-name">
              <Input
                id="r-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="z. B. Miete"
              />
            </Field>
            <Field label="Betrag" htmlFor="r-amount">
              <Input
                id="r-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field label="Art" htmlFor="r-type">
              <Select
                id="r-type"
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as "income" | "expense", categoryId: null })
                }
              >
                <option value="expense">Ausgabe</option>
                <option value="income">Einnahme</option>
              </Select>
            </Field>
            <Field label="Rhythmus" htmlFor="r-interval">
              <Select
                id="r-interval"
                value={draft.interval}
                onChange={(e) => setDraft({ ...draft, interval: e.target.value as RecurringInterval })}
              >
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>
                    {INTERVAL_LABEL[i]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nächster Termin" htmlFor="r-date">
              <Input
                id="r-date"
                type="date"
                value={draft.nextDate}
                onChange={(e) => setDraft({ ...draft, nextDate: e.target.value })}
              />
            </Field>
            <Field label="Konto" htmlFor="r-acc">
              <Select
                id="r-acc"
                value={draft.accountId}
                onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.realm}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kategorie" htmlFor="r-cat">
              <Select
                id="r-cat"
                value={draft.categoryId ?? ""}
                onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || null })}
              >
                <option value="">Ohne Kategorie</option>
                {db.categories
                  .filter((c) => !c.archived && c.kind === draft.type)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.realm}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="rounded-lg border border-border px-3 py-2">
              <Switch
                id="r-auto"
                label="Automatisch buchen, wenn fällig"
                checked={draft.autoBook}
                onChange={(v) => setDraft({ ...draft, autoBook: v })}
              />
              <Switch
                id="r-active"
                label="Aktiv"
                checked={draft.active}
                onChange={(v) => setDraft({ ...draft, active: v })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatisch heißt: Beim Öffnen der App wird alles gebucht, was seit dem letzten Mal
              fällig war. Ohne Automatik hakst du die Position auf der Startseite selbst ab.
            </p>
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

      <ConfirmDialog
        open={!!toDelete}
        title="Position löschen?"
        body={`„${toDelete?.name ?? ""}" wird entfernt. Bereits gebuchte Beträge bleiben erhalten.`}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            deleteRecurring(toDelete.id);
            toast.ok("Gelöscht");
          }
        }}
      />
    </AppShell>
  );
}
