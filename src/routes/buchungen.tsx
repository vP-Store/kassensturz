import { useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PeriodBar } from "@/components/period-bar";
import { TransactionForm } from "@/components/transaction-form";
import { Button, ConfirmDialog, Empty, Input, Modal, Section, Select } from "@/components/ui";
import { accountName, categoryName, periodTransactions } from "@/lib/compute";
import { periodKeyFor } from "@/lib/cycle";
import { formatEuro, formatShortDate } from "@/lib/money";
import { deleteTransaction, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export function BuchungenPage() {
  const db = useDb();
  const [period, setPeriod] = useState(() =>
    periodKeyFor(db.settings.periodMode, new Date(), db.settings.incomeDay),
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"alle" | "expense" | "income" | "transfer">("alle");
  const [scope, setScope] = useState<"zeitraum" | "alle">("zeitraum");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const list = useMemo(() => {
    const base =
      scope === "alle"
        ? [...db.transactions].sort((a, b) => b.bookedOn.localeCompare(a.bookedOn))
        : periodTransactions(db, period);
    const q = search.trim().toLowerCase();
    return base.filter((t) => {
      if (filter !== "alle" && t.type !== filter) return false;
      if (!q) return true;
      const haystack = [
        t.note ?? "",
        categoryName(db.categories, t.categoryId),
        accountName(db.accounts, t.accountId),
        String(t.amount).replace(".", ","),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [db, period, search, filter, scope]);

  const sum = list.reduce(
    (acc, t) => {
      if (t.type === "income") acc.ein += t.amount;
      if (t.type === "expense") acc.aus += t.amount;
      return acc;
    },
    { ein: 0, aus: 0 },
  );

  return (
    <AppShell title="Buchungen">
      {scope === "zeitraum" ? <PeriodBar period={period} onChange={setPeriod} /> : null}

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen nach Notiz, Kategorie, Konto oder Betrag"
            className="pl-9"
            aria-label="Buchungen durchsuchen"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            aria-label="Art filtern"
          >
            <option value="alle">Alle Arten</option>
            <option value="expense">Nur Ausgaben</option>
            <option value="income">Nur Einnahmen</option>
            <option value="transfer">Nur Umbuchungen</option>
          </Select>
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            aria-label="Zeitraum"
          >
            <option value="zeitraum">Nur dieser Zeitraum</option>
            <option value="alle">Gesamter Verlauf</option>
          </Select>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Einnahmen</p>
          <p className="tabular-nums text-positive">{formatEuro(sum.ein)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Ausgaben</p>
          <p className="tabular-nums text-destructive">{formatEuro(sum.aus)}</p>
        </div>
      </div>

      <Section className="mt-3" title={`${list.length} Buchungen`}>
        {list.length === 0 ? (
          <Empty>Nichts gefunden.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {t.note || categoryName(db.categories, t.categoryId)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatShortDate(t.bookedOn)} · {accountName(db.accounts, t.accountId)}
                    {t.type === "transfer"
                      ? ` → ${accountName(db.accounts, t.transferAccountId)}`
                      : ` · ${categoryName(db.categories, t.categoryId)}`}
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
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Buchung bearbeiten"
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Buchung löschen"
                  onClick={() => setToDelete(t)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Buchung bearbeiten">
        {editing ? (
          <TransactionForm
            initial={editing}
            submitLabel="Änderung speichern"
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Buchung löschen?"
        body={`${toDelete?.note || ""} ${toDelete ? formatEuro(toDelete.amount) : ""} — das lässt sich nicht rückgängig machen.`}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            deleteTransaction(toDelete.id);
            toast.ok("Buchung gelöscht");
          }
        }}
      />
    </AppShell>
  );
}
