import { readNavigatorConnection, type BrowserNetInfo } from "@/lib/connection-measure";
import { cacheBustUrl } from "@/lib/external-measure-targets";

export type SysadminDiagnostics = {
  clockSkewMs: number | null;
  clockSkewHuman: string;
  reportedIpv4: string | null;
  reportedIpv6: string | null;
  ipSource: string | null;
  secureContext: boolean;
  serviceWorkerControlling: boolean;
  visibilityState: string;
  navigatorNet: BrowserNetInfo | null;
  dohCloudflare: {
    ok: boolean;
    latencyMs: number | null;
    httpStatus: number | null;
    error: string | null;
  };
  dohGoogle: {
    ok: boolean;
    latencyMs: number | null;
    httpStatus: number | null;
    error: string | null;
  };
  nextHop: { label: string; url: string; protocol: string | null }[];
  ice: {
    hostIps: string[];
    srflxIps: string[];
    relayIps: string[];
    error: string | null;
    note: string;
  };
  egressMatchesHeaderIpv4: boolean | null;
};

function nextHopAfterFetch(fetchUrl: string): string | null {
  if (typeof performance === "undefined") return null;
  const target = (() => {
    try {
      const u = new URL(fetchUrl);
      u.search = "";
      return u.href;
    } catch {
      return fetchUrl.split("?")[0] ?? fetchUrl;
    }
  })();
  const entries = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[];
  const match = [...entries].reverse().find((e) => {
    try {
      const n = new URL(e.name);
      n.search = "";
      return n.href === target || e.name.startsWith(target);
    } catch {
      return e.name.includes(target);
    }
  });
  const p = match?.nextHopProtocol;
  return p && p !== "" ? p : null;
}

async function probeNextHop(
  label: string,
  url: string,
  init: RequestInit & { mode?: RequestInit["mode"] }
): Promise<{ label: string; url: string; protocol: string | null }> {
  const busted = cacheBustUrl(url, `nh${Date.now()}-${label}`);
  try {
    const res = await fetch(busted, {
      cache: "no-store",
      ...init,
    });
    if (init.mode !== "no-cors" && !res.ok) {
      return { label, url, protocol: nextHopAfterFetch(busted) };
    }
    if (init.mode === "no-cors") {
      try {
        await res.arrayBuffer();
      } catch {
        /* opaque */
      }
    } else {
      await res.arrayBuffer().catch(() => undefined);
    }
    return { label, url, protocol: nextHopAfterFetch(busted) };
  } catch {
    return { label, url, protocol: null };
  }
}

async function probeDoh(
  url: string,
  headers: Record<string, string>
): Promise<{
  ok: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  error: string | null;
}> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, {
      cache: "no-store",
      mode: "cors",
      headers,
    });
    const latencyMs = Math.round(performance.now() - t0);
    if (!r.ok) {
      return {
        ok: false,
        latencyMs,
        httpStatus: r.status,
        error: `HTTP ${r.status}`,
      };
    }
    return { ok: true, latencyMs, httpStatus: r.status, error: null };
  } catch (e) {
    return {
      ok: false,
      latencyMs: null,
      httpStatus: null,
      error: e instanceof Error ? e.message : "ошибка запроса",
    };
  }
}

function parseIceTypAndIp(candidate: string): {
  typ: string;
  ip: string;
} | null {
  const parts = candidate.trim().split(/\s+/);
  const ti = parts.indexOf("typ");
  if (ti < 5 || ti + 1 >= parts.length) return null;
  const typ = parts[ti + 1];
  if (typ !== "host" && typ !== "srflx" && typ !== "relay") return null;
  const ip = parts[4];
  if (!ip || ip === "0.0.0.0") return null;
  return { typ, ip };
}

export async function gatherIceSummary(
  timeoutMs = 4500
): Promise<{
  hostIps: string[];
  srflxIps: string[];
  relayIps: string[];
  error: string | null;
}> {
  const host = new Set<string>();
  const srflx = new Set<string>();
  const relay = new Set<string>();

  if (typeof RTCPeerConnection === "undefined") {
    return {
      hostIps: [],
      srflxIps: [],
      relayIps: [],
      error: "WebRTC (RTCPeerConnection) недоступен в этом контексте",
    };
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  try {
    pc.createDataChannel("probe");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  } catch (e) {
    pc.close();
    return {
      hostIps: [],
      srflxIps: [],
      relayIps: [],
      error: e instanceof Error ? e.message : "ошибка WebRTC",
    };
  }

  pc.onicecandidate = (ev) => {
    const c = ev.candidate?.candidate;
    if (!c) return;
    const parsed = parseIceTypAndIp(c);
    if (!parsed) return;
    if (parsed.typ === "host") host.add(parsed.ip);
    else if (parsed.typ === "srflx") srflx.add(parsed.ip);
    else if (parsed.typ === "relay") relay.add(parsed.ip);
  };

  await new Promise<void>((resolve) => {
    const t = window.setTimeout(() => resolve(), timeoutMs);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(t);
        resolve();
      }
    });
  });

  pc.close();

  return {
    hostIps: [...host].sort(),
    srflxIps: [...srflx].sort(),
    relayIps: [...relay].sort(),
    error: null,
  };
}

function formatSkew(ms: number): string {
  const s = ms / 1000;
  if (Math.abs(s) < 2) return "практически нет (менее ±2 с)";
  const dir = ms > 0 ? "вперёд" : "назад";
  return `часы клиента ~${Math.abs(s).toFixed(1)} с ${dir} относительно сервера приложения`;
}

export async function runSysadminDiagnostics(): Promise<SysadminDiagnostics> {
  const clientBefore = Date.now();
  let reportedIpv4: string | null = null;
  let reportedIpv6: string | null = null;
  let ipSource: string | null = null;
  let serverTimeMs: number | null = null;
  try {
    const r = await fetch("/api/client-info", { cache: "no-store" });
    const tMid = Date.now();
    void tMid;
    if (r.ok) {
      const j = (await r.json()) as {
        ipv4?: string | null;
        ipv6?: string | null;
        source?: string;
        serverTimeMs?: number;
      };
      reportedIpv4 = j.ipv4 ?? null;
      reportedIpv6 = j.ipv6 ?? null;
      ipSource = j.source ?? null;
      serverTimeMs =
        typeof j.serverTimeMs === "number" ? j.serverTimeMs : null;
    }
  } catch {
    void 0;
  }
  const clientAfter = Date.now();

  let clockSkewMs: number | null = null;
  let clockSkewHuman = "н/д (не удалось сравнить с сервером)";
  if (serverTimeMs != null) {
    const mid = (clientBefore + clientAfter) / 2;
    clockSkewMs = Math.round(serverTimeMs - mid);
    clockSkewHuman = formatSkew(clockSkewMs);
  }

  const secureContext =
    typeof window !== "undefined" && window.isSecureContext === true;

  const serviceWorkerControlling =
    typeof navigator !== "undefined" &&
    !!navigator.serviceWorker?.controller;

  const visibilityState =
    typeof document !== "undefined" ? document.visibilityState : "—";

  const navigatorNet = readNavigatorConnection();

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";

  const [dohCloudflare, dohGoogle, nextHopLocal, nextHopCdn, nextHopExt, ice] =
    await Promise.all([
      probeDoh("https://cloudflare-dns.com/dns-query?name=example.com&type=A", {
        accept: "application/dns-json",
      }),
      probeDoh("https://dns.google/resolve?name=example.com&type=1", {
        accept: "application/json",
      }),
      probeNextHop("Это приложение (same-origin)", `${origin}/api/ping`, {
        mode: "cors",
      }),
      probeNextHop("jsDelivr (CDN, CORS)", "https://cdn.jsdelivr.net/npm/react@18.3.1/package.json", {
        mode: "cors",
      }),
      probeNextHop("Cloudflare (opaque)", "https://www.cloudflare.com/favicon.ico", {
        mode: "no-cors",
      }),
      gatherIceSummary(4500),
    ]);

  const nextHop = [nextHopLocal, nextHopCdn, nextHopExt];

  let egressMatchesHeaderIpv4: boolean | null = null;
  if (reportedIpv4 && ice.srflxIps.length > 0) {
    egressMatchesHeaderIpv4 = ice.srflxIps.includes(reportedIpv4);
  }

  const iceNote =
    "STUN-кандидаты: host — локальные интерфейсы, srflx — публичный адрес «как видит» STUN-сервер (сравните с IPv4 из заголовка прокси). Раскрывает IP; используйте только для диагностики.";

  return {
    clockSkewMs,
    clockSkewHuman,
    reportedIpv4,
    reportedIpv6,
    ipSource,
    secureContext,
    serviceWorkerControlling,
    visibilityState,
    navigatorNet,
    dohCloudflare,
    dohGoogle,
    nextHop,
    ice: {
      hostIps: ice.hostIps,
      srflxIps: ice.srflxIps,
      relayIps: ice.relayIps,
      error: ice.error,
      note: iceNote,
    },
    egressMatchesHeaderIpv4,
  };
}
