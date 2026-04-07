export type ReachabilityRegion =
  | "Россия"
  | "Зарубеж"
  | "Белый список";

export type ReachabilityTarget = {
  id: string;
  label: string;
  region: ReachabilityRegion;
  host: string;
  url: string;
  mode: "cors" | "opaque";
};

export const REACHABILITY_TARGETS: ReachabilityTarget[] = [
  {
    id: "ya-static",
    label: "Яндекс (CDN)",
    region: "Россия",
    host: "yastatic.net",
    url: "https://yastatic.net/s3/home/logos/yandex-logo/yx-black.svg",
    mode: "opaque",
  },
  {
    id: "vk",
    label: "VK",
    region: "Россия",
    host: "vk.com",
    url: "https://vk.com/favicon.ico",
    mode: "opaque",
  },
  {
    id: "ok",
    label: "Одноклассники",
    region: "Россия",
    host: "ok.ru",
    url: "https://ok.ru/favicon.ico",
    mode: "opaque",
  },
  {
    id: "dzen",
    label: "Дзен",
    region: "Россия",
    host: "dzen.ru",
    url: "https://dzen.ru/favicon.ico",
    mode: "opaque",
  },
  {
    id: "mail",
    label: "Mail.ru",
    region: "Россия",
    host: "mail.ru",
    url: "https://mail.ru/favicon.ico",
    mode: "opaque",
  },
  {
    id: "rambler",
    label: "Rambler",
    region: "Россия",
    host: "rambler.ru",
    url: "https://www.rambler.ru/favicon.ico",
    mode: "opaque",
  },
  {
    id: "google-204",
    label: "Google",
    region: "Зарубеж",
    host: "google.com",
    url: "https://www.google.com/generate_204",
    mode: "opaque",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    region: "Зарубеж",
    host: "cloudflare.com",
    url: "https://www.cloudflare.com/favicon.ico",
    mode: "opaque",
  },
  {
    id: "github",
    label: "GitHub API",
    region: "Зарубеж",
    host: "api.github.com",
    url: "https://api.github.com/zen",
    mode: "cors",
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    region: "Зарубеж",
    host: "wikipedia.org",
    url: "https://www.wikipedia.org/static/favicon/wikipedia.ico",
    mode: "opaque",
  },
  {
    id: "microsoft",
    label: "Microsoft",
    region: "Зарубеж",
    host: "microsoft.com",
    url: "https://www.microsoft.com/favicon.ico",
    mode: "opaque",
  },
];
