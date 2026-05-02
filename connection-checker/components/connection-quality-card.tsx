"use client";

import { Gauge, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  downlinkProgressValue,
  downlinkQualityLabel,
  formatMbps,
  httpLossProgressValue,
  httpLossQualityLabel,
  qualityLabelVariant,
} from "@/lib/metrics";
import { phaseStringToStepIndex } from "@/lib/diagnostic-phase";
import { cn } from "@/lib/utils";

type ServiceBadgeVariant =
  | "success"
  | "secondary"
  | "warning"
  | "destructive"
  | "outline";

export function ConnectionQualityCard(props: {
  hasRun: boolean;
  running: boolean;
  phase: string | null;
  seqSamplesLength: number;
  seqSummary: {
    lossPercent: number;
    failed: number;
    stabilityScore: number;
    dist: { p50: number; p95: number };
    jitterMs: number;
    meanTtfbMs: number;
  };
  burstSamplesLength: number;
  burstSummary: { lossPercent: number; failed: number };
  downMainMbps: number | null;
  multipathHint: string | null;
}) {
  const {
    hasRun,
    running,
    phase,
    seqSamplesLength,
    seqSummary,
    burstSamplesLength,
    burstSummary,
    downMainMbps,
    multipathHint,
  } = props;

  const mainMbps =
    !hasRun && !running
      ? "—"
      : running && downMainMbps === null
        ? "…"
        : downMainMbps != null
          ? formatMbps(downMainMbps)
          : "н/д";

  const hasSpeedSample =
    downMainMbps != null && Number.isFinite(downMainMbps) && downMainMbps >= 0;
  const speedAssessment = hasSpeedSample
    ? downlinkQualityLabel(downMainMbps as number)
    : null;
  const speedBadgeVariant = speedAssessment
    ? qualityLabelVariant(speedAssessment)
    : undefined;
  const speedProgress = hasSpeedSample
    ? downlinkProgressValue(downMainMbps as number)
    : null;

  const combinedLossPercent =
    seqSamplesLength > 0
      ? Math.max(
          seqSummary.lossPercent,
          burstSamplesLength > 0 ? burstSummary.lossPercent : 0
        )
      : null;
  const lossAssessment =
    combinedLossPercent != null
      ? httpLossQualityLabel(combinedLossPercent)
      : null;
  const lossBadgeVariant = lossAssessment
    ? qualityLabelVariant(lossAssessment)
    : undefined;
  const lossProgress =
    combinedLossPercent != null
      ? httpLossProgressValue(combinedLossPercent)
      : null;

  const phaseIdx = phaseStringToStepIndex(phase);
  const speedProcessing =
    running && downMainMbps === null && phaseIdx === 2;
  const lossProcessing =
    running && seqSamplesLength === 0 && phaseIdx < 2;

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Gauge className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          Качество интернета
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid items-stretch gap-5 pt-3 sm:grid-cols-2 sm:gap-6">
          <MetricBlock
            label="Скорость (CDN)"
            value={mainMbps}
            assessment={speedAssessment}
            badgeVariant={speedBadgeVariant}
            progressValue={speedProgress}
            processing={speedProcessing}
            processingDetail={speedProcessing ? phase : null}
          />
          <MetricBlock
            label="Потери HTTP"
            value={
              seqSamplesLength && combinedLossPercent != null
                ? `${combinedLossPercent.toFixed(1)}%`
                : running
                  ? "…"
                  : "—"
            }
            assessment={lossAssessment}
            badgeVariant={lossBadgeVariant}
            progressValue={lossProgress}
            processing={lossProcessing}
            processingDetail={lossProcessing ? phase : null}
          />
        </div>

        {multipathHint ? (
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {multipathHint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricBlock({
  label,
  value,
  assessment,
  badgeVariant,
  progressValue,
  processing,
  processingDetail,
}: {
  label: string;
  value: string;
  assessment?: string | null;
  badgeVariant?: ServiceBadgeVariant;
  progressValue?: number | null;
  processing?: boolean;
  processingDetail?: string | null;
}) {
  const showBadge =
    assessment != null && badgeVariant != null;
  const showProgress =
    progressValue != null && Number.isFinite(progressValue);

  if (processing) {
    return (
      <div className="flex h-full min-w-0 flex-col">
        <p className="text-xs leading-snug text-muted-foreground">{label}</p>
        <div className="mt-1 flex min-h-[3rem] flex-col justify-center gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Loader2
              className="size-5 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm font-medium text-foreground">
              Замер…
            </span>
          </div>
          {processingDetail ? (
            <p
              className="line-clamp-2 text-[11px] leading-snug text-muted-foreground"
              title={processingDetail}
            >
              {processingDetail}
            </p>
          ) : null}
        </div>
        <div className="mt-2 h-1 w-full max-w-[12rem] shrink-0">
          <IndeterminateProgress />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <p className="text-xs leading-snug text-muted-foreground">{label}</p>
      <div className="mt-1 flex min-h-[3rem] flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight">
          {value}
        </span>
        {showBadge ? (
          <Badge variant={badgeVariant} className="shrink-0">
            {assessment}
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 h-1 w-full max-w-[12rem] shrink-0">
        {showProgress ? (
          <Progress
            className="h-1 w-full"
            value={Math.min(100, Math.max(0, progressValue as number))}
          />
        ) : (
          <div className="h-1 w-full" aria-hidden />
        )}
      </div>
    </div>
  );
}

function IndeterminateProgress({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      role="progressbar"
      aria-valuetext="Выполняется"
      aria-busy="true"
    >
      <div
        className="absolute top-0 h-full w-[38%] rounded-full bg-primary/80 motion-safe:animate-progress-indeterminate motion-reduce:opacity-70"
        aria-hidden
      />
    </div>
  );
}
