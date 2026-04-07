# connection-checker
Next.js browser-based internet diagnostics: HTTP/HTTPS latency &amp; loss, CDN download throughput, and host reachability checks

Небольшой веб‑сервис на Next.js для диагностики качества интернет‑соединения из браузера:
HTTP/HTTPS задержка (RTT) и «потери» на уровне fetch()
скорость загрузки (downlink) по HTTPS с публичного CDN
доступность (reachability) выбранных хостов из браузера (CORS / no‑cors)
