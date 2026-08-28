import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { periodKeyFor, periodLabel, shiftPeriod } from "@/lib/cycle";
import { useDb } from "@/lib/store";

/** Blättert durch Zeiträume — je nach Einstellung Kalendermonat oder Zyklus. */
export function PeriodBar({
  period,
  onChange,
}: {
  period: string;
  onChange: (p: string) => void;
}) {
  const { settings } = useDb();
  const { periodMode, incomeDay } = settings;
  const current = periodKeyFor(periodMode, new Date(), incomeDay);

  return (
    <div className="mb-5 flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Vorheriger Zeitraum"
        onClick={() => onChange(shiftPeriod(periodMode, period, -1, incomeDay))}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <button
        type="button"
        onClick={() => onChange(current)}
        className="font-display text-center text-lg capitalize"
        title="Zum aktuellen Zeitraum springen"
      >
        {periodLabel(periodMode, period, incomeDay)}
        {period !== current ? (
          <span className="mt-0.5 block text-[11px] font-sans text-muted-foreground">
            tippen für heute
          </span>
        ) : null}
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Nächster Zeitraum"
        onClick={() => onChange(shiftPeriod(periodMode, period, 1, incomeDay))}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
