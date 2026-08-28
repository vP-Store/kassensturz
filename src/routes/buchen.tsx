import { AppShell } from "@/components/app-shell";
import { TransactionForm } from "@/components/transaction-form";

export function BuchenPage() {
  return (
    <AppShell title="Schnell buchen">
      <TransactionForm />
    </AppShell>
  );
}
