export type DeviceInfoReport = {
  ipv4: string | null;
  ipv6: string | null;
  /** `proxy` | `local` | `loopback` — см. `/api/client-info` */
  ipSource: string | null;
  dateLocal: string;
  timeLocal: string;
  timezone: string;
  utcOffsetLabel: string;
  languages: string;
  userAgent: string;
  platform: string;
  vendor: string;
  cookieEnabled: boolean;
  onLine: boolean;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  screenPixels: string;
  screenAvail: string;
  viewportCss: string;
  visualViewport: string | null;
  devicePixelRatio: number;
  colorDepth: number;
  maxTouchPoints: number;
  pointerCoarse: boolean;
  prefersReducedMotion: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDb: boolean;
  webp: boolean;
  webglVendor: string | null;
  webglRenderer: string | null;
  userAgentBrands: string | null;
  userAgentMobile: boolean | null;
  userAgentPlatform: string | null;
};

function formatUtcOffsetLabel(): string {
  const offMin = -new Date().getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "−";
  const abs = Math.abs(offMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC ${sign}${hh}:${mm}`;
}

function testWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function readWebGl(): { vendor: string | null; renderer: string | null } {
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl") ??
      (c.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) {
      return { vendor: null, renderer: null };
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return { vendor: null, renderer: null };
    return {
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? null,
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? null,
    };
  } catch {
    return { vendor: null, renderer: null };
  }
}

async function readUserAgentData(): Promise<{
  brands: string | null;
  mobile: boolean | null;
  platform: string | null;
}> {
  const ud = (
    navigator as Navigator & {
      userAgentData?: {
        brands?: { brand: string; version: string }[];
        mobile?: boolean;
        platform?: string;
        getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
      };
    }
  ).userAgentData;
  if (!ud) return { brands: null, mobile: null, platform: null };
  try {
    const hi = await ud.getHighEntropyValues?.([
      "fullVersionList",
      "platformVersion",
      "architecture",
    ]);
    const list =
      (hi?.fullVersionList as { brand: string; version: string }[] | undefined) ??
      ud.brands;
    const brands =
      list?.map((b) => `${b.brand} ${b.version}`).join(", ") ?? null;
    return {
      brands,
      mobile: ud.mobile ?? null,
      platform: ud.platform ?? null,
    };
  } catch {
    const brands =
      ud.brands?.map((b) => `${b.brand} ${b.version}`).join(", ") ?? null;
    return {
      brands,
      mobile: ud.mobile ?? null,
      platform: ud.platform ?? null,
    };
  }
}

export function formatIpv4ForDisplay(d: DeviceInfoReport): string {
  if (d.ipv4) return d.ipv4;
  switch (d.ipSource) {
    case "local":
      return "не передан (нет X-Forwarded-For / X-Real-IP — обычно при локальном next dev)";
    case "loopback":
      return "не определён (в заголовке только localhost — не адрес выхода в сеть)";
    case "proxy":
      return "не определён (IPv4 в ответе нет)";
    default:
      return "—";
  }
}

export function formatIpv6ForDisplay(d: DeviceInfoReport): string {
  if (d.ipv6) return d.ipv6;
  switch (d.ipSource) {
    case "local":
      return "не передан (нет заголовков прокси — обычно при локальном next dev)";
    case "loopback":
      return "не определён (в заголовке только localhost — ::1 не показываем)";
    case "proxy":
      return "не определён (IPv6 в ответе нет)";
    default:
      return "—";
  }
}

export async function buildDeviceInfoReport(): Promise<DeviceInfoReport> {
  const now = new Date();
  const dateLocal = now.toLocaleDateString("ru-RU", { dateStyle: "long" });
  const timeLocal = now.toLocaleTimeString("ru-RU", { timeStyle: "medium" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "—";

  let ipv4: string | null = null;
  let ipv6: string | null = null;
  let ipSource: string | null = null;
  try {
    const r = await fetch("/api/client-info", { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as {
        ipv4?: string | null;
        ipv6?: string | null;
        source?: string;
      };
      ipv4 = j.ipv4 ?? null;
      ipv6 = j.ipv6 ?? null;
      ipSource = j.source ?? null;
    }
  } catch {
    void 0;
  }

  const { brands, mobile, platform: uaPlatform } = await readUserAgentData();
  const webgl = readWebGl();

  const dm = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  const vv = window.visualViewport;

  return {
    ipv4,
    ipv6,
    ipSource,
    dateLocal,
    timeLocal,
    timezone: tz,
    utcOffsetLabel: formatUtcOffsetLabel(),
    languages: navigator.languages?.length
      ? navigator.languages.join(", ")
      : navigator.language ?? "—",
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? "—",
    vendor: navigator.vendor ?? "—",
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency:
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : null,
    deviceMemoryGb: typeof dm === "number" ? dm : null,
    screenPixels: `${screen.width}×${screen.height}`,
    screenAvail: `${screen.availWidth}×${screen.availHeight}`,
    viewportCss: `${window.innerWidth}×${window.innerHeight}`,
    visualViewport: vv
      ? `${Math.round(vv.width)}×${Math.round(vv.height)} (offset ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)})`
      : null,
    devicePixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    pointerCoarse: window.matchMedia("(pointer: coarse)").matches,
    prefersReducedMotion: window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches,
    localStorage: (() => {
      try {
        return !!window.localStorage;
      } catch {
        return false;
      }
    })(),
    sessionStorage: (() => {
      try {
        return !!window.sessionStorage;
      } catch {
        return false;
      }
    })(),
    indexedDb: !!window.indexedDB,
    webp: testWebp(),
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    userAgentBrands: brands,
    userAgentMobile: mobile,
    userAgentPlatform: uaPlatform,
  };
}

export function deviceInfoToPlainText(d: DeviceInfoReport): string {
  const lines: string[] = [
    `Дата: ${d.dateLocal}`,
    `Время: ${d.timeLocal}`,
    `Часовой пояс: ${d.timezone} (${d.utcOffsetLabel})`,
    `IPv4-адрес: ${formatIpv4ForDisplay(d)}`,
    `IPv6-адрес: ${formatIpv6ForDisplay(d)}`,
    `Источник IP (сервер): ${d.ipSource ?? "—"}`,
    `Языки: ${d.languages}`,
    `Платформа (navigator.platform): ${d.platform}`,
    `User-Agent: ${d.userAgent}`,
    `Браузер (Client Hints): ${d.userAgentBrands ?? "—"}`,
    `Мобильный клиент (Hints): ${d.userAgentMobile == null ? "—" : d.userAgentMobile ? "да" : "нет"}`,
    `Платформа (Hints): ${d.userAgentPlatform ?? "—"}`,
    `Разрешение экрана: ${d.screenPixels} px`,
    `Доступная область: ${d.screenAvail} px`,
    `Окно (inner): ${d.viewportCss} px`,
    ...(d.visualViewport
      ? [`Visual Viewport: ${d.visualViewport}` as const]
      : []),
    `devicePixelRatio: ${d.devicePixelRatio}`,
    `Глубина цвета: ${d.colorDepth}`,
    `Сеть (onLine): ${d.onLine ? "да" : "нет"}`,
    `Cookie включены: ${d.cookieEnabled ? "да" : "нет"}`,
    `localStorage: ${d.localStorage ? "да" : "нет"}`,
    `sessionStorage: ${d.sessionStorage ? "да" : "нет"}`,
    `IndexedDB: ${d.indexedDb ? "да" : "нет"}`,
    `WebP: ${d.webp ? "да" : "нет"}`,
    `Ядра (hardwareConcurrency): ${d.hardwareConcurrency ?? "—"}`,
    `ОЗУ (deviceMemory, ГБ): ${d.deviceMemoryGb ?? "—"}`,
    `Касания (maxTouchPoints): ${d.maxTouchPoints}`,
    `Грубый указатель: ${d.pointerCoarse ? "да" : "нет"}`,
    `Reduced motion: ${d.prefersReducedMotion ? "да" : "нет"}`,
    `WebGL vendor: ${d.webglVendor ?? "—"}`,
    `WebGL renderer: ${d.webglRenderer ?? "—"}`,
  ];
  return lines.filter(Boolean).join("\n");
}
