/**
 * Публичные настройки РСЯ (встраиваются на этапе `next build` через NEXT_PUBLIC_*).
 */
export function yandexRsyContextScriptUrl(): string {
  return (
    process.env.NEXT_PUBLIC_YANDEX_RSYA_CONTEXT_URL?.trim() ||
    "https://yandex.ru/ads/system/context.js"
  );
}

export function yandexRsyScriptShouldLoad(): boolean {
  if (process.env.NEXT_PUBLIC_YANDEX_RSYA_ENABLED === "1") return true;
  const h = process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER?.trim();
  const f = process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_FOOTER?.trim();
  const c = process.env.NEXT_PUBLIC_YANDEX_RTB_BLOCK_CONTENT?.trim();
  return Boolean(h || f || c);
}
