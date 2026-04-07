# connection-checker

Browser-based internet diagnostics built with Next.js.

## English

Measure internet quality from a regular browser tab:

- **HTTP/HTTPS latency (RTT)** and request-level loss (timeouts/network errors, plus 4xx/5xx when CORS allows)
- **HTTPS download throughput** using public CDN assets
- **Host reachability probes** (CORS vs `no-cors` / opaque)

### Run locally

Requirements: Node.js + npm.

```bash
npm install
npm run dev
```

Build and run:

```bash
npm run build
npm run start
```

### Limitations

- This is **not ICMP ping**. Everything is measured via browser networking: TLS + HTTP + `fetch()`.
- Some probes run in `**no-cors` (opaque)** mode: JavaScript cannot read the HTTP status/body, only whether the request completed or failed.
- Results depend on routing, DNS, proxies/VPN, corporate filtering, extensions, and Wi‑Fi.

## Русский

Диагностика качества интернета из обычной вкладки браузера:

- **HTTP/HTTPS задержка (RTT)** и «потери» на уровне запросов (таймауты/ошибки сети, плюс 4xx/5xx там, где разрешён CORS)
- **скорость загрузки (downlink)** по HTTPS на публичных ресурсах (CDN)
- **пробы доступности хостов** (CORS vs `no-cors` / opaque)

### Запуск локально

Требования: Node.js + npm.

```bash
npm install
npm run dev
```

Сборка и запуск:

```bash
npm run build
npm run start
```

### Ограничения

- Это **не ICMP ping**. Замеры делаются через сетевой стек браузера: TLS + HTTP + `fetch()`.
- Часть проб идёт в режиме `**no-cors` (opaque)**: статус/тело ответа недоступны JS, фиксируется только факт успеха/ошибки.
- На результат влияют маршрутизация, DNS, прокси/VPN, корпоративные фильтры, расширения и Wi‑Fi.

## More details

See the app-level documentation: `[connection-checker/README.md](connection-checker/README.md)`.