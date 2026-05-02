"use client";

import { Wifi } from "lucide-react";

import { cn } from "@/lib/utils";

export function DiagnosticSummaryCard({
  className,
}: {
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/50 bg-muted/40 p-4 shadow-sm backdrop-blur-sm sm:p-5",
        className
      )}
      aria-label="Сводка диагностики"
    >
      <div className="flex gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-500 to-neutral-700 text-white shadow-sm dark:from-neutral-600 dark:to-neutral-800"
          aria-hidden
        >
          <Wifi className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight tracking-tight">
            Диагностика сети
          </h1>
        </div>
      </div>
    </section>
  );
}
