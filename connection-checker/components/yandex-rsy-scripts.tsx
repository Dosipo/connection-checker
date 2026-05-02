"use client";

import Script from "next/script";

import { yandexRsyContextScriptUrl, yandexRsyScriptShouldLoad } from "@/lib/yandex-rsy-public";

/** Один раз подгружает РСЯ `context.js` + инициализирует `yaContextCb` (только если заданы блоки или force-enabled). */
export function YandexRsyScripts() {
  if (!yandexRsyScriptShouldLoad()) return null;

  return (
    <>
      <Script id="yandex-rsy-yaContextCb" strategy="afterInteractive">
        {"window.yaContextCb=window.yaContextCb||[]"}
      </Script>
      <Script
        src={yandexRsyContextScriptUrl()}
        strategy="afterInteractive"
      />
    </>
  );
}
