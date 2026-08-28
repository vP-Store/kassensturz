import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, LayoutDashboard, Moon, Plus, Sun, Wallet } from "lucide-react";
import { Button } from "@/components/ui";
import { useDb } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/buchen", label: "Buchen", icon: Plus },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/mehr", label: "Mehr", icon: BookOpen },
] as const;

export const MORE_LINKS = [
  { to: "/buchungen", label: "Buchungen", hint: "Alles durchsuchen und ändern" },
  { to: "/fixkosten", label: "Fixkosten", hint: "Wiederkehrende Ein- und Ausgaben" },
  { to: "/konten", label: "Konten", hint: "Salden und Startwerte" },
  { to: "/ziele", label: "Sparziele", hint: "Rücklagen aufbauen" },
  { to: "/schulden", label: "Schulden", hint: "Raten und Restbeträge" },
  { to: "/berichte", label: "Berichte", hint: "Wohin das Geld fließt" },
  { to: "/einstellungen", label: "Einstellungen", hint: "Aussehen, Zyklus, Sicherung" },
] as const;

/** Schneller Hell/Dunkel-Umschalter in der Kopfzeile. */
function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  const isDark =
    choice === "dark" ||
    (choice === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Zu hell wechseln" : "Zu dunkel wechseln"}
      title={isDark ? "Heller Modus" : "Dunkler Modus"}
      onClick={() => setChoice(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}

export function AppShell({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { settings } = useDb();

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {settings.householdName}
          </p>
          <h1 className="font-display truncate text-xl">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 px-4 py-5">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <ul className="mx-auto grid max-w-3xl grid-cols-4">
          {TABS.map((tab) => {
            const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
