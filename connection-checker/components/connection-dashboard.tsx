"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Globe,
  Loader2,
  RefreshCw,
  Wifi,
  X,
} from "lucide-react";

import { ConnectionQualityCard } from "@/components/connection-quality-card";
import { DiagnosticSummaryCard } from "@/components/diagnostic-summary-card";
import { DiagnosticTimeline } from "@/components/diagnostic-timeline";
import { ThemeToggle } from "@/components/theme-toggle";
import { YandexRtbSlot } from "@/components/yandex-rtb-slot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BURST_PARALLEL,
  measureDownloadWarmMainAndParallel,
  pingBurstSequential,
  pingOnce,
  SEQ_PINGS,
} from "@/lib/connection-measure";
import { REACHABILITY_TARGETS } from "@/lib/reachability-targets";
import {
  probeAllReachabilitySequential,
  type ReachabilityResult,
} from "@/lib/reachability";
import {
  WHITE_LIST_REACHABILITY_TARGETS,
} from "@/lib/whitelist-reachability-targets";
import {
  stabilityLabel,
  summarizePings,
  type PingSample,
} from "@/lib/metrics";
import { phaseStringToStepIndex } from "@/lib/diagnostic-phase";
import { cn } from "@/lib/utils";

/** Плавное появление строк таблиц диагностики; только opacity — без сдвига раскладки. */
const reachRowEnter =
  "motion-safe:animate-reach-row-in motion-reduce:animate-none";

const RUN_PROGRESS_TOTAL = SEQ_PINGS + 1 + 1 + 1 + 1;

function TableSkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  const widths =
    cols <= 4
      ? ["w-36", "w-28", "w-12", "w-14"]
      : ["w-14", "w-36", "w-28", "w-12", "w-14"];
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow
          key={i}
          className="border-border/50 motion-safe:animate-reach-row-in motion-reduce:animate-none"
          style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
        >
          {Array.from({ length: cols }, (_, j) => (
            <TableCell
              key={j}
              className="min-h-[2.75rem] p-2 align-middle"
            >
              <Skeleton
                className={`h-4 ${widths[j] ?? "w-20"} max-w-[95%]`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ConnectionDashboard() {
  const welcomeHeroSrc =
    process.env.NEXT_PUBLIC_WELCOME_HERO_SRC?.trim() || "/hero-network.svg";
  const welcomeHeroUnoptimized = /\.(gif|svg)$/i.test(welcomeHeroSrc);

  const yandexHeaderBlock =
    process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER?.trim() || undefined;
  const yandexContentBlock =
    process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_CONTENT?.trim() || undefined;
  const yandexFooterBlock =
    process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_FOOTER?.trim() || undefined;

  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [seqSamples, setSeqSamples] = useState<PingSample[]>([]);
  const [burstSamples, setBurstSamples] = useState<PingSample[]>([]);

  const [downWarmMbps, setDownWarmMbps] = useState<number | null>(null);
  const [downMainMbps, setDownMainMbps] = useState<number | null>(null);
  const [downParallelMbps, setDownParallelMbps] = useState<number | null>(null);
  const [reachability, setReachability] = useState<ReachabilityResult[]>([]);
  const [whitelistReachability, setWhitelistReachability] = useState<
    ReachabilityResult[]
  >([]);

  const [lastCompletedAt, setLastCompletedAt] = useState<number | null>(null);
  const [completedFullRun, setCompletedFullRun] = useState(false);
  const [partialMaxIndex, setPartialMaxIndex] = useState(-1);

  const seqSummary = useMemo(() => summarizePings(seqSamples), [seqSamples]);
  const burstSummary = useMemo(
    () => summarizePings(burstSamples),
    [burstSamples]
  );
  const hasRun = seqSamples.length > 0;

  const stabilityText = stabilityLabel(seqSummary.stabilityScore);
  const stabilityVariant =
    seqSummary.stabilityScore >= 85
      ? "success"
      : seqSummary.stabilityScore >= 65
        ? "secondary"
        : seqSummary.stabilityScore >= 45
          ? "warning"
          : "destructive";

  const multipathHint = useMemo(() => {
    if (downMainMbps == null || downParallelMbps == null) return null;
    if (downMainMbps <= 0) return null;
    const ratio = downParallelMbps / downMainMbps;
    if (ratio >= 1.25) {
      return `Параллельные HTTPS-загрузки быстрее одного потока на ${((ratio - 1) * 100).toFixed(0)}% — типично для HTTP/2 и мультиплексирования либо нестабильного TCP к одному серверу.`;
    }
    if (ratio <= 0.72) {
      return "Один крупный поток обгоняет сумму параллельных — бывает при узком канале, буферах или нагрузке на CPU.";
    }
    return null;
  }, [downMainMbps, downParallelMbps]);

  const reachabilityRussia = useMemo(
    () => reachability.filter((r) => r.region === "Россия"),
    [reachability]
  );
  const reachabilityAbroad = useMemo(
    () => reachability.filter((r) => r.region === "Зарубежные сайты"),
    [reachability]
  );

  const reachabilityTargetTotals = useMemo(() => {
    const ruTotal = REACHABILITY_TARGETS.filter((t) => t.region === "Россия").length;
    const abroadTotal = REACHABILITY_TARGETS.filter(
      (t) => t.region === "Зарубежные сайты"
    ).length;
    return { ruTotal, abroadTotal, total: REACHABILITY_TARGETS.length };
  }, []);

  const whitelistTargetTotal = WHITE_LIST_REACHABILITY_TARGETS.length;

  const whitelistByRegion = useMemo(() => {
    const xs = whitelistReachability;
    const ok = xs.filter((x) => x.ok).length;
    return { ok, total: xs.length };
  }, [whitelistReachability]);

  useEffect(() => {
    if (!running || !phase) return;
    const i = phaseStringToStepIndex(phase);
    if (i >= 0) setPartialMaxIndex((m) => Math.max(m, i));
  }, [running, phase]);

  const run = useCallback(async () => {
    setHasStarted(true);
    setRunning(true);
    setRunProgress(0);
    setError(null);
    setPhase("Сброс состояния…");
    setSeqSamples([]);
    setBurstSamples([]);
    setDownWarmMbps(null);
    setDownMainMbps(null);
    setDownParallelMbps(null);
    setReachability([]);
    setWhitelistReachability([]);
    setPartialMaxIndex(-1);
    setCompletedFullRun(false);

    let progressDone = 0;
    const tickProgress = () => {
      progressDone += 1;
      setRunProgress(
        Math.min(
          100,
          Math.round((progressDone / RUN_PROGRESS_TOTAL) * 100)
        )
      );
    };

    try {
      setPhase(`Последовательный RTT: 1 / ${SEQ_PINGS}`);
      const collected: PingSample[] = [];
      for (let i = 0; i < SEQ_PINGS; i++) {
        collected.push(await pingOnce(i));
        setSeqSamples([...collected]);
        tickProgress();
        setPhase(`Последовательный RTT: ${i + 1} / ${SEQ_PINGS}`);
      }

      setPhase(`Burst: ${BURST_PARALLEL} HTTP-запросов (последовательно)…`);
      const burst = await pingBurstSequential(BURST_PARALLEL);
      setBurstSamples(burst);
      tickProgress();

      setPhase("HTTPS downlink: файлы с CDN (jsDelivr)…");
      const { warm, main, parallel } = await measureDownloadWarmMainAndParallel();
      setDownWarmMbps(warm);
      setDownMainMbps(main);
      setDownParallelMbps(parallel);
      tickProgress();

      setPhase("Доступность хостов (HTTP-пробы)…");
      setReachability([]);
      const reach = await probeAllReachabilitySequential(REACHABILITY_TARGETS, {
        onItem: (row, idx, total) => {
          setReachability((prev) => [...prev, row]);
          setPhase(`Доступность хостов (HTTP-пробы): ${idx + 1} / ${total}`);
        },
      });
      setReachability(reach);
      tickProgress();

      setPhase("Белый список Минцифры: HTTP-пробы…");
      setWhitelistReachability([]);
      const wlReach = await probeAllReachabilitySequential(
        WHITE_LIST_REACHABILITY_TARGETS,
        {
          onItem: (row, idx, total) => {
            setWhitelistReachability((prev) => [...prev, row]);
            setPhase(`Белый список Минцифры: ${idx + 1} / ${total}`);
          },
        }
      );
      setWhitelistReachability(wlReach);
      tickProgress();

      if (collected.every((c) => !c.ok)) {
        setError(
          "Все HTTP-пробы к внешним точкам завершились ошибкой. Проверьте DNS, маршрут, VPN/прокси, корпоративный фаервол и блокировщики — они могут резать TLS или HTTP."
        );
      }

      setCompletedFullRun(true);
      setLastCompletedAt(Date.now());
      setPartialMaxIndex(4);
      setPhase(null);
    } catch (e) {
      setCompletedFullRun(false);
      setPhase(null);
      setError(
        e instanceof Error
          ? e.message
          : "Неизвестная ошибка при выполнении сценария. Повторите запуск."
      );
    } finally {
      setRunning(false);
      setRunProgress(0);
    }
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className={
        hasStarted
          ? "mx-auto w-full max-w-3xl px-4 py-6 sm:px-4 sm:py-8"
          : "mx-auto flex min-h-dvh w-full max-w-8xl flex-col items-center justify-center px-4 py-8"
      }
    >
      {!hasStarted ? (
      <header className="w-full max-w-lg space-y-3">
        <div
          className="relative aspect-[12/5] w-full overflow-hidden rounded-2xl border border-border/50 bg-muted/20 shadow-sm"
          aria-hidden
        >
          <Image
            src={welcomeHeroSrc}
            alt=""
            fill
            className="object-cover object-center"
            sizes="(max-width: 512px) 100vw, 32rem"
            priority
            unoptimized={welcomeHeroUnoptimized}
          />
        </div>
        <div className="space-y-5 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight">
              <Wifi className="size-6 shrink-0 text-muted-foreground" aria-hidden />
              <span className="leading-tight">Диагностика сети</span>
            </h1>
            <ThemeToggle className="shrink-0" />
          </div>
          <p className="text-center text-xs leading-snug text-muted-foreground sm:text-sm">
            Задержки, скорость загрузки и доступность сайтов из браузера.
          </p>
          <YandexRtbSlot
            blockId={yandexHeaderBlock}
            compact
            className="mx-auto w-full max-w-xl"
          />
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={run}
              disabled={running}
              className="h-11 w-full max-w-sm gap-2 px-6 text-base"
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              {running ? "Запуск…" : "Полная диагностика"}
            </Button>
          </div>
        </div>
      </header>
      ) : (
      <div className="flex w-full flex-col gap-6">
      <div className="flex justify-end">
        <ThemeToggle className="shrink-0" />
      </div>
      <div className="flex flex-col items-stretch gap-4 sm:gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
        <DiagnosticSummaryCard
          className="min-w-0 w-full lg:flex-1"
          lastCompletedAt={lastCompletedAt}
        />
        <YandexRtbSlot
          blockId={yandexHeaderBlock}
          compact
          className="min-w-0 w-full lg:max-w-[280px] lg:shrink-0"
        />
      </div>

      <ConnectionQualityCard
        hasRun={hasRun}
        running={running}
        seqSamplesLength={seqSamples.length}
        seqSummary={seqSummary}
        burstSamplesLength={burstSamples.length}
        burstSummary={burstSummary}
        downMainMbps={downMainMbps}
        multipathHint={multipathHint}
        stabilityText={stabilityText}
        stabilityVariant={stabilityVariant}
      />

      <DiagnosticTimeline
        running={running}
        phase={phase}
        completedFullRun={completedFullRun}
        partialMaxIndex={partialMaxIndex}
      />

      <div className="flex min-w-0 w-full flex-col gap-5">
      <header className="w-full space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
              <Wifi className="size-6 shrink-0 text-muted-foreground" aria-hidden />
              <span className="leading-tight">Результаты</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={run}
              disabled={running}
            >
              {running ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden />
              )}
              {running ? "Диагностика…" : "Полная диагностика"}
            </Button>
          </div>
        </div>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Не удалось завершить сценарий</AlertTitle>
          <AlertDescription className="text-destructive/90">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 flex w-full flex-col gap-6 focus-visible:ring-0">
      <YandexRtbSlot
        blockId={yandexContentBlock}
        className="w-full"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 leading-tight">
              Reachability (HTTP/S)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[440px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Сервис</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Время (мс)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reachability.length ? (
                <>
                  {reachabilityRussia.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn("border-border/60", reachRowEnter)}
                    >
                      <TableCell className="pl-0 align-top">{row.label}</TableCell>
                      <TableCell className="max-w-[140px] truncate align-top font-mono text-xs">
                        {row.host}
                      </TableCell>
                      <TableCell className="align-top">
                        {row.ok ? (
                          <Badge variant="statusOk" className="gap-1">
                            <Check className="size-3 shrink-0 opacity-90" aria-hidden />
                            Да
                          </Badge>
                        ) : (
                          <Badge variant="statusFail" className="gap-1">
                            <X className="size-3 shrink-0 opacity-90" aria-hidden />
                            Нет
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top tabular-nums">
                        {row.ok && row.ms != null
                          ? `${row.ms.toFixed(0)} мс`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {running &&
                  reachabilityRussia.length < reachabilityTargetTotals.ruTotal ? (
                    <TableSkeletonRows
                      rows={
                        reachabilityTargetTotals.ruTotal -
                        reachabilityRussia.length
                      }
                      cols={4}
                    />
                  ) : null}
                  {reachabilityAbroad.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn("border-border/60", reachRowEnter)}
                    >
                      <TableCell className="pl-0 align-top">{row.label}</TableCell>
                      <TableCell className="max-w-[140px] truncate align-top font-mono text-xs">
                        {row.host}
                      </TableCell>
                      <TableCell className="align-top">
                        {row.ok ? (
                          <Badge variant="statusOk" className="gap-1">
                            <Check className="size-3 shrink-0 opacity-90" aria-hidden />
                            Да
                          </Badge>
                        ) : (
                          <Badge variant="statusFail" className="gap-1">
                            <X className="size-3 shrink-0 opacity-90" aria-hidden />
                            Нет
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top tabular-nums">
                        {row.ok && row.ms != null
                          ? `${row.ms.toFixed(0)} мс`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {running &&
                  reachabilityAbroad.length <
                    reachabilityTargetTotals.abroadTotal ? (
                    <TableSkeletonRows
                      rows={
                        reachabilityTargetTotals.abroadTotal -
                        reachabilityAbroad.length
                      }
                      cols={4}
                    />
                  ) : null}
                </>
              ) : running ? (
                <TableSkeletonRows
                  rows={Math.min(8, reachabilityTargetTotals.total)}
                  cols={4}
                />
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-10">
                    <Empty className="border-0 p-4">
                      <EmptyHeader>
                        <EmptyTitle>Нет данных</EmptyTitle>
                        <EmptyDescription>
                          Нажмите «Полная диагностика», чтобы заполнить таблицу.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base leading-tight">
            Белый список Минцифры
          </CardTitle>
          <div className="min-h-[1.25rem] pt-2 text-xs text-muted-foreground">
            {whitelistReachability.length > 0 ? (
              <>
                OK:{" "}
                <span className="font-medium text-foreground">
                  {whitelistByRegion.ok}/{whitelistByRegion.total}
                </span>
              </>
            ) : running && reachability.length > 0 ? (
              <span className="text-muted-foreground/80">Подсчёт…</span>
            ) : (
              "\u00A0"
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[440px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Сервис</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Время (мс)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whitelistReachability.length ? (
                <>
                  {whitelistReachability.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn("border-border/60", reachRowEnter)}
                    >
                      <TableCell className="pl-0 align-top">{row.label}</TableCell>
                      <TableCell className="max-w-[140px] truncate align-top font-mono text-xs">
                        {row.host}
                      </TableCell>
                      <TableCell className="align-top">
                        {row.ok ? (
                          <Badge variant="statusOk" className="gap-1">
                            <Check className="size-3 shrink-0 opacity-90" aria-hidden />
                            Да
                          </Badge>
                        ) : (
                          <Badge variant="statusFail" className="gap-1">
                            <X className="size-3 shrink-0 opacity-90" aria-hidden />
                            Нет
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top tabular-nums">
                        {row.ok && row.ms != null
                          ? `${row.ms.toFixed(0)} мс`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {running && whitelistReachability.length < whitelistTargetTotal ? (
                    <TableSkeletonRows
                      rows={whitelistTargetTotal - whitelistReachability.length}
                      cols={4}
                    />
                  ) : null}
                </>
              ) : running ? (
                <TableSkeletonRows rows={Math.min(8, whitelistTargetTotal)} cols={4} />
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-10">
                    <Empty className="border-0 p-4">
                      <EmptyHeader>
                        <EmptyTitle>Нет данных</EmptyTitle>
                        <EmptyDescription>
                          Нажмите «Полная диагностика», чтобы заполнить таблицу.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </div>

        <Separator />
        <YandexRtbSlot
          blockId={yandexFooterBlock}
          compact
          className="w-full pt-2"
        />
      </div>
      </div>
      )}

    </div>
    </TooltipProvider>
  );
}
