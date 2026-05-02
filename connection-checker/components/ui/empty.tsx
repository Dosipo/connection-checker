"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Empty({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-sm rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-center text-sm",
        className
      )}
    >
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

