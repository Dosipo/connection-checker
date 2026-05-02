import type { NextConfig } from "next";

/**
 * Docker / Яндекс Облако: `output: "standalone"` даёт компактный `.next/standalone`
 * с `server.js` для `next start` в контейнере.
 *
 * CSP / пост-хардненинг: если позже включите `headers` с Content-Security-Policy,
 * добавьте домены скриптов и iframe РСЯ из кабинета (например yandex.ru / an.yandex.ru)
 * в `script-src`, `frame-src`, `img-src` — иначе блоки не отрисуются.
 */
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
