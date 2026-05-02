"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  X,
} from "lucide-react";

import { ConnectionQualityCard } from "@/components/connection-quality-card";
import { DeviceInfoPanel } from "@/components/device-info-panel";
import { DiagnosticSidePanel } from "@/components/diagnostic-side-panel";
import { InfoTip } from "@/components/info-tip";
import { ThemeToggle } from "@/components/theme-toggle";
import { YandexRtbSlot } from "@/components/yandex-rtb-slot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BURST_PARALLEL,
  EXTERNAL_SPEED_PARALLEL_URLS,
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
import { buildDiagnosticVerdict } from "@/lib/diagnostic-verdict";
import { phaseStringToStepIndex } from "@/lib/diagnostic-phase";
import {
  runSysadminDiagnostics,
  type SysadminDiagnostics,
} from "@/lib/sysadmin-diagnostics";

const PARALLEL_CHUNKS = EXTERNAL_SPEED_PARALLEL_URLS.length;

const RUN_PROGRESS_TOTAL = SEQ_PINGS + 1 + 1 + 1 + 1 + 1;

function formatNavigatorNetLine(n: SysadminDiagnostics["navigatorNet"]): string {
  if (!n) return "н/д (Network Information API недоступен)";
  const parts: string[] = [];
  if (n.effectiveType) parts.push(`effectiveType: ${n.effectiveType}`);
  if (n.downlinkMbps != null) parts.push(`downlink ≈ ${n.downlinkMbps} Мбит/с`);
  if (n.rttMs != null) parts.push(`rtt ≈ ${n.rttMs} мс (эвристика браузера)`);
  if (n.saveData === true) parts.push("включена экономия трафика");
  return parts.length ? parts.join(" · ") : "объект есть, полей нет";
}

function formatDohLine(d: SysadminDiagnostics["dohCloudflare"]): string {
  if (d.ok && d.latencyMs != null) return `OK, ~${d.latencyMs} мс`;
  return [d.error ?? "ошибка", d.httpStatus != null ? `HTTP ${d.httpStatus}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function SysadminRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

function TableSkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  const widths = ["w-14", "w-36", "w-28", "w-12", "w-14"];
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-b border-border/50">
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="py-2.5 pr-2 align-middle">
              <Skeleton
                className={`h-4 ${widths[j] ?? "w-20"} max-w-[95%]`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ConnectionDashboard() {
  const yandexHeaderBlock =
    process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER?.trim() || undefined;
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
  const [sysadminReport, setSysadminReport] =
    useState<SysadminDiagnostics | null>(null);
  const [sysadminError, setSysadminError] = useState<string | null>(null);

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

  const reachabilityByRegion = useMemo(() => {
    const ru = reachability.filter((r) => r.region === "Россия");
    const ab = reachability.filter((r) => r.region === "Зарубежные сайты");
    const ok = (xs: ReachabilityResult[]) => xs.filter((x) => x.ok).length;
    return {
      ru: { ok: ok(ru), total: ru.length },
      abroad: { ok: ok(ab), total: ab.length },
    };
  }, [reachability]);

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

  const tabConnectionLoading = useMemo(
    () => running && reachability.length < reachabilityTargetTotals.total,
    [running, reachability.length, reachabilityTargetTotals.total]
  );

  const tabWhitelistLoading = useMemo(
    () => running && whitelistReachability.length < whitelistTargetTotal,
    [running, whitelistReachability.length, whitelistTargetTotal]
  );

  const tabSysadminLoading = useMemo(
    () => running && sysadminReport == null && sysadminError == null,
    [running, sysadminReport, sysadminError]
  );

  const tabConnectionSuccess = useMemo(
    () =>
      !running &&
      hasStarted &&
      reachability.length >= reachabilityTargetTotals.total,
    [running, hasStarted, reachability.length, reachabilityTargetTotals.total]
  );

  const tabWhitelistSuccess = useMemo(
    () =>
      !running &&
      hasStarted &&
      whitelistReachability.length >= whitelistTargetTotal,
    [running, hasStarted, whitelistReachability.length, whitelistTargetTotal]
  );

  const tabSysadminSuccess = useMemo(
    () => !running && hasStarted && sysadminReport != null,
    [running, hasStarted, sysadminReport]
  );

  const whitelistByRegion = useMemo(() => {
    const xs = whitelistReachability;
    const ok = xs.filter((x) => x.ok).length;
    return { ok, total: xs.length };
  }, [whitelistReachability]);

  const ttfbCount = useMemo(
    () => seqSamples.filter((s) => s.ok && s.ttfbMs != null).length,
    [seqSamples]
  );

  useEffect(() => {
    if (!running || !phase) return;
    const i = phaseStringToStepIndex(phase);
    if (i >= 0) setPartialMaxIndex((m) => Math.max(m, i));
  }, [running, phase]);

  const diagnosticVerdict = useMemo(
    () =>
      buildDiagnosticVerdict({
        error,
        hasRun,
        seqSummary,
        reachabilityRu: reachabilityByRegion.ru,
        reachabilityAbroad: reachabilityByRegion.abroad,
        whitelist: whitelistByRegion,
      }),
    [error, hasRun, seqSummary, reachabilityByRegion, whitelistByRegion]
  );

  type ServiceBadgeVariant =
    | "success"
    | "secondary"
    | "warning"
    | "destructive"
    | "outline";

  const apiServiceBadge = useMemo((): {
    text: string;
    variant: ServiceBadgeVariant;
  } => {
    if (running)
      return { text: "HTTP RTT: измерение…", variant: "secondary" };
    if (error) return { text: "HTTP RTT: ошибка", variant: "destructive" };
    if (!hasRun)
      return { text: "HTTP RTT: не запускали", variant: "outline" };
    if (seqSamples.length > 0 && seqSummary.failed === seqSamples.length) {
      return { text: "HTTP RTT: нет успешных ответов", variant: "destructive" };
    }
    if (seqSummary.lossPercent === 0) {
      return { text: "HTTP RTT: без потерь", variant: "success" };
    }
    if (seqSummary.lossPercent < 10) {
      return {
        text: `HTTP RTT: потери ${seqSummary.lossPercent.toFixed(0)}%`,
        variant: "warning",
      };
    }
    return {
      text: `HTTP RTT: высокие потери (${seqSummary.lossPercent.toFixed(0)}%)`,
      variant: "destructive",
    };
  }, [
    running,
    error,
    hasRun,
    seqSamples.length,
    seqSummary.failed,
    seqSummary.lossPercent,
  ]);

  const downlinkBadge = useMemo((): {
    text: string;
    variant: ServiceBadgeVariant;
  } => {
    if (!running && !hasRun) {
      return { text: "Downlink (CDN): нет замера", variant: "outline" };
    }
    if (running && downMainMbps == null) {
      return { text: "Downlink (CDN): ожидание…", variant: "secondary" };
    }
    if (downMainMbps != null) {
      return { text: "Downlink (CDN): замер готов", variant: "success" };
    }
    return { text: "Downlink (CDN): нет данных", variant: "warning" };
  }, [running, hasRun, downMainMbps]);

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
    setSysadminReport(null);
    setSysadminError(null);
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

      try {
        setPhase("Сводка для сисадминов: DoH, часы, WebRTC…");
        const sys = await runSysadminDiagnostics();
        setSysadminReport(sys);
      } catch (e) {
        setSysadminError(
          e instanceof Error
            ? e.message
            : "Не удалось собрать сводку для сисадминов"
        );
        setSysadminReport(null);
      }
      tickProgress();

      if (collected.every((c) => !c.ok)) {
        setError(
          "Все HTTP-пробы к внешним точкам завершились ошибкой. Проверьте DNS, маршрут, VPN/прокси, корпоративный фаервол и блокировщики — они могут резать TLS или HTTP."
        );
      }

      setCompletedFullRun(true);
      setLastCompletedAt(Date.now());
      setPartialMaxIndex(5);
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
          ? "mx-auto w-full max-w-8xl px-4 py-10"
          : "mx-auto flex min-h-dvh w-full max-w-8xl flex-col items-center justify-center px-4 py-10"
      }
    >
      {!hasStarted ? (
      <header className="w-full max-w-xl space-y-4 text-center">
        <div className="space-y-4 rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-semibold tracking-tight sm:gap-3">
            <Wifi className="size-7 shrink-0" aria-hidden />
            <span className="min-w-0 leading-tight">
              Диагностика состояния сети
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Снимок из браузера по HTTP/HTTPS: задержки и стабильность
            запросов, скорость по HTTPS, доступность хостов — переключайте разделы
            под статусами.
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
              className="h-12 gap-2 px-6 text-base sm:min-w-64"
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              {running ? "Выполняется сценарий…" : "Полная диагностика"}
            </Button>
            <p className="min-h-[2.75rem] max-w-[22rem] text-center text-xs leading-snug text-muted-foreground">
              {running ? "\u00A0" : (phase ?? "\u00A0")}
            </p>
          </div>
        </div>
      </header>
      ) : (
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)] lg:items-start">
      <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
      <Tabs defaultValue="connection" className="flex w-full flex-col gap-6">
      <header className="w-full space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:gap-3">
            <Wifi className="size-7 shrink-0" aria-hidden />
            <span className="min-w-0 leading-tight">
              Диагностика состояния сети
            </span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Снимок из браузера по HTTP/HTTPS: задержки и стабильность
            запросов, скорость по HTTPS, доступность хостов — переключайте разделы
            под статусами.
          </p>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Button
              onClick={run}
              disabled={running}
              className="h-12 gap-2 px-6 text-base sm:min-w-64"
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              {running ? "Выполняется сценарий…" : "Полная диагностика"}
            </Button>
            <p className="min-h-[2.75rem] max-w-[22rem] text-xs leading-snug text-muted-foreground sm:text-left">
              {running ? "\u00A0" : (phase ?? "\u00A0")}
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-2 pt-2"
            role="list"
            aria-label="Статус HTTP RTT и downlink"
          >
            <Badge
              variant={apiServiceBadge.variant}
              className="gap-1 font-medium"
              role="listitem"
            >
              <Globe className="size-3.5 opacity-90" aria-hidden />
              {apiServiceBadge.text}
            </Badge>
            <Badge
              variant={downlinkBadge.variant}
              className="gap-1 font-medium"
              role="listitem"
            >
              <Download className="size-3.5 opacity-90" aria-hidden />
              {downlinkBadge.text}
            </Badge>
          </div>
        </div>
        <ThemeToggle className="shrink-0 self-end sm:mt-1" />
        </div>
        <TabsList
          className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:h-10"
          aria-label="Разделы результатов диагностики"
        >
          <TabsTrigger
            value="connection"
            className="gap-1.5 text-xs sm:text-sm"
          >
            {tabConnectionLoading ? (
              <Loader2
                className="size-3 shrink-0 animate-spin text-primary"
                aria-hidden
              />
            ) : tabConnectionSuccess ? (
              <Check
                className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : null}
            Соединение
          </TabsTrigger>
          <TabsTrigger
            value="whitelist"
            className="gap-1.5 text-xs sm:text-sm"
          >
            {tabWhitelistLoading ? (
              <Loader2
                className="size-3 shrink-0 animate-spin text-primary"
                aria-hidden
              />
            ) : tabWhitelistSuccess ? (
              <Check
                className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : null}
            Белые списки
          </TabsTrigger>
          <TabsTrigger
            value="sysadmin"
            className="gap-1.5 text-xs sm:text-sm"
          >
            {tabSysadminLoading ? (
              <Loader2
                className="size-3 shrink-0 animate-spin text-primary"
                aria-hidden
              />
            ) : tabSysadminSuccess ? (
              <Check
                className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : null}
            Для сисадмина
          </TabsTrigger>
        </TabsList>
        <YandexRtbSlot
          blockId={yandexHeaderBlock}
          compact
          className="w-full pt-1"
        />
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

        <TabsContent value="connection" className="mt-4 space-y-6 focus-visible:ring-0">
      <ConnectionQualityCard
        hasRun={hasRun}
        running={running}
        seqSamplesLength={seqSamples.length}
        seqSummary={seqSummary}
        burstSamplesLength={burstSamples.length}
        burstSummary={burstSummary}
        seqPings={SEQ_PINGS}
        burstParallel={BURST_PARALLEL}
        downWarmMbps={downWarmMbps}
        downMainMbps={downMainMbps}
        downParallelMbps={downParallelMbps}
        parallelChunks={PARALLEL_CHUNKS}
        multipathHint={multipathHint}
        stabilityText={stabilityText}
        stabilityVariant={stabilityVariant}
        ttfbCount={ttfbCount}
      />

      <Separator />

      <DeviceInfoPanel />

      <Separator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 leading-tight">
              Reachability (HTTP/S)
            </span>
            <InfoTip label="Про таблицу" className="size-6 shrink-0">
              <p>
                Отдельный <span className="font-medium text-foreground">fetch</span>{" "}
                на каждый хост из вашей вкладки — проверка маршрута и фильтров на
                уровне HTTP(S). VPN, корпоративный MITM и блокировщики сильно влияют
                на строку.
              </p>
              <p>
                CORS: виден статус и тело; no-cors (opaque) — JS не читает ответ,
                фиксируется успех/срыв транспорта (чужой origin без CORS).
              </p>
              <p>Не ICMP ping.</p>
            </InfoTip>
          </CardTitle>
          <CardDescription>
            Прямые HTTP-пробы; регионы — Россия и зарубежные сайты
          </CardDescription>
          <div className="min-h-[1.375rem] pt-1 text-xs text-muted-foreground">
            {reachability.length > 0 ? (
              <>
                Россия:{" "}
                <span className="font-medium text-foreground">
                  {reachabilityByRegion.ru.ok}/{reachabilityByRegion.ru.total}
                </span>
                {" · "}
                Зарубежные сайты:{" "}
                <span className="font-medium text-foreground">
                  {reachabilityByRegion.abroad.ok}/
                  {reachabilityByRegion.abroad.total}
                </span>
              </>
            ) : running ? (
              <span className="text-muted-foreground/80">Агрегация…</span>
            ) : (
              "\u00A0"
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Регион</TableHead>
                <TableHead>Сервис</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Время (мс)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reachability.length ? (
                <>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={5}
                      className="pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Россия{" "}
                      <span className="font-medium normal-case text-foreground">
                        ({reachabilityByRegion.ru.ok}/{reachabilityByRegion.ru.total})
                      </span>
                    </TableCell>
                  </TableRow>
                  {reachabilityRussia.map((row) => (
                    <TableRow key={row.id} className="border-border/60">
                      <TableCell className="pl-0 align-top">{row.region}</TableCell>
                      <TableCell className="align-top">{row.label}</TableCell>
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
                      rows={reachabilityTargetTotals.ruTotal - reachabilityRussia.length}
                      cols={5}
                    />
                  ) : null}
                  <TableRow aria-hidden="true" className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-2">
                      <Separator />
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={5}
                      className="pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Зарубежные сайты{" "}
                      <span className="font-medium normal-case text-foreground">
                        ({reachabilityByRegion.abroad.ok}/{reachabilityByRegion.abroad.total})
                      </span>
                    </TableCell>
                  </TableRow>
                  {reachabilityAbroad.map((row) => (
                    <TableRow key={row.id} className="border-border/60">
                      <TableCell className="pl-0 align-top">{row.region}</TableCell>
                      <TableCell className="align-top">{row.label}</TableCell>
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
                      cols={5}
                    />
                  ) : null}
                </>
              ) : running ? (
                <TableSkeletonRows
                  rows={Math.min(8, reachabilityTargetTotals.total)}
                  cols={5}
                />
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-10">
                    <Empty
                      title="Нет данных"
                      description="Нажмите «Полная диагностика», чтобы заполнить таблицу."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="whitelist" className="mt-4 focus-visible:ring-0">

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 leading-tight">
              Белый список Минцифры
            </span>
            <InfoTip label="О блоке" className="size-6 shrink-0">
              <p>
                HTTP(S)-пробы к категориям хостов из новостей Минцифры о
                доступности при ограничениях мобильного интернета.
              </p>
              <p>
                Набор на странице не равен полному перечню: актуальный список и
                юридические формулировки — на digital.gov.ru; ниже ссылки на
                первоисточники.
              </p>
            </InfoTip>
          </CardTitle>
          <CardDescription>
            Первичный источник — digital.gov.ru
          </CardDescription>
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
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Категория</TableHead>
                <TableHead>Сервис</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Время (мс)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whitelistReachability.length ? (
                <>
                  {whitelistReachability.map((row) => (
                    <TableRow key={row.id} className="border-border/60">
                      <TableCell className="pl-0 align-top">{row.region}</TableCell>
                      <TableCell className="align-top">{row.label}</TableCell>
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
                      cols={5}
                    />
                  ) : null}
                </>
              ) : running ? (
                <TableSkeletonRows rows={Math.min(8, whitelistTargetTotal)} cols={5} />
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-10">
                    <Empty
                      title="Нет данных"
                      description="Нажмите «Полная диагностика», чтобы заполнить таблицу."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="sysadmin" className="mt-4 focus-visible:ring-0">

      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 leading-tight">
              Сводка для сисадминов
            </span>
            <InfoTip label="Зачем этот блок" className="size-6 shrink-0">
              <p>
                Дополнительные сигналы при разборе тикетов: совпадение часов с
                сервером (TLS, Kerberos), доступность DoH (фаервол/DNS), версия
                HTTP к образцам, подсказки Network Information API, локальный и
                «внешний» IP через WebRTC/STUN.
              </p>
              <p>
                Браузер не делает ICMP traceroute и не показывает сырой DNS; часть
                полей скрыта политиками CORS/Timing-Allow-Origin.
              </p>
            </InfoTip>
          </CardTitle>
          <CardDescription>
            Часы, DoH, nextHop (HTTP), Network API, WebRTC — в конце каждого полного
            прогона
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {sysadminError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle className="text-sm">Сводка не собрана</AlertTitle>
              <AlertDescription className="text-destructive/90 text-sm">
                {sysadminError}
              </AlertDescription>
            </Alert>
          ) : null}
          {running &&
          hasStarted &&
          phase != null &&
          phase.includes("сисадмин") ? (
            <div className="space-y-2" aria-busy="true">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span className="text-xs sm:text-sm">{phase}</span>
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full max-w-lg" />
              ))}
            </div>
          ) : null}
          {running &&
          hasStarted &&
          !(phase != null && phase.includes("сисадмин")) &&
          !sysadminReport ? (
            <p className="text-xs text-muted-foreground">
              Выполняется полный сценарий — сводка появится после этапа доступности
              хостов.
            </p>
          ) : null}
          {!running && hasStarted && !sysadminReport && !sysadminError ? (
            <p className="text-sm text-muted-foreground">
              Нет данных — запустите полную диагностику до конца.
            </p>
          ) : null}
          {sysadminReport ? (
            <Accordion type="multiple" defaultValue={["summary"]} className="w-full">
              <AccordionItem value="summary">
                <AccordionTrigger>Сводка</AccordionTrigger>
                <AccordionContent>
                  <dl className="space-y-0 divide-y divide-border/60">
                    <SysadminRow
                      label="Смещение часов (клиент ↔ сервер приложения)"
                      value={`${sysadminReport.clockSkewHuman}${sysadminReport.clockSkewMs != null ? ` (${sysadminReport.clockSkewMs > 0 ? "+" : ""}${sysadminReport.clockSkewMs} мс)` : ""}`}
                    />
                    <SysadminRow
                      label="IPv4 / IPv6 (как передал прокси)"
                      value={[
                        sysadminReport.reportedIpv4 ?? "—",
                        sysadminReport.reportedIpv6 ?? "—",
                      ].join(" · ")}
                    />
                    <SysadminRow
                      label="Источник IP в API"
                      value={sysadminReport.ipSource ?? "—"}
                    />
                    <SysadminRow
                      label="Безопасный контекст (HTTPS) · вкладка"
                      value={`${sysadminReport.secureContext ? "да" : "нет"} · visibility: ${sysadminReport.visibilityState}`}
                    />
                    <SysadminRow
                      label="Service Worker управляет страницей"
                      value={sysadminReport.serviceWorkerControlling ? "да" : "нет"}
                    />
                    <SysadminRow
                      label="Network Information API"
                      value={formatNavigatorNetLine(sysadminReport.navigatorNet)}
                    />
                  </dl>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="doh">
                <AccordionTrigger>DNS-over-HTTPS (DoH)</AccordionTrigger>
                <AccordionContent>
                  <dl className="space-y-0 divide-y divide-border/60">
                    <SysadminRow
                      label="Cloudflare"
                      value={formatDohLine(sysadminReport.dohCloudflare)}
                    />
                    <SysadminRow
                      label="Google"
                      value={formatDohLine(sysadminReport.dohGoogle)}
                    />
                  </dl>
                  <p className="mt-3 text-xs leading-snug text-muted-foreground">
                    Это не «DNS вашего провайдера», а HTTPS-запросы к публичным
                    резолверам. Часто блокируются корпоративными фильтрами.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="http">
                <AccordionTrigger>Протокол HTTP (nextHopProtocol)</AccordionTrigger>
                <AccordionContent>
                  <dl className="space-y-0 divide-y divide-border/60">
                    {sysadminReport.nextHop.map((row) => (
                      <SysadminRow
                        key={row.label}
                        label={row.label}
                        value={
                          row.protocol != null && row.protocol !== ""
                            ? row.protocol
                            : "н/д (часто для чужого origin без Timing-Allow-Origin)"
                        }
                      />
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="webrtc">
                <AccordionTrigger>WebRTC / STUN</AccordionTrigger>
                <AccordionContent>
                  {sysadminReport.ice.error ? (
                    <p className="text-sm text-destructive">{sysadminReport.ice.error}</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">host: </span>
                        <span className="font-mono text-xs">
                          {sysadminReport.ice.hostIps.length
                            ? sysadminReport.ice.hostIps.join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">srflx: </span>
                        <span className="font-mono text-xs">
                          {sysadminReport.ice.srflxIps.length
                            ? sysadminReport.ice.srflxIps.join(", ")
                            : "—"}
                        </span>
                        {sysadminReport.egressMatchesHeaderIpv4 === true ? (
                          <Badge variant="success" className="text-[10px]">
                            совпадает с IPv4 из заголовка
                          </Badge>
                        ) : sysadminReport.egressMatchesHeaderIpv4 === false ? (
                          <Badge variant="warning" className="text-[10px]">
                            STUN ≠ IPv4 прокси — NAT, VPN или асимметрия
                          </Badge>
                        ) : null}
                      </div>
                      {sysadminReport.ice.relayIps.length > 0 ? (
                        <div>
                          <span className="text-muted-foreground">relay: </span>
                          <span className="font-mono text-xs">
                            {sysadminReport.ice.relayIps.join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-snug text-muted-foreground">
                    {sysadminReport.ice.note}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </CardContent>
      </Card>

        </TabsContent>

        <Separator />
        <YandexRtbSlot
          blockId={yandexFooterBlock}
          compact
          className="w-full pt-2"
        />
      </Tabs>
      </div>
      <DiagnosticSidePanel
        className="order-1 lg:order-2"
        running={running}
        runProgress={runProgress}
        phase={phase}
        lastCompletedAt={lastCompletedAt}
        verdict={diagnosticVerdict}
        completedFullRun={completedFullRun}
        partialMaxIndex={partialMaxIndex}
      />
      </div>
      )}

    </div>
    </TooltipProvider>
  );
}
