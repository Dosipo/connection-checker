import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { YandexRsyScripts } from "@/components/yandex-rsy-scripts";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Диагностика состояния сети",
  description:
    "Бесплатная онлайн-диагностика интернета из браузера: задержка и потери HTTP(S), скорость загрузки по HTTPS, проверка доступности сайтов и соответствие перечню сервисов Минцифры (белый список). Без установки ПО.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-svh bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider>
          <YandexRsyScripts />
          <div className="relative min-h-svh">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-app-gradient"
            />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
