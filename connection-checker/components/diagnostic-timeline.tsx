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
  type StepVisualState,
} from "@/lib/diagnostic-phase";

const STEPS: { title: string; subtitle: string; icon: typeof Activity }[] = [
  {
    title: "Последовательный HTTP RTT",
    subtitle: "Серия проб задержки",
    icon: Activity,
  },
  {
    title: "Burst",
    subtitle: "Серия запросов подряд",
    icon: Zap,
  },
  {
    title: "HTTPS downlink (CDN)",
    subtitle: "Скорость через jsDelivr",
    icon: CloudDownload,
  },
  {
    title: "Доступность сайтов",
    subtitle: "HTTP-пробы по регионам",
    icon: Globe,
  },
  {
    title: "Белый список Минцифры",
    subtitle: "Категории из перечня",
    icon: ShieldCheck,
  },
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
        "flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed transition-colors",
        state === "pending" && "border-border/80 bg-background/80 text-muted-foreground",
        state === "active" &&
          "border-primary bg-primary/10 text-primary shadow-sm",
        state === "done" &&
          "border-emerald-600/45 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/50 dark:text-emerald-200"
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </span>
  );
}

function StepStatusBadge({ state }: { state: StepVisualState }) {
  if (state === "done") {
    return (
      <Badge
        variant="success"
        className="shrink-0 rounded-full border-transparent px-2.5 py-0.5 text-[11px] font-semibold"
      >
        ОК
      </Badge>
    );
  }
  if (state === "active") {
    return (
      <Badge
        variant="secondary"
        className="shrink-0 gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      >
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        В процессе
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 rounded-full border-border/80 px-2.5 py-0.5 text-[11px] font-normal text-muted-foreground"
    >
      Ожидание
    </Badge>
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
      className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
      aria-labelledby="diagnostic-timeline-heading"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Ход диагностики
          </span>
          <span
            className="hidden h-px min-w-[1rem] flex-1 border-t border-dashed border-border sm:block"
            aria-hidden
          />
        </div>
        <Badge
          variant={
            running ? "secondary" : completedFullRun ? "default" : "outline"
          }
          className="shrink-0 gap-1 font-medium"
        >
          {running ? "Выполняется" : completedFullRun ? "Готово" : "Ожидание"}
        </Badge>
      </div>

      <h2 id="diagnostic-timeline-heading" className="sr-only">
        Этапы диагностики
      </h2>

      <ol className="relative space-y-0">
        {STEPS.slice(0, n).map((step, i) => {
          const state = getStepVisualState(i, {
            running,
            phase,
            completedFullRun,
            partialMaxIndex,
          });
          const Icon = step.icon;
          const isLast = i === n - 1;
          return (
            <li
              key={step.title}
              className={cn(
                "relative flex gap-3 pb-6 last:pb-0",
                "motion-safe:animate-reach-row-in motion-reduce:animate-none"
              )}
              style={{ animationDelay: `${Math.min(i, 14) * 32}ms` }}
            >
              {!isLast ? (
                <span
                  className="absolute left-[1.125rem] top-10 block w-px -translate-x-1/2 bg-border"
                  style={{ height: "calc(100% - 0.25rem)" }}
                  aria-hidden
                />
              ) : null}
              <StepIcon state={state} Icon={Icon} />
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <p className="font-semibold leading-snug text-foreground">
                    {step.title}
                  </p>
                  <StepStatusBadge state={state} />
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {state === "active" && running && phase
                    ? phase
                    : step.subtitle}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
