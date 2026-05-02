"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  MonitorSmartphone,
} from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildDeviceInfoReport,
  deviceInfoToPlainText,
  formatIpv4ForDisplay,
  formatIpv6ForDisplay,
  type DeviceInfoReport,
} from "@/lib/device-info";

function isMissingValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v === "—" ||
    v === "-" ||
    v === "н/д" ||
    v === "n/a" ||
    v.startsWith("не ") ||
    v.startsWith("нет ") ||
    v.includes("не определ")
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const missing = isMissingValue(value);
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 text-sm sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          missing
            ? "min-w-0 break-words text-muted-foreground"
            : "min-w-0 break-words font-medium text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function DeviceInfoPanel() {
  const [data, setData] = useState<DeviceInfoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const report = await buildDeviceInfoReport();
      setData(report);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось собрать сведения об устройстве"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyAll = useCallback(async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(deviceInfoToPlainText(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Не удалось скопировать — разрешите доступ к буферу обмена");
    }
  }, [data]);

  const browserLine =
    data?.userAgentBrands ??
    (data?.userAgent ? data.userAgent.slice(0, 160) + (data.userAgent.length > 160 ? "…" : "") : "—");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <MonitorSmartphone
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              Клиент: устройство и HTTP-контекст
            </CardTitle>
            <CardDescription className="max-w-prose">
              Сведения о браузере и устройстве (User-Agent, экран, IP по версии
              сервера). Не публикуйте без необходимости.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!data || loading}
              onClick={() => void copyAll()}
            >
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? "Скопировано" : "Скопировать всё"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => void load()}
            >
              Обновить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading && !data ? (
          <div className="space-y-0" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2 pb-3 text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              <span className="text-xs sm:text-sm">
                Запрос /api/client-info и сбор полей…
              </span>
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid gap-2 border-b border-border/50 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-full max-w-lg" />
              </div>
            ))}
          </div>
        ) : null}
        {err ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle className="text-sm">Не удалось загрузить сведения</AlertTitle>
            <AlertDescription className="text-destructive/90 text-sm">
              {err}
            </AlertDescription>
          </Alert>
        ) : null}
        {data ? (
          <>
            <dl>
              <InfoRow label="Адрес IPv4" value={formatIpv4ForDisplay(data)} />
              <InfoRow label="Адрес IPv6" value={formatIpv6ForDisplay(data)} />
              <InfoRow
                label="Браузер"
                value={browserLine}
              />
              <InfoRow label="Экран (точки)" value={`${data.screenPixels} px`} />
              <InfoRow label="Окно сайта в браузере" value={`${data.viewportCss} px`} />
              <InfoRow
                label="Часовой пояс"
                value={`${data.timezone} (${data.utcOffsetLabel})`}
              />
            </dl>
            <details className="rounded-lg border bg-muted/20 px-4 py-3">
              <summary className="cursor-pointer select-none text-sm font-medium">
                Дополнительная информация
              </summary>
              <p className="mb-3 mt-2 text-xs text-muted-foreground">
                Те же риски утечки об отпечатке клиента; часть полей — сырой
                API браузера.
              </p>
              <dl className="border-t border-border/50 pt-2">
                <InfoRow label="Дата у вас на устройстве" value={data.dateLocal} />
                <InfoRow label="Время у вас на устройстве" value={data.timeLocal} />
                <InfoRow label="Языки в браузере" value={data.languages} />
                <InfoRow label="Система (по браузеру)" value={data.platform} />
                <InfoRow label="Разработчик браузера" value={data.vendor} />
                <InfoRow
                  label="Платформа (по данным браузера)"
                  value={data.userAgentPlatform ?? "—"}
                />
                <InfoRow
                  label="Мобильное устройство (по браузеру)"
                  value={
                    data.userAgentMobile == null
                      ? "—"
                      : data.userAgentMobile
                        ? "да"
                        : "нет"
                  }
                />
                <InfoRow
                  label="Экран без системных панелей"
                  value={`${data.screenAvail} px`}
                />
                <InfoRow
                  label="Видимая область (visual viewport)"
                  value={data.visualViewport ?? "—"}
                />
                <InfoRow
                  label="Плотность пикселей (devicePixelRatio)"
                  value={String(data.devicePixelRatio)}
                />
                <InfoRow label="Глубина цвета" value={`${data.colorDepth} бит`} />
                <InfoRow
                  label="Браузер считает, что сеть есть"
                  value={data.onLine ? "да" : "нет"}
                />
                <InfoRow
                  label="Файлы cookie"
                  value={data.cookieEnabled ? "разрешены" : "запрещены"}
                />
                <InfoRow label="Хранилище localStorage" value={data.localStorage ? "есть" : "нет"} />
                <InfoRow
                  label="Хранилище sessionStorage"
                  value={data.sessionStorage ? "есть" : "нет"}
                />
                <InfoRow label="База IndexedDB" value={data.indexedDb ? "есть" : "нет"} />
                <InfoRow label="Картинки WebP" value={data.webp ? "поддерживаются" : "нет"} />
                <InfoRow
                  label="Число ядер процессора (оценка)"
                  value={
                    data.hardwareConcurrency != null
                      ? String(data.hardwareConcurrency)
                      : "—"
                  }
                />
                <InfoRow
                  label="Память устройства (оценка, ГБ)"
                  value={data.deviceMemoryGb != null ? String(data.deviceMemoryGb) : "—"}
                />
                <InfoRow
                  label="Точек касания экрана"
                  value={String(data.maxTouchPoints)}
                />
                <InfoRow
                  label="Грубое касание (палец, не мышь)"
                  value={data.pointerCoarse ? "да" : "нет"}
                />
                <InfoRow
                  label="Меньше анимации (настройка доступности)"
                  value={data.prefersReducedMotion ? "включено" : "выключено"}
                />
                <InfoRow label="Видеочип (производитель)" value={data.webglVendor ?? "—"} />
                <InfoRow
                  label="Видеочип (модель)"
                  value={data.webglRenderer ?? "—"}
                />
                <InfoRow
                  label="Строка User-Agent целиком"
                  value={data.userAgent}
                />
                <InfoRow
                  label="Откуда взят IP-адрес"
                  value={data.ipSource ?? "—"}
                />
              </dl>
            </details>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
