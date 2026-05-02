"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const active: ThemeChoice =
    theme === "light" || theme === "dark" ? theme : "system";

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-9 items-center rounded-full border border-border/60 bg-muted/40 p-0.5",
          className
        )}
        aria-hidden
      >
        <span className="size-8 rounded-full" />
        <span className="size-8 rounded-full" />
        <span className="size-8 rounded-full" />
      </div>
    );
  }

  const choices: {
    value: ThemeChoice;
    icon: typeof Sun;
    label: string;
    pressed: boolean;
  }[] = [
    {
      value: "light",
      icon: Sun,
      label: "Светлая тема",
      pressed: active === "light",
    },
    {
      value: "dark",
      icon: Moon,
      label: "Тёмная тема",
      pressed: active === "dark",
    },
    {
      value: "system",
      icon: Monitor,
      label:
        resolvedTheme === "dark"
          ? "Как в системе (сейчас тёмная)"
          : "Как в системе (сейчас светлая)",
      pressed: active === "system",
    },
  ];

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-full border border-border/60 bg-muted/50 p-0.5 shadow-sm",
        className
      )}
      role="group"
      aria-label="Тема оформления"
    >
      {choices.map(({ value, icon: Icon, label, pressed }) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 rounded-full",
            pressed &&
              "bg-background text-foreground shadow-sm ring-1 ring-border/80"
          )}
          aria-pressed={pressed}
          title={label}
          onClick={() => setTheme(value)}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </Button>
      ))}
    </div>
  );
}
