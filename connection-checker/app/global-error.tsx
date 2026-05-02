"use client";

import "./globals.css";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body className="min-h-svh bg-background px-6 py-10 font-sans text-foreground antialiased">
        <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-lg items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Сбой при загрузке</CardTitle>
              <CardDescription>
                Что-то пошло не так на этой странице. Можно попробовать повторить
                попытку.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>Ошибка приложения</AlertTitle>
                <AlertDescription>
                  {error.digest != null
                    ? `Код ошибки: ${error.digest}`
                    : "Произошла непредвиденная ошибка. Попробуйте обновить страницу."}
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" onClick={() => reset()}>
                  Попробовать снова
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
