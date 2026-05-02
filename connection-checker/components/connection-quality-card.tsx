"use client";

import { Activity, Download, Gauge, Network } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMbps } from "@/lib/metrics";
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
  seqPings: number;
  burstParallel: number;
  downWarmMbps: number | null;
  downMainMbps: number | null;
  downParallelMbps: number | null;
  parallelChunks: number;
  multipathHint: string | null;
  stabilityText: string;
  stabilityVariant: ServiceBadgeVariant;
  ttfbCount: number;
}) {
  const {
    hasRun,
    running,
    seqSamplesLength,
    seqSummary,
    burstSamplesLength,
    burstSummary,
    seqPings,
    burstParallel,
    downWarmMbps,
    downMainMbps,
    downParallelMbps,
    parallelChunks,
    multipathHint,
    stabilityText,
    stabilityVariant,
    ttfbCount,
  } = props;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Gauge className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            Качество соединения
          </CardTitle>
          <InfoTip label="Что здесь показано" className="size-7 shrink-0">
            <p>
              Сводка по HTTPS: задержки и «потери» на уровне HTTP, стабильность
              RTT и оценка скорости загрузки с CDN. Подробности методики — в
              подсказках у каждого блока ниже.
            </p>
          </InfoTip>
        </div>
        <CardDescription>
          Downlink, потери запросов и стабильность — один экран
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Throughput */}
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Download className="size-3.5" aria-hidden />
                Throughput
              </span>
              <InfoTip label="Как считается downlink" className="size-6 shrink-0">
                <p>
                  Три фазы GET по HTTPS к CDN: короткий warm-up, один крупный
                  объект, затем {parallelChunks} параллельных запросов.
                </p>
                <p>
                  Мбит/с — по фактическому arrayBuffer и времени; это реальный
                  браузерный путь до CDN.
                </p>
              </InfoTip>
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {!hasRun && !running
                ? "—"
                : running && downMainMbps === null
                  ? "…"
                  : downMainMbps != null
                    ? formatMbps(downMainMbps)
                    : "н/д"}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Один поток (основной замер)
            </p>
            <dl className="mt-3 space-y-1.5 border-t border-border/50 pt-3 text-xs tabular-nums">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Параллельно</dt>
                <dd className="font-medium text-foreground">
                  {!hasRun && !running
                    ? "—"
                    : running && downParallelMbps === null
                      ? "…"
                      : downParallelMbps != null
                        ? formatMbps(downParallelMbps)
                        : "н/д"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Warm-up</dt>
                <dd className="text-muted-foreground">
                  {!hasRun && !running
                    ? "—"
                    : downWarmMbps != null
                      ? formatMbps(downWarmMbps)
                      : running
                        ? "…"
                        : "н/д"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Loss */}
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Network className="size-3.5" aria-hidden />
                Потери HTTP
              </span>
              <InfoTip label="Методика потерь" className="size-6 shrink-0">
                <p>
                  Доля запросов без успеха: таймаут fetch, обрыв или (в CORS)
                  код 4xx/5xx. Сцена 1: {seqPings} проб; сцена 2: burst из{" "}
                  {burstParallel}.
                </p>
              </InfoTip>
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {seqSamplesLength
                ? `${seqSummary.lossPercent.toFixed(1)}%`
                : running
                  ? "…"
                  : "—"}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Серия {seqPings} · burst {burstParallel}
            </p>
            <p className="mt-3 border-t border-border/50 pt-3 text-xs leading-snug text-muted-foreground">
              <span className="tabular-nums">
                Успешных:{" "}
                {seqSamplesLength
                  ? `${seqSamplesLength - seqSummary.failed} / ${seqSamplesLength}`
                  : running
                    ? "…"
                    : "—"}
              </span>
              {burstSamplesLength > 0 ? (
                <>
                  {" "}
                  · burst: {burstSummary.lossPercent.toFixed(1)}% (
                  {burstSamplesLength - burstSummary.failed} / {burstSamplesLength})
                </>
              ) : running && seqSamplesLength === seqPings ? (
                <> · burst: …</>
              ) : null}
            </p>
          </div>

          {/* Stability */}
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="size-3.5" aria-hidden />
                Стабильность RTT
              </span>
              <InfoTip label="Формула стабильности" className="size-6 shrink-0">
                <p>
                  Балл 0–100 по успешности, джиттеру, вариации и хвосту p95 к
                  p50. При наличии Resource Timing усредняется TTFB.
                </p>
              </InfoTip>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums leading-none">
                {seqSamplesLength
                  ? `${seqSummary.stabilityScore}`
                  : running
                    ? "…"
                    : "—"}
              </span>
              {seqSamplesLength ? (
                <Badge variant={stabilityVariant}>{stabilityText}</Badge>
              ) : null}
            </div>
            <Progress
              className="mt-3 h-1.5"
              value={seqSamplesLength ? seqSummary.stabilityScore : 0}
            />
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2 tabular-nums">
                <dt>p50 / p95</dt>
                <dd className="text-foreground">
                  {seqSamplesLength
                    ? `${seqSummary.dist.p50.toFixed(0)} / ${seqSummary.dist.p95.toFixed(0)} мс`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <dt>Джиттер</dt>
                <dd className="text-foreground">
                  {seqSamplesLength
                    ? `${seqSummary.jitterMs.toFixed(1)} мс`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-0.5">
                  Средний TTFB
                  <InfoTip label="TTFB" className="size-4 shrink-0">
                    <p>
                      Среднее responseStart − fetchStart по Resource Timing для
                      успешных проб.
                    </p>
                  </InfoTip>
                </dt>
                <dd className="tabular-nums text-foreground">
                  {seqSamplesLength && ttfbCount > 0
                    ? `${seqSummary.meanTtfbMs.toFixed(0)} мс`
                    : seqSamplesLength
                      ? "н/д"
                      : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <p
          className={cn(
            "min-h-[2.5rem] rounded-xl border border-transparent bg-muted/20 px-3 py-2 text-xs leading-snug text-muted-foreground",
            multipathHint && "border-border/50"
          )}
        >
          {multipathHint ?? "\u00A0"}
        </p>
      </CardContent>
    </Card>
  );
}
