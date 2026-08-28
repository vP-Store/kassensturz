import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui";
import { BerichtePage } from "@/routes/berichte";
import { BuchenPage } from "@/routes/buchen";
import { BuchungenPage } from "@/routes/buchungen";
import { BudgetPage } from "@/routes/budget";
import { EinstellungenPage } from "@/routes/einstellungen";
import { FixkostenPage } from "@/routes/fixkosten";
import { HomePage } from "@/routes/index";
import { KontenPage } from "@/routes/konten";
import { MehrPage } from "@/routes/mehr";
import { SchuldenPage } from "@/routes/schulden";
import { ZielePage } from "@/routes/ziele";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster />
    </>
  ),
});

const page = (path: string, component: () => React.JSX.Element) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  page("/", HomePage),
  page("/buchen", BuchenPage),
  page("/buchungen", BuchungenPage),
  page("/budget", BudgetPage),
  page("/fixkosten", FixkostenPage),
  page("/konten", KontenPage),
  page("/ziele", ZielePage),
  page("/schulden", SchuldenPage),
  page("/berichte", BerichtePage),
  page("/einstellungen", EinstellungenPage),
  page("/mehr", MehrPage),
]);

// Hash-Routing: so funktionieren tiefe Links auch auf GitHub Pages, wo es
// keinen Server gibt, der jede Adresse auf die index.html lenken könnte.
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: false,
  scrollRestoration: true,
});
