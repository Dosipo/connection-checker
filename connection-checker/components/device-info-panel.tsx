"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, MonitorSmartphone, Loader2 } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildDeviceInfoReport,
  deviceInfoToPlainText,
  type DeviceInfoReport,
} from "@/lib/device-info";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 text-sm sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
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
              Отпечаток окружения (User-Agent, экран, IP с точки зрения сервера).
              Не публикуйте без необходимости: набор полей сужает класс
              устройств.
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
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Запрос /api/client-info и сбор полей…
          </div>
        ) : null}
        {err ? (
          <p className="text-destructive text-sm">{err}</p>
        ) : null}
        {data ? (
          <>
            <dl>
              <InfoRow label="Адрес IPv4" value={data.ipv4 ?? "—"} />
              <InfoRow label="Адрес IPv6" value={data.ipv6 ?? "—"} />
              <div className="grid gap-1 border-b border-border/60 py-2 text-sm sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
                <dt className="flex items-center gap-0.5 text-muted-foreground">
                  <span>VPN / прокси (эвристика)</span>
                  <InfoTip label="STUN + сравнение IP" className="size-6">
                    <p>{data.vpnHint.detail}</p>
                    <p className="pt-2 text-muted-foreground">
                      Сопоставляется публичный IP вашего HTTPS-запроса к этому
                      сайту с IP из ICE-кандидата типа srflx (
                      <span className="font-medium text-foreground">WebRTC</span>
                      , публичный STUN). Прямого API «VPN on/off» в браузере нет;
                      совпадение не исключает туннель с тем же egress.
                    </p>
                  </InfoTip>
                </dt>
                <dd className="min-w-0 break-words font-medium text-foreground">
                  {data.vpnHint.label}
                </dd>
              </div>
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
                Расширенные поля (Client Hints, WebGL, storage)
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
