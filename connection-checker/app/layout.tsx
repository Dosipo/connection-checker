import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { YandexRsyScripts } from "@/components/yandex-rsy-scripts";

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
    "Оценка сети из браузера (HTTP/HTTPS): задержки, стабильность, скорость по HTTPS, доступность хостов и расширенные проверки для поддержки",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
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
