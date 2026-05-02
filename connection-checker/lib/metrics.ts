export type PingSample = {
  ok: boolean;
  ms: number | null;
  ttfbMs?: number | null;
};

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v =
    values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function percentile(sortedAsc: number[], p: number) {
  if (!sortedAsc.length) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

export function latencyDistribution(latenciesMs: number[]) {
  if (!latenciesMs.length) {
    return {
      min: 0,
      max: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      mean: 0,
      stdev: 0,
    };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    mean: mean(latenciesMs),
    stdev: stdev(latenciesMs),
  };
}

export function jitterFromLatencies(latenciesMs: number[]) {
  if (latenciesMs.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < latenciesMs.length; i++) {
    sum += Math.abs(latenciesMs[i] - latenciesMs[i - 1]);
  }
  return sum / (latenciesMs.length - 1);
}

export function summarizePings(samples: PingSample[]) {
  const total = samples.length;
  const failed = samples.filter((s) => !s.ok).length;
  const successRate = total ? (total - failed) / total : 0;
  const lossPercent = total ? (failed / total) * 100 : 0;
  const latencies = samples
    .filter((s) => s.ok && s.ms != null)
    .map((s) => s.ms as number);
  const dist = latencyDistribution(latencies);
  const jitterMs = jitterFromLatencies(latencies);
  const cv =
    latencies.length && dist.mean > 0 ? dist.stdev / dist.mean : 0;

  const jitterNorm = Math.min(jitterMs / 40, 1);
  const cvNorm = Math.min(cv / 0.35, 1);
  const p95Norm =
    dist.p95 > 0 ? Math.min((dist.p95 - dist.p50) / Math.max(dist.p50, 20), 1) : 0;

  const stabilityScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 *
          (0.42 * successRate +
            0.2 * (1 - jitterNorm) +
            0.2 * (1 - cvNorm) +
            0.18 * (1 - p95Norm))
      )
    )
  );

  return {
    total,
    failed,
    lossPercent,
    successRate,
    avgLatencyMs: dist.mean,
    jitterMs,
    cv,
    stabilityScore,
    dist,
    meanTtfbMs: mean(
      samples
        .filter((s) => s.ok && s.ttfbMs != null)
        .map((s) => s.ttfbMs as number)
    ),
  };
}

export function formatMbps(bitsPerSecond: number) {
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond < 0) return "—";
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(2)} Мбит/с`;
  }
  if (bitsPerSecond >= 1_000) {
    return `${(bitsPerSecond / 1_000).toFixed(1)} кбит/с`;
  }
  return `${Math.round(bitsPerSecond)} бит/с`;
}

export type QualityLabel = "отлично" | "хорошо" | "слабо" | "плохо";

export function stabilityLabel(score: number): QualityLabel {
  if (score >= 85) return "отлично";
  if (score >= 65) return "хорошо";
  if (score >= 45) return "слабо";
  return "плохо";
}

export function qualityLabelVariant(
  label: QualityLabel
): "success" | "secondary" | "warning" | "destructive" {
  if (label === "отлично") return "success";
  if (label === "хорошо") return "secondary";
  if (label === "слабо") return "warning";
  return "destructive";
}

/** Оценка скорости по основному HTTPS-замеру (Мбит/с). */
export function downlinkQualityLabel(mbps: number): QualityLabel {
  if (mbps >= 50) return "отлично";
  if (mbps >= 25) return "хорошо";
  if (mbps >= 10) return "слабо";
  return "плохо";
}

/**
 * Оценка потерь HTTP: учитывайте худший из долей (последовательный ряд и burst).
 */
export function httpLossQualityLabel(lossPercent: number): QualityLabel {
  if (lossPercent <= 0) return "отлично";
  if (lossPercent < 2) return "хорошо";
  if (lossPercent < 12) return "слабо";
  return "плохо";
}

/** 0–100 для полосы: чем выше скорость, тем полнее (100 Мбит/с ≈ максимум). */
export function downlinkProgressValue(mbps: number): number {
  return Math.round(Math.min(100, Math.max(0, (mbps / 100) * 100)));
}

/** 0–100: чем меньше потерь, тем полнее. */
export function httpLossProgressValue(lossPercent: number): number {
  return Math.round(Math.min(100, Math.max(0, 100 - lossPercent)));
}
