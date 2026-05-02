"use client";

import { useEffect, useId } from "react";

import { cn } from "@/lib/utils";

type AdvManager = {
  render: (opts: { blockId: string; renderTo: string }) => void;
};

declare global {
  interface Window {
    yaContextCb?: (() => void)[];
    Ya?: { Context?: { AdvManager?: AdvManager } };
  }
}

type YandexRtbSlotProps = {
  /** ID блока из кабинета РСЯ, например R-A-12345-1 */
  blockId?: string;
  className?: string;
  /** Ограничить высоту для «тонких» баннеров */
  compact?: boolean;
};

export function YandexRtbSlot({ blockId, className, compact }: YandexRtbSlotProps) {
  const containerId = `yandex-rtb-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const id = blockId?.trim();
    if (!id) return;

    const render = () => {
      try {
        window.Ya?.Context?.AdvManager?.render({
          blockId: id,
          renderTo: containerId,
        });
      } catch {
        /* РСЯ может кратко быть недоступна — не ломаем страницу */
      }
    };

    window.yaContextCb = window.yaContextCb || [];
    window.yaContextCb.push(render);
  }, [blockId, containerId]);

  if (!blockId?.trim()) return null;

  return (
    <aside
      className={cn(
        "flex w-full justify-center overflow-hidden rounded-lg border border-dashed border-border/70 bg-muted/20",
        compact ? "max-h-[140px]" : "max-h-[320px]",
        className
      )}
      aria-label="Реклама"
    >
      <div id={containerId} className="min-h-[72px] w-full max-w-full" />
    </aside>
  );
}
