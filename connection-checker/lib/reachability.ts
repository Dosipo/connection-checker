import type { ReachabilityTarget } from "@/lib/reachability-targets";

export type ReachabilityResult = {
  id: string;
  label: string;
  region: string;
  host: string;
  url: string;
  mode: "cors" | "opaque";
  ok: boolean;
  ms: number | null;
};

const DEFAULT_TIMEOUT_MS = 18_000;

export async function probeReachability(
  target: ReachabilityTarget,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ReachabilityResult> {
  const base: Omit<ReachabilityResult, "ok" | "ms"> = {
    id: target.id,
    label: target.label,
    region: target.region,
    host: target.host,
    url: target.url,
    mode: target.mode,
  };

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = performance.now();

  try {
    if (target.mode === "cors") {
      const res = await fetch(target.url, {
        mode: "cors",
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const ms = performance.now() - t0;
      if (!res.ok) {
        return { ...base, ok: false, ms: null };
      }
      await res.arrayBuffer();
      return { ...base, ok: true, ms };
    }

    await fetch(target.url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ms = performance.now() - t0;
    return { ...base, ok: true, ms };
  } catch {
    clearTimeout(timer);
    return { ...base, ok: false, ms: null };
  }
}

export async function probeAllReachability(
  targets: ReachabilityTarget[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ReachabilityResult[]> {
  return Promise.all(targets.map((t) => probeReachability(t, timeoutMs)));
}

/** Последовательный прогон, чтобы результаты появлялись по одному. */
export async function probeAllReachabilitySequential(
  targets: ReachabilityTarget[],
  opts?: {
    timeoutMs?: number;
    onItem?: (row: ReachabilityResult, idx: number, total: number) => void;
  }
): Promise<ReachabilityResult[]> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const out: ReachabilityResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const row = await probeReachability(targets[i], timeoutMs);
    out.push(row);
    opts?.onItem?.(row, i, targets.length);
  }
  return out;
}
