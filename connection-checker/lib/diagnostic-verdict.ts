import { summarizePings } from "@/lib/metrics";

type PingSummary = ReturnType<typeof summarizePings>;

export type DiagnosticVerdictLevel = "good" | "degraded" | "critical";

export type DiagnosticVerdict = {
  level: DiagnosticVerdictLevel;
  title: string;
  body: string;
};

export type DiagnosticVerdictInput = {
  error: string | null;
  hasRun: boolean;
  seqSummary: PingSummary;
  reachabilityRu: { ok: number; total: number };
  reachabilityAbroad: { ok: number; total: number };
  whitelist: { ok: number; total: number };
};

/** Человекочитаемая сводка по последнему завершённому прогону. */
export function buildDiagnosticVerdict(
  input: DiagnosticVerdictInput
): DiagnosticVerdict | null {
  if (!input.hasRun) return null;

  const {
    error,
    seqSummary,
    reachabilityRu,
    reachabilityAbroad,
    whitelist,
  } = input;

  const denomReach = reachabilityRu.total + reachabilityAbroad.total;
  const reachPct =
    denomReach > 0
      ? Math.round(
          ((reachabilityRu.ok + reachabilityAbroad.ok) / denomReach) * 100
        )
      : null;

  const wlPct =
    whitelist.total > 0
      ? Math.round((whitelist.ok / whitelist.total) * 100)
      : null;

  const allSeqFailed =
    seqSummary.total > 0 && seqSummary.failed === seqSummary.total;

  let level: DiagnosticVerdictLevel = "good";
  if (error || allSeqFailed) {
    level = "critical";
  } else if (
    seqSummary.lossPercent >= 10 ||
    seqSummary.stabilityScore < 45 ||
    (reachPct != null && reachPct < 70) ||
    (wlPct != null && wlPct < 70)
  ) {
    level = "critical";
  } else if (
    seqSummary.lossPercent >= 5 ||
    seqSummary.stabilityScore < 65 ||
    (reachPct != null && reachPct < 90) ||
    (wlPct != null && wlPct < 90)
  ) {
    level = "degraded";
  }

  const rttLine =
    seqSummary.total > 0
      ? `Задержки (HTTP RTT): потери ${seqSummary.lossPercent.toFixed(1)}%, стабильность ${seqSummary.stabilityScore}/100, p50/p95 ${seqSummary.dist.p50.toFixed(0)}/${seqSummary.dist.p95.toFixed(0)} мс.`
      : "Задержки: данных нет.";

  const reachLine =
    denomReach > 0
      ? `Доступность выборки сайтов: Россия ${reachabilityRu.ok}/${reachabilityRu.total}, зарубежные ${reachabilityAbroad.ok}/${reachabilityAbroad.total}${reachPct != null ? ` (${reachPct}% доступны)` : ""}.`
      : "Доступность сайтов: ещё не измерялась.";

  const wlLine =
    whitelist.total > 0
      ? `Белый список (Минцифры): ${whitelist.ok}/${whitelist.total}${wlPct != null ? ` (${wlPct}%)` : ""}.`
      : "";

  let title: string;
  if (level === "critical") {
    title = error
      ? "Обнаружены серьёзные проблемы с соединением"
      : "Качество соединения или доступность сервисов критически низкие";
  } else if (level === "degraded") {
    title = "Соединение работает, но есть заметные ограничения";
  } else {
    title = "Соединение стабильное, доступность сайтов в норме";
  }

  const body = [
    rttLine,
    reachLine,
    wlLine,
    error ? `Ошибка сценария: ${error}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { level, title, body };
}
