/** Короткая подпись «N мин. назад» для метки обновления. */
export function formatRelativeTimeShortRu(sinceMs: number): string {
  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  const diffSec = Math.round((sinceMs - Date.now()) / 1000);
  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, "hour");
  }
  const diffDay = Math.round(diffHour / 24);
  return rtf.format(diffDay, "day");
}
