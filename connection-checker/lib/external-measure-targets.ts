/** Внешние точки для серии RTT (ротация). opaque — no-cors, факт завершения; cors — проверка ответа. */
export const EXTERNAL_PING_TARGETS = [
  {
    id: "g204",
    url: "https://www.google.com/generate_204",
    mode: "opaque" as const,
  },
  {
    id: "gh-zen",
    url: "https://api.github.com/zen",
    mode: "cors" as const,
  },
  {
    id: "cf-favicon",
    url: "https://www.cloudflare.com/favicon.ico",
    mode: "opaque" as const,
  },
  {
    id: "wiki-favicon",
    url: "https://www.wikipedia.org/static/favicon/wikipedia.ico",
    mode: "opaque" as const,
  },
  {
    id: "vk-favicon",
    url: "https://vk.com/favicon.ico",
    mode: "opaque" as const,
  },
  {
    id: "ms-favicon",
    url: "https://www.microsoft.com/favicon.ico",
    mode: "opaque" as const,
  },
] as const;

/** Прогрев: ~130 KiB (jsDelivr, CORS). */
export const EXTERNAL_SPEED_WARM_URL =
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js";

/** Основной объём: mapbox-gl (несколько МБ, CORS). */
export const EXTERNAL_SPEED_MAIN_URL =
  "https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/dist/mapbox-gl.js";

/** Четыре разных CDN-объекта для параллельного пика. */
export const EXTERNAL_SPEED_PARALLEL_URLS = [
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.min.js",
  "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js",
  "https://cdn.jsdelivr.net/npm/moment@2.30.1/moment.min.js",
] as const;

export function cacheBustUrl(raw: string, key: string): string {
  const u = new URL(raw);
  u.searchParams.set("_cb", key);
  return u.href;
}
