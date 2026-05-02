"use client";

import { Gauge } from "lucide-react";

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

type ServiceBadgeVariant =
  | "success"
  | "secondary"
  | "warning"
  | "destructive"
  | "outline";

export function ConnectionQualityCard(props: {
  hasRun: boolean;
  running: boolean;
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
  stabilityText: string;
  stabilityVariant: ServiceBadgeVariant;
}) {
  const {
    hasRun,
    running,
    seqSamplesLength,
    seqSummary,
    burstSamplesLength,
    burstSummary,
    downMainMbps,
    multipathHint,
    stabilityText,
    stabilityVariant,
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

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Gauge className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          Качество соединения
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-5 border-t border-border/50 pt-4 sm:grid-cols-3 sm:gap-6">
          <MetricBlock
            label="Скорость (CDN)"
            value={mainMbps}
            assessment={speedAssessment}
            badgeVariant={speedBadgeVariant}
            progressValue={speedProgress}
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
          />
          <MetricBlock
            label="Стабильность RTT"
            value={
              seqSamplesLength
                ? String(seqSummary.stabilityScore)
                : running
                  ? "…"
                  : "—"
            }
            assessment={seqSamplesLength ? stabilityText : null}
            badgeVariant={
              seqSamplesLength ? stabilityVariant : undefined
            }
            progressValue={
              seqSamplesLength ? seqSummary.stabilityScore : null
            }
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
}: {
  label: string;
  value: string;
  assessment?: string | null;
  badgeVariant?: ServiceBadgeVariant;
  progressValue?: number | null;
}) {
  const showBadge =
    assessment != null && badgeVariant != null;
  const showProgress =
    progressValue != null && Number.isFinite(progressValue);
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {showBadge ? (
          <Badge variant={badgeVariant}>{assessment}</Badge>
        ) : null}
      </div>
      {showProgress ? (
        <Progress
          className="mt-2 h-1 max-w-[12rem]"
          value={Math.min(100, Math.max(0, progressValue))}
        />
      ) : null}
    </div>
  );
}
