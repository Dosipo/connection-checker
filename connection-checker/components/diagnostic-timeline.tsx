"use client";

import {
  Activity,
  CloudDownload,
  Globe,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getStepVisualState,
  phaseStringToStepIndex,
  type StepVisualState,
} from "@/lib/diagnostic-phase";

const STEPS: { title: string; icon: typeof Activity }[] = [
  { title: "Последовательный HTTP RTT", icon: Activity },
  { title: "Burst", icon: Zap },
  { title: "HTTPS downlink (CDN)", icon: CloudDownload },
  { title: "Доступность сайтов", icon: Globe },
  { title: "Белый список Минцифры", icon: ShieldCheck },
];

function StepIcon({
  state,
  Icon,
}: {
  state: StepVisualState;
  Icon: (typeof STEPS)[0]["icon"];
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
        state === "pending" && "border-border/70 bg-muted/50 text-muted-foreground",
        state === "active" &&
          "border-primary/50 bg-muted text-foreground shadow-sm",
        state === "done" &&
          "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      )}
    >
      <Icon className="size-[14px]" aria-hidden />
    </span>
  );
}

function StepStatus({ state }: { state: StepVisualState }) {
  if (state === "done") {
    return (
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
        ОК
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden />
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
      …
    </span>
  );
}

export function DiagnosticTimeline(props: {
  running: boolean;
  phase: string | null;
  completedFullRun: boolean;
  partialMaxIndex: number;
}) {
  const { running, phase, completedFullRun, partialMaxIndex } = props;
  const n = STEPS.length;

  return (
    <section
      className="rounded-lg border border-border/60 bg-card px-3 py-2.5 text-card-foreground shadow-sm"
      aria-labelledby="diagnostic-timeline-heading"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span
          id="diagnostic-timeline-heading"
          className="text-xs font-medium text-muted-foreground"
        >
          Ход диагностики
        </span>
        <Badge
          variant={
            running ? "secondary" : completedFullRun ? "default" : "outline"
          }
          className="h-6 shrink-0 px-2 py-0 text-[11px] font-medium"
        >
          {running ? "Выполняется" : completedFullRun ? "Готово" : "Ожидание"}
        </Badge>
      </div>

      <h2 className="sr-only">Этапы диагностики</h2>

      <ol className="space-y-0">
        {STEPS.slice(0, n).map((step, i) => {
          const state = getStepVisualState(i, {
            running,
            phase,
            completedFullRun,
            partialMaxIndex,
          });
          const Icon = step.icon;
          const showPhase =
            state === "active" &&
            running &&
            phase &&
            phaseStringToStepIndex(phase) === i;
          return (
            <li
              key={step.title}
              className={cn(
                "flex items-center gap-2.5 py-1.5",
                "motion-safe:animate-reach-row-in motion-reduce:animate-none",
                i !== 0 && "border-t border-border/40"
              )}
              style={{ animationDelay: `${Math.min(i, 14) * 20}ms` }}
            >
              <StepIcon state={state} Icon={Icon} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium leading-tight text-foreground">
                    {step.title}
                  </p>
                  <StepStatus state={state} />
                </div>
                {showPhase ? (
                  <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
                    {phase}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
