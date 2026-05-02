"use client";

import type { DiagnosticVerdict } from "@/lib/diagnostic-verdict";
import { cn } from "@/lib/utils";

export function DiagnosticVerdictBlock({
  verdict,
  className,
}: {
  verdict: DiagnosticVerdict | null;
  className?: string;
}) {
  if (!verdict) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground",
          className
        )}
        aria-live="polite"
      >
        После завершения диагностики здесь появится краткая сводка по задержкам,
        сайтам и белому списку.
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border bg-card/90 p-4 shadow-sm",
        verdict.level === "good" && "border-emerald-600/25",
        verdict.level === "degraded" && "border-amber-500/35",
        verdict.level === "critical" && "border-destructive/40",
        className
      )}
      aria-live="polite"
    >
      <h2 className="text-base font-semibold leading-snug text-foreground">
        {verdict.title}
      </h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {verdict.body}
      </p>
    </section>
  );
}
