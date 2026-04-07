import type { PingSample } from "@/lib/metrics";
import {
  EXTERNAL_PING_TARGETS,
  EXTERNAL_SPEED_MAIN_URL,
  EXTERNAL_SPEED_PARALLEL_URLS,
  EXTERNAL_SPEED_WARM_URL,
  cacheBustUrl,
} from "@/lib/external-measure-targets";

export const PING_TIMEOUT_MS = 12_000;

export const SEQ_PINGS = 32;
export const BURST_PARALLEL = 14;

export type BrowserNetInfo = {
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;
};

export function readNavigatorConnection(): BrowserNetInfo | null {
  if (typeof navigator === "undefined") return null;
  const c =
    (
      navigator as Navigator & {
        connection?: EventTarget & {
          effectiveType?: string;
          downlink?: number;
          rtt?: number;
          saveData?: boolean;
        };
      }
    ).connection ?? null;
  if (!c) return null;
  return {
    effectiveType: c.effectiveType,
    downlinkMbps: typeof c.downlink === "number" ? c.downlink : undefined,
    rttMs: typeof c.rtt === "number" ? c.rtt : undefined,
    saveData: c.saveData,
  };
}

function canonicalHrefNoSearch(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.href;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function ttfbFromResourceTimingForFetchUrl(fetchUrl: string): number | null {
  if (typeof performance === "undefined") return null;
  const target = canonicalHrefNoSearch(fetchUrl);
  const entries = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[];
  const match = [...entries].reverse().find((e) => {
    try {
      return canonicalHrefNoSearch(e.name) === target;
    } catch {
      return e.name.startsWith(target);
    }
  });
  if (!match || match.responseStart <= 0) return null;
  return match.responseStart - match.fetchStart;
}

async function pingExternal(
  url: string,
  mode: "cors" | "opaque"
): Promise<PingSample> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      mode: mode === "opaque" ? "no-cors" : "cors",
    });
    clearTimeout(timer);
    const ms = performance.now() - t0;
    if (mode === "cors") {
      if (!res.ok) return { ok: false, ms: null, ttfbMs: null };
      await res.arrayBuffer();
    } else {
      try {
        await res.arrayBuffer();
      } catch {
        /* opaque: не везде доступно чтение тела */
      }
    }
    const ttfbMs = ttfbFromResourceTimingForFetchUrl(url);
    return {
      ok: true,
      ms,
      ttfbMs: ttfbMs ?? undefined,
    };
  } catch {
    clearTimeout(timer);
    return { ok: false, ms: null, ttfbMs: null };
  }
}

function pickTarget(seqIndex: number) {
  return EXTERNAL_PING_TARGETS[seqIndex % EXTERNAL_PING_TARGETS.length];
}

/** Последовательный RTT к ротируемым внешним URL (CORS / no-cors). */
export async function pingOnce(seqIndex: number): Promise<PingSample> {
  const spec = pickTarget(seqIndex);
  const url = cacheBustUrl(spec.url, `${Date.now()}-${seqIndex}`);
  return pingExternal(url, spec.mode);
}

export async function pingBurstParallel(count: number): Promise<PingSample[]> {
  const salt = Date.now();
  return Promise.all(
    Array.from({ length: count }, (_, i) => {
      const spec = EXTERNAL_PING_TARGETS[(i + salt) % EXTERNAL_PING_TARGETS.length];
      const url = cacheBustUrl(spec.url, `b${salt}-${i}`);
      return pingExternal(url, spec.mode);
    })
  );
}

export async function pingBurstSequential(count: number): Promise<PingSample[]> {
  const salt = Date.now();
  const out: PingSample[] = [];
  for (let i = 0; i < count; i++) {
    const spec = EXTERNAL_PING_TARGETS[(i + salt) % EXTERNAL_PING_TARGETS.length];
    const url = cacheBustUrl(spec.url, `s${salt}-${i}`);
    out.push(await pingExternal(url, spec.mode));
  }
  return out;
}

export async function measureDownloadMbpsFromUrl(
  url: string
): Promise<number | null> {
  const busted = cacheBustUrl(url, `d${Date.now()}`);
  const t0 = performance.now();
  try {
    const res = await fetch(busted, {
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const dt = (performance.now() - t0) / 1000;
    if (dt <= 0) return null;
    return (ab.byteLength * 8) / dt;
  } catch {
    return null;
  }
}

export async function measureParallelDownloadsFromUrls(
  urls: readonly string[]
): Promise<number | null> {
  if (urls.length < 1) return null;
  const salt = Date.now();
  const t0 = performance.now();
  try {
    const tasks = urls.map((raw, i) => {
      const u = cacheBustUrl(raw, `p${salt}-${i}`);
      return fetch(u, { cache: "no-store", mode: "cors" }).then(async (r) => {
        if (!r.ok) throw new Error("fail");
        return (await r.arrayBuffer()).byteLength;
      });
    });
    const sizes = await Promise.all(tasks);
    const totalBytes = sizes.reduce((a, b) => a + b, 0);
    const dt = (performance.now() - t0) / 1000;
    if (dt <= 0) return null;
    return (totalBytes * 8) / dt;
  } catch {
    return null;
  }
}

export async function measureSequentialDownloadsFromUrls(
  urls: readonly string[]
): Promise<number | null> {
  if (urls.length < 1) return null;
  const salt = Date.now();
  const t0 = performance.now();
  try {
    let totalBytes = 0;
    for (let i = 0; i < urls.length; i++) {
      const u = cacheBustUrl(urls[i], `q${salt}-${i}`);
      const res = await fetch(u, { cache: "no-store", mode: "cors" });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      totalBytes += ab.byteLength;
    }
    const dt = (performance.now() - t0) / 1000;
    if (dt <= 0) return null;
    return (totalBytes * 8) / dt;
  } catch {
    return null;
  }
}

/** Разогрев, крупный объект и параллельная серия — всё с jsDelivr (CORS). */
export async function measureDownloadWarmMainAndParallel(): Promise<{
  warm: number | null;
  main: number | null;
  parallel: number | null;
}> {
  const warm = await measureDownloadMbpsFromUrl(EXTERNAL_SPEED_WARM_URL);
  const main = await measureDownloadMbpsFromUrl(EXTERNAL_SPEED_MAIN_URL);
  const parallel = await measureSequentialDownloadsFromUrls(
    EXTERNAL_SPEED_PARALLEL_URLS
  );
  return { warm, main, parallel };
}

export { EXTERNAL_SPEED_PARALLEL_URLS, EXTERNAL_SPEED_WARM_URL, EXTERNAL_SPEED_MAIN_URL };
