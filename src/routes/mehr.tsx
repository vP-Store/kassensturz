import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AppShell, MORE_LINKS } from "@/components/app-shell";

export function MehrPage() {
  return (
    <AppShell title="Mehr">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {MORE_LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <span>
                <span className="block text-sm">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Kassensturz · alle Daten bleiben auf diesem Gerät
      </p>
    </AppShell>
  );
}
