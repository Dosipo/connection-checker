"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function InfoTip({
  children,
  label = "Подробнее",
  className,
  contentClassName,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={label}
        >
          <Info className="size-3.5" strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "text-xs font-normal leading-snug text-card-foreground",
          contentClassName
        )}
      >
        <div className="space-y-2">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}
