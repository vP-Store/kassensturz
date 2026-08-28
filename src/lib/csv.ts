import { accountName, categoryName } from "@/lib/compute";
import { isoDate, newId, parseEuro, round2 } from "@/lib/money";
import { getDb, update } from "@/lib/store";
import type { Database, Transaction } from "@/lib/types";

const HEADER = "Datum;Art;Betrag;Konto;Gegenkonto;Kategorie;Notiz";

function escape(value: string): string {
  return value.replaceAll(";", ",").replaceAll("\n", " ").trim();
}

const TYPE_LABEL: Record<Transaction["type"], string> = {
  income: "Einnahme",
  expense: "Ausgabe",
  transfer: "Umbuchung",
};

export function toCsv(db: Database = getDb()): string {
  const rows = [...db.transactions].sort((a, b) => a.bookedOn.localeCompare(b.bookedOn));
  const lines = rows.map((t) =>
    [
      t.bookedOn,
      TYPE_LABEL[t.type],
      String(t.amount).replace(".", ","),
      escape(accountName(db.accounts, t.accountId)),
      escape(t.transferAccountId ? accountName(db.accounts, t.transferAccountId) : ""),
      escape(t.categoryId ? categoryName(db.categories, t.categoryId) : ""),
      escape(t.note ?? ""),
    ].join(";"),
  );
  return [HEADER, ...lines].join("\n");
}

function splitLine(line: string): string[] {
  return line.split(line.includes(";") ? ";" : ",").map((c) => c.trim().replace(/^"|"$/g, ""));
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (de) {
    const [, d, m, y] = de;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export type ImportResult = { imported: number; skipped: number };

/**
 * CSV einlesen. Unbekannte Konten und Kategorien werden angelegt, damit nichts
 * still verloren geht. Spalten: Datum;Art;Betrag;Konto;Gegenkonto;Kategorie;Notiz
 */
export function importCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { imported: 0, skipped: 0 };
  const start = /datum/i.test(lines[0]) ? 1 : 0;
  let imported = 0;
  let skipped = 0;

  update((db) => {
    const accountByName = new Map(db.accounts.map((a) => [a.name.toLowerCase(), a]));
    const categoryByName = new Map(db.categories.map((c) => [c.name.toLowerCase(), c]));

    for (const line of lines.slice(start)) {
      const cols = splitLine(line);
      const date = normalizeDate(cols[0] ?? "");
      const amount = parseEuro(cols[2] ?? "");
      if (!date || !Number.isFinite(amount) || amount <= 0) {
        skipped += 1;
        continue;
      }
      const typeRaw = (cols[1] ?? "").toLowerCase();
      const type: Transaction["type"] = typeRaw.startsWith("ein")
        ? "income"
        : typeRaw.startsWith("um")
          ? "transfer"
          : "expense";

      const accName = (cols[3] ?? "").trim() || "Import";
      let account = accountByName.get(accName.toLowerCase());
      if (!account) {
        account = {
          id: newId(),
          name: accName,
          kind: "other",
          realm: "privat",
          openingBalance: 0,
          archived: false,
          createdAt: new Date().toISOString(),
        };
        db.accounts.push(account);
        accountByName.set(accName.toLowerCase(), account);
      }

      let counterId: string | null = null;
      const counterName = (cols[4] ?? "").trim();
      if (type === "transfer" && counterName) {
        let counter = accountByName.get(counterName.toLowerCase());
        if (!counter) {
          counter = {
            id: newId(),
            name: counterName,
            kind: "other",
            realm: "privat",
            openingBalance: 0,
            archived: false,
            createdAt: new Date().toISOString(),
          };
          db.accounts.push(counter);
          accountByName.set(counterName.toLowerCase(), counter);
        }
        counterId = counter.id;
      }

      let categoryId: string | null = null;
      const catName = (cols[5] ?? "").trim();
      if (type !== "transfer" && catName) {
        let cat = categoryByName.get(catName.toLowerCase());
        if (!cat) {
          cat = {
            id: newId(),
            name: catName,
            kind: type === "income" ? "income" : "expense",
            realm: account.realm,
            bucket: "need",
            archived: false,
          };
          db.categories.push(cat);
          categoryByName.set(catName.toLowerCase(), cat);
        }
        categoryId = cat.id;
      }

      db.transactions.push({
        id: newId(),
        type,
        amount: round2(amount),
        accountId: account.id,
        transferAccountId: counterId,
        categoryId,
        bookedOn: date,
        note: (cols[6] ?? "").trim() || null,
        recurringId: null,
        createdAt: new Date().toISOString(),
      });
      imported += 1;
    }
  });

  return { imported, skipped };
}

export function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupName(ext: string): string {
  return `kassensturz-${isoDate()}.${ext}`;
}
