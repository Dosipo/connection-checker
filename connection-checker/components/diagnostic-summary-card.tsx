"use client";

import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";

import { formatRelativeTimeShortRu } from "@/lib/format-relative";
import { cn } from "@/lib/utils";

export function DiagnosticSummaryCard({
  lastCompletedAt,
  className,
}: {
  lastCompletedAt: number | null;
  className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lastCompletedAt == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [lastCompletedAt]);

  const updatedLabel =
    lastCompletedAt != null
      ? formatRelativeTimeShortRu(lastCompletedAt)
      : "ещё не было полного прогона";

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/50 bg-muted/40 p-4 shadow-sm backdrop-blur-sm sm:p-5",
        className
      )}
      aria-label="Сводка диагностики"
    >
      <div className="flex gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/85 to-violet-600/80 text-white shadow-sm ring-1 ring-white/15"
          aria-hidden
        >
          <Wifi className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-lg font-semibold leading-tight tracking-tight">
            Диагностика сети
          </h1>
          <p className="text-xs text-muted-foreground">
            <span className="text-muted-foreground/90">Обновлено:</span>{" "}
            <span className="tabular-nums">{updatedLabel}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
