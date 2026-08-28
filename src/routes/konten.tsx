import { useState } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, Empty, Field, Input, Modal, Section, Select } from "@/components/ui";
import { accountsWithBalance, realmBalance, totalBalance } from "@/lib/compute";
import { formatEuro, formatPlain, parseEuro } from "@/lib/money";
import { setAccountArchived, upsertAccount, useDb } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AccountKind, Realm } from "@/lib/types";

const KINDS: { id: AccountKind; label: string }[] = [
  { id: "giro", label: "Girokonto" },
  { id: "spar", label: "Sparkonto" },
  { id: "cash", label: "Bargeld" },
  { id: "paypal", label: "PayPal" },
  { id: "gewerbe", label: "Geschäftskonto" },
  { id: "other", label: "Sonstiges" },
];

type Draft = { id?: string; name: string; kind: AccountKind; realm: Realm; opening: string; archived: boolean };

export function KontenPage() {
  const db = useDb();
  const accounts = accountsWithBalance(db);
  const [draft, setDraft] = useState<Draft | null>(null);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  function save() {
    if (!draft) return;
    const opening = draft.opening.trim() === "" ? 0 : parseEuro(draft.opening);
    if (!draft.name.trim()) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }
    if (!Number.isFinite(opening)) {
      toast.error("Startsaldo prüfen");
      return;
    }
    upsertAccount({
      id: draft.id,
      name: draft.name.trim(),
      kind: draft.kind,
      realm: draft.realm,
      openingBalance: opening,
      archived: draft.archived,
    });
    toast.ok(draft.id ? "Konto geändert" : "Konto angelegt");
    setDraft(null);
  }

  return (
    <AppShell
      title="Konten"
      action={
        <Button
          size="sm"
          onClick={() =>
            setDraft({ name: "", kind: "giro", realm: "privat", opening: "", archived: false })
          }
        >
          Neu
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Gesamt</p>
          <p className="tabular-nums">{formatEuro(totalBalance(accounts))}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Privat</p>
          <p className="tabular-nums">{formatEuro(realmBalance(accounts, "privat"))}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-muted-foreground">Gewerbe</p>
          <p className="tabular-nums">{formatEuro(realmBalance(accounts, "gewerbe"))}</p>
        </div>
      </div>

      <Section className="mt-3" title="Konten">
        {active.length === 0 ? (
          <Empty>Noch kein Konto angelegt.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KINDS.find((k) => k.id === a.kind)?.label ?? a.kind} · {a.realm} · Start{" "}
                    {formatEuro(a.openingBalance)}
                  </p>
                </div>
                <span className={cn("shrink-0 tabular-nums", a.balance < 0 && "text-destructive")}>
                  {formatEuro(a.balance)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${a.name} bearbeiten`}
                  onClick={() =>
                    setDraft({
                      id: a.id,
                      name: a.name,
                      kind: a.kind,
                      realm: a.realm,
                      opening: formatPlain(a.openingBalance),
                      archived: a.archived,
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${a.name} archivieren`}
                  title="Archivieren"
                  onClick={() => {
                    setAccountArchived(a.id, true);
                    toast.ok("Archiviert");
                  }}
                >
                  <Archive className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Der Startsaldo ist der Kontostand am Tag, an dem du hier angefangen hast. Alle Buchungen
          danach werden darauf gerechnet.
        </p>
      </Section>

      {archived.length > 0 ? (
        <Section className="mt-3" title="Archiv">
          <ul className="divide-y divide-border">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-2.5 text-muted-foreground">
                <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                <span className="tabular-nums">{formatEuro(a.balance)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${a.name} zurückholen`}
                  onClick={() => setAccountArchived(a.id, false)}
                >
                  <ArchiveRestore className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Konto bearbeiten" : "Neues Konto"}>
        {draft ? (
          <div className="space-y-4">
            <Field label="Name" htmlFor="a-name">
              <Input
                id="a-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="z. B. Giro Privat"
              />
            </Field>
            <Field label="Art" htmlFor="a-kind">
              <Select
                id="a-kind"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as AccountKind })}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bereich" htmlFor="a-realm">
              <Select
                id="a-realm"
                value={draft.realm}
                onChange={(e) => setDraft({ ...draft, realm: e.target.value as Realm })}
              >
                <option value="privat">Privat</option>
                <option value="gewerbe">Gewerbe</option>
              </Select>
            </Field>
            <Field label="Startsaldo" htmlFor="a-open" hint="Aktueller Kontostand beim Start.">
              <Input
                id="a-open"
                inputMode="decimal"
                value={draft.opening}
                onChange={(e) => setDraft({ ...draft, opening: e.target.value })}
                placeholder="0,00"
              />
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
    </AppShell>
  );
}
