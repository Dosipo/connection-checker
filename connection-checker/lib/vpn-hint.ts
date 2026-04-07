const STUN_URL = "stun:stun.l.google.com:19302";

function parseIceCandidateLine(line: string): { typ: string; ip: string } | null {
  const s = line.startsWith("candidate:") ? line.slice("candidate:".length) : line;
  const parts = s.trim().split(/\s+/);
  if (parts.length < 8 || parts[6] !== "typ") return null;
  return { typ: parts[7] ?? "", ip: parts[4] ?? "" };
}

function isLikelyPublicIpv4(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;
  if (ip.startsWith("10.")) return false;
  if (ip.startsWith("127.")) return false;
  if (ip.startsWith("169.254.")) return false;
  if (ip.startsWith("192.168.")) return false;
  const oct = ip.split(".").map(Number);
  if (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) return false;
  return true;
}

function normalizeIpv6(ip: string): string {
  return ip.trim().toLowerCase();
}

/** Собирает публичные адреса из ICE-кандидатов типа srflx (STUN). */
async function gatherSrflxPublicIps(timeoutMs: number): Promise<{
  ipv4: string[];
  ipv6: string[];
}> {
  const ipv4 = new Set<string>();
  const ipv6 = new Set<string>();
  if (typeof RTCPeerConnection === "undefined") {
    return { ipv4: [], ipv6: [] };
  }
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: STUN_URL }],
  });
  try {
    pc.createDataChannel("");
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => resolve(), timeoutMs);
      pc.onicecandidate = (ev) => {
        if (ev.candidate === null) {
          window.clearTimeout(timer);
          resolve();
          return;
        }
        const raw = ev.candidate.candidate;
        if (!raw) return;
        const p = parseIceCandidateLine(raw);
        if (!p || p.typ !== "srflx" || !p.ip) return;
        if (p.ip.includes(":")) {
          ipv6.add(p.ip);
        } else if (isLikelyPublicIpv4(p.ip)) {
          ipv4.add(p.ip);
        }
      };
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .catch(() => {
          window.clearTimeout(timer);
          resolve();
        });
    });
  } catch {
    void 0;
  } finally {
    pc.close();
  }
  return { ipv4: [...ipv4], ipv6: [...ipv6] };
}

export type VpnHint = {
  /** Кратко для строки в интерфейсе */
  label: string;
  /** Чуть подробнее (например подсказка) */
  detail: string;
};

/**
 * Грубая оценка «похоже ли на VPN/прокси»: сравнение IP запроса к серверу
 * и публичного IP из WebRTC srflx. Не является надёжным определением VPN.
 */
export async function getVpnHint(
  serverIpv4: string | null,
  serverIpv6: string | null
): Promise<VpnHint> {
  const srv4 = serverIpv4?.trim() || null;
  const srv6 = serverIpv6?.trim() ? normalizeIpv6(serverIpv6) : null;

  const { ipv4: srflx4, ipv6: srflx6 } = await gatherSrflxPublicIps(2800);

  if (!srv4 && !srv6) {
    return {
      label: "Нет клиентского IP на сервере для сравнения",
      detail:
        "Типично для localhost без X-Forwarded-For/X-Real-IP или если edge не прокидывает адрес к приложению.",
    };
  }

  if (srflx4.length === 0 && srflx6.length === 0) {
    return {
      label: "ICE srflx не получен — сравнение невозможно",
      detail:
        "Нет публичного reflexive-кандидата после STUN (блок WebRTC, privacy-hardening, часть VPN leak-protection, таймаут).",
    };
  }

  if (srv4) {
    const hit = srflx4.includes(srv4);
    if (hit) {
      return {
        label: "Расхождения egress IPv4 (HTTP vs srflx) не видно",
        detail:
          "IP из HTTP-запроса совпал с srflx. Полностью исключить split-tunnel VPN по одному тесту нельзя.",
      };
    }
    if (srflx4.length > 0) {
      return {
        label: "Вероятен отдельный egress (VPN, прокси, policy routing)",
        detail:
          "IPv4, видимый приложению по HTTP, отличается от reflexive IPv4 в WebRTC — частый сценарий для VPN/прокси или асимметричной маршрутизации.",
      };
    }
  }

  if (srv6) {
    const hit = srflx6.some((ip) => normalizeIpv6(ip) === srv6);
    if (hit) {
      return {
        label: "Расхождения egress IPv6 не видно",
        detail: "IPv6 HTTP и srflx совпали в этой выборке.",
      };
    }
    if (srflx6.length > 0) {
      return {
        label: "Вероятен отдельный IPv6 egress",
        detail:
          "Публичный IPv6 из HTTP не совпал с srflx — проверьте туннель/прокси/NAT64.",
      };
    }
  }

  return {
    label: "Недостаточно пар для сравнения",
    detail:
      "На сервере есть IP, но в srflx нет совместимой AF для сопоставления.",
  };
}
