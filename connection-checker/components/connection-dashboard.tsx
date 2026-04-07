"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  Download,
  Gauge,
  Globe,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from "lucide-react";

import { DeviceInfoPanel } from "@/components/device-info-panel";
import { InfoTip } from "@/components/info-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  formatMbps,
  stabilityLabel,
  summarizePings,
  type PingSample,
} from "@/lib/metrics";

const PARALLEL_CHUNKS = EXTERNAL_SPEED_PARALLEL_URLS.length;

const RUN_PROGRESS_TOTAL = SEQ_PINGS + 1 + 1 + 1 + 1;

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

  const whitelistByRegion = useMemo(() => {
    const xs = whitelistReachability;
    const ok = xs.filter((x) => x.ok).length;
    return { ok, total: xs.length };
  }, [whitelistReachability]);

  const ttfbCount = useMemo(
    () => seqSamples.filter((s) => s.ok && s.ttfbMs != null).length,
    [seqSamples]
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

      setPhase(null);
    } catch (e) {
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="space-y-3">
        <div className="space-y-3">
          <h1 className="flex items-center gap-1 text-2xl font-semibold tracking-tight sm:gap-2">
            <Wifi className="size-7 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 leading-tight">
              Диагностика HTTP/HTTPS
            </span>
            <InfoTip
              label="Методика страницы"
              className="self-start sm:self-center"
            >
              <p>
                Все замеры — обычные{" "}
                <span className="font-medium text-foreground">fetch</span> из
                вкладки: последовательный и параллельный HTTP RTT к ротируемым
                внешним URL, затем HTTPS downlink с публичного CDN (файлы по
                CORS).
              </p>
              <p>
                Ниже — отдельные HTTP(S)-пробы до выбранных хостов (Россия /
                зарубежные сайты) и к типовым ресурсам из публикаций Минцифры. Это не ICMP
                ping: в браузере доступен только стек TLS + HTTP.
              </p>
              <p>
                Итог зависит от маршрута, прокси/VPN, фильтров и расширений и не
                обязан совпадать с «тарифной» скоростью провайдера.
              </p>
            </InfoTip>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            HTTP-задержка и потери, throughput по HTTPS, доступность хостов.
            У блоков — иконка «i» с пояснениями.
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
          {hasStarted ? (
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
          ) : null}
        </div>
      </header>

      {running ? (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="sticky top-0 z-40 -mx-4 mb-1 border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:-mx-0 sm:rounded-lg"
        >
          <div className="flex items-start gap-3">
            <Loader2
              className="mt-0.5 size-9 shrink-0 animate-spin text-primary"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-sm font-medium leading-tight">
                  Сценарий диагностики
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {runProgress}%
                </span>
              </div>
              <Progress value={runProgress} className="h-2.5" />
              <p className="text-xs leading-snug text-muted-foreground">
                {phase ?? "…"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Ошибка</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-base font-medium">
              <Gauge className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                Throughput (HTTPS ↓)
              </span>
              <InfoTip label="Как считается downlink" className="size-6">
                <p>
                  Три фазы GET по HTTPS к CDN: короткий warm-up, один крупный
                  объект, затем {PARALLEL_CHUNKS} параллельных запросов — оценка
                  взаимодействия TCP, TLS и HTTP с «толстыми» ответами.
                </p>
                <p>
                  Мбит/с — по фактическому{" "}
                  <span className="font-medium text-foreground">
                    arrayBuffer
                  </span>{" "}
                  и времени; это не synthetic speedtest, а реальный браузерный
                  путь до CDN.
                </p>
                {multipathHint ? (
                  <p className="border-t border-border pt-2 font-medium text-foreground">
                    Сейчас: {multipathHint}
                  </p>
                ) : null}
              </InfoTip>
            </CardTitle>
            <CardDescription>
              jsDelivr, CORS; warm-up, single stream, {PARALLEL_CHUNKS}× parallel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 tabular-nums">
              <dt className="text-muted-foreground">Один поток (крупный объект)</dt>
              <dd className="text-right font-semibold">
                {!hasRun && !running
                  ? "—"
                  : running && downMainMbps === null
                    ? "…"
                    : downMainMbps != null
                      ? formatMbps(downMainMbps)
                      : "н/д"}
              </dd>
              <dt className="text-muted-foreground">Параллельные GET</dt>
              <dd className="text-right font-medium">
                {!hasRun && !running
                  ? "—"
                  : running && downParallelMbps === null
                    ? "…"
                    : downParallelMbps != null
                      ? formatMbps(downParallelMbps)
                      : "н/д"}
              </dd>
              <dt className="text-muted-foreground">Warm-up (малый ответ)</dt>
              <dd className="text-right text-muted-foreground">
                {!hasRun && !running
                  ? "—"
                  : downWarmMbps != null
                    ? formatMbps(downWarmMbps)
                    : running
                      ? "…"
                      : "н/д"}
              </dd>
            </dl>
            <div className="min-h-[2.75rem] text-xs leading-snug text-muted-foreground">
              {multipathHint ?? "\u00A0"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-base font-medium">
              <Network className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                Потери на уровне HTTP
              </span>
              <InfoTip label="Методика «потерь»" className="size-6">
                <p>
                  Доля HTTP(S)-запросов, завершившихся без успеха для страницы:
                  таймаут <span className="font-medium text-foreground">fetch</span>
                  , сетевой обрыв, либо (в режиме CORS) код ответа 4xx/5xx.
                </p>
                <p>
                  Часть проб — <span className="font-medium text-foreground">
                    no-cors
                  </span>{" "}
                  (opaque): статус недоступен JS, но ошибка транспорта по-прежнему
                  учитывается как неуспех.
                </p>
                <p>
                  Сцена 1: {SEQ_PINGS} последовательных запросов. Сцена 2:
                  burst из {BURST_PARALLEL} (тоже последовательно) — чтобы
                  увидеть, как меняется результат при серии запросов к разным
                  точкам.
                </p>
                <p>
                  Не путать с ICMP или чистой потерей пакетов L3 — только прикладной
                  HTTP в вашей среде.
                </p>
              </InfoTip>
            </CardTitle>
            <CardDescription>
              Серия {SEQ_PINGS} · burst {BURST_PARALLEL} (последовательно)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {seqSamples.length
                ? `${seqSummary.lossPercent.toFixed(1)} %`
                : running
                  ? "…"
                  : "—"}
            </p>
            <p className="min-h-[2.5rem] text-xs leading-snug text-muted-foreground">
              <span className="tabular-nums">
                Успешных:{" "}
                {seqSamples.length
                  ? `${seqSamples.length - seqSummary.failed} из ${seqSamples.length}`
                  : running
                    ? "…"
                    : "—"}
              </span>
              {burstSamples.length > 0 ? (
                <>
                  {" "}
                  · burst: потери {burstSummary.lossPercent.toFixed(1)}% (
                  {burstSamples.length - burstSummary.failed} /{" "}
                  {burstSamples.length})
                </>
              ) : running && seqSamples.length === SEQ_PINGS ? (
                <> · burst: …</>
              ) : (
                <span className="invisible"> · burst: …</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-base font-medium">
              <Activity className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                Стабильность RTT
              </span>
              <InfoTip label="Формула стабильности" className="size-6">
                <p>
                  Нормированный балл 0–100 по успешности серии, джиттеру между
                  соседними RTT, коэффициенту вариации и «хвосту» p95 относительно
                  p50.
                </p>
                <p>
                  При наличии меток Resource Timing усредняется TTFB — время до
                  первого байта ответа по сравнению с началом fetch.
                </p>
              </InfoTip>
            </CardTitle>
            <CardDescription>
              Плавность RTT и характер «хвоста» распределения
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex min-h-[2.25rem] flex-nowrap items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {seqSamples.length
                  ? `${seqSummary.stabilityScore}`
                  : running
                    ? "…"
                    : "—"}
              </span>
              <span className="inline-flex min-h-6 items-center">
                {seqSamples.length ? (
                  <Badge variant={stabilityVariant}>{stabilityText}</Badge>
                ) : running ? (
                  <Badge
                    variant="secondary"
                    className="pointer-events-none invisible"
                    aria-hidden
                  >
                    отлично
                  </Badge>
                ) : null}
              </span>
            </div>
            <Progress
              value={seqSamples.length ? seqSummary.stabilityScore : 0}
            />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <dt>p50 / p95 RTT</dt>
              <dd className="text-right tabular-nums text-foreground">
                {seqSamples.length
                  ? `${seqSummary.dist.p50.toFixed(0)} / ${seqSummary.dist.p95.toFixed(0)} мс`
                  : "—"}
              </dd>
              <dt>Джиттер (соседние RTT)</dt>
              <dd className="text-right tabular-nums text-foreground">
                {seqSamples.length
                  ? `${seqSummary.jitterMs.toFixed(1)} мс`
                  : "—"}
              </dd>
              <dt className="flex items-center justify-start gap-0.5">
                <span>Средний TTFB</span>
                <InfoTip label="TTFB в этой таблице" className="size-5">
                  <p>
                    Среднее{" "}
                    <span className="font-medium text-foreground">responseStart − fetchStart</span>{" "}
                    по Resource Timing для успешных проб, где браузер заполнил
                    эти поля.
                  </p>
                </InfoTip>
              </dt>
              <dd className="text-right tabular-nums text-foreground">
                {seqSamples.length && ttfbCount > 0
                  ? `${seqSummary.meanTtfbMs.toFixed(0)} мс`
                  : seqSamples.length
                    ? "н/д"
                    : "—"}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <DeviceInfoPanel />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1 text-base font-medium">
            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 text-sm leading-tight sm:text-base">
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
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Регион</th>
                <th className="py-2 pr-2 font-medium">Сервис</th>
                <th className="py-2 pr-2 font-medium">Адрес</th>
                <th className="py-2 pr-2 font-medium">Статус</th>
                <th className="py-2 font-medium">Время (мс)</th>
              </tr>
            </thead>
            <tbody>
              {reachability.length ? (
                <>
                  <tr className="border-b border-border/80 bg-muted/40">
                    <td
                      colSpan={5}
                      className="py-2 pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Россия{" "}
                      <span className="font-medium normal-case text-foreground">
                        ({reachabilityByRegion.ru.ok}/{reachabilityByRegion.ru.total})
                      </span>
                    </td>
                  </tr>
                  {reachabilityRussia.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 align-top">{row.region}</td>
                      <td className="py-2 pr-2 align-top">{row.label}</td>
                      <td className="max-w-[140px] truncate py-2 pr-2 align-top font-mono text-xs">
                        {row.host}
                      </td>
                      <td className="py-2 pr-2 align-top">
                        {row.ok ? (
                          <Badge variant="success">Да</Badge>
                        ) : (
                          <Badge variant="destructive">Нет</Badge>
                        )}
                      </td>
                      <td className="py-2 align-top tabular-nums">
                        {row.ok && row.ms != null
                          ? `${row.ms.toFixed(0)} мс`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {running &&
                  reachabilityRussia.length < reachabilityTargetTotals.ruTotal ? (
                    <TableSkeletonRows
                      rows={reachabilityTargetTotals.ruTotal - reachabilityRussia.length}
                      cols={5}
                    />
                  ) : null}
                  <tr aria-hidden="true">
                    <td colSpan={5} className="border-t border-border py-2.5">
                      <div className="flex items-center gap-3 text-muted-foreground/70">
                        <span className="h-px min-w-[1rem] flex-1 bg-border" />
                        <span className="shrink-0 select-none font-mono text-xs font-medium">
                          ---
                        </span>
                        <span className="h-px min-w-[1rem] flex-1 bg-border" />
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-border/80 bg-muted/40">
                    <td
                      colSpan={5}
                      className="py-2 pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Зарубежные сайты{" "}
                      <span className="font-medium normal-case text-foreground">
                        ({reachabilityByRegion.abroad.ok}/{reachabilityByRegion.abroad.total})
                      </span>
                    </td>
                  </tr>
                  {reachabilityAbroad.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 align-top">{row.region}</td>
                      <td className="py-2 pr-2 align-top">{row.label}</td>
                      <td className="max-w-[140px] truncate py-2 pr-2 align-top font-mono text-xs">
                        {row.host}
                      </td>
                      <td className="py-2 pr-2 align-top">
                        {row.ok ? (
                          <Badge variant="success">Да</Badge>
                        ) : (
                          <Badge variant="destructive">Нет</Badge>
                        )}
                      </td>
                      <td className="py-2 align-top tabular-nums">
                        {row.ok && row.ms != null
                          ? `${row.ms.toFixed(0)} мс`
                          : "—"}
                      </td>
                    </tr>
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
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Нет данных — запустите сценарий
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1 text-base font-medium">
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
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Категория</th>
                <th className="py-2 pr-2 font-medium">Сервис</th>
                <th className="py-2 pr-2 font-medium">Адрес</th>
                <th className="py-2 pr-2 font-medium">Статус</th>
                <th className="py-2 font-medium">Время (мс)</th>
              </tr>
            </thead>
            <tbody>
              {whitelistReachability.length ? (
                <>
                  {whitelistReachability.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 align-top">{row.region}</td>
                      <td className="py-2 pr-2 align-top">{row.label}</td>
                      <td className="max-w-[140px] truncate py-2 pr-2 align-top font-mono text-xs">
                        {row.host}
                      </td>
                      <td className="py-2 pr-2 align-top">
                        {row.ok ? (
                          <Badge variant="success">Да</Badge>
                        ) : (
                          <Badge variant="destructive">Нет</Badge>
                        )}
                      </td>
                      <td className="py-2 align-top tabular-nums">
                        {row.ok && row.ms != null
                          ? `${row.ms.toFixed(0)} мс`
                          : "—"}
                      </td>
                    </tr>
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
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Нет данных — запустите сценарий
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
    </TooltipProvider>
  );
}
