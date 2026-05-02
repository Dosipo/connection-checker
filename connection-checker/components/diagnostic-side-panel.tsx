"use client";

import { useEffect, useState } from "react";
import { Loader2, Wifi } from "lucide-react";

import { DiagnosticTimeline } from "@/components/diagnostic-timeline";
import { DiagnosticVerdictBlock } from "@/components/diagnostic-verdict-block";
import { Progress } from "@/components/ui/progress";
import type { DiagnosticVerdict } from "@/lib/diagnostic-verdict";
import { formatRelativeTimeShortRu } from "@/lib/format-relative";
import { cn } from "@/lib/utils";

export function DiagnosticSidePanel({
  running,
  runProgress,
  phase,
  lastCompletedAt,
  verdict,
  completedFullRun,
  partialMaxIndex,
  className,
}: {
  running: boolean;
  runProgress: number;
  phase: string | null;
  lastCompletedAt: number | null;
  verdict: DiagnosticVerdict | null;
  completedFullRun: boolean;
  partialMaxIndex: number;
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
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border/50 bg-muted/50 p-4 shadow-sm backdrop-blur-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto",
        className
      )}
      aria-label="Сводка и ход диагностики"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/90 via-violet-500/85 to-fuchsia-500/80 shadow-inner ring-1 ring-white/20"
          aria-hidden
        >
          <Wifi className="size-5 text-white drop-shadow" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-foreground">
            Диагностика сети
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Обновлено: {updatedLabel}
          </p>
        </div>
      </div>

      {running ? (
        <div
          className="rounded-2xl border border-primary/20 bg-background/80 p-3 shadow-sm"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              Выполняется
            </span>
            <span className="tabular-nums text-xs text-muted-foreground">
              {runProgress}%
            </span>
          </div>
          <Progress value={runProgress} className="h-2" />
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {phase ?? "…"}
          </p>
        </div>
      ) : null}

      <DiagnosticTimeline
        running={running}
        phase={phase}
        completedFullRun={completedFullRun}
        partialMaxIndex={partialMaxIndex}
      />

      <DiagnosticVerdictBlock verdict={verdict} />
    </aside>
  );
}
