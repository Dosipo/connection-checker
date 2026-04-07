import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function classifyIp(raw: string): { ipv4: string | null; ipv6: string | null } {
  const t = raw.trim();
  if (!t) return { ipv4: null, ipv6: null };
  if (t.startsWith("::ffff:")) {
    const v4 = t.slice(7);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return { ipv4: v4, ipv6: null };
  }
  if (t.includes(":")) return { ipv4: null, ipv6: t };
  return { ipv4: t, ipv6: null };
}

/** Убираем loopback — иначе в UI появляется «::1», хотя это не «адрес клиента в интернете». */
function sanitizeClientIp(ipv4: string | null, ipv6: string | null): {
  ipv4: string | null;
  ipv6: string | null;
} {
  let v4 = ipv4;
  let v6 = ipv6;
  if (v4 === "127.0.0.1" || v4 === "0.0.0.0") v4 = null;
  if (v6) {
    const s = v6.trim().toLowerCase();
    if (s === "::1" || s === "0:0:0:0:0:0:0:1") {
      v6 = null;
    } else if (s.startsWith("::ffff:")) {
      const tail = v6.slice(7);
      if (tail === "127.0.0.1" || tail === "0.0.0.0") v6 = null;
    }
  }
  return { ipv4: v4, ipv6: v6 };
}

export async function GET(request: NextRequest) {
  const xf = request.headers.get("x-forwarded-for");
  const rip = request.headers.get("x-real-ip");
  const fromHeader = xf?.split(",")[0]?.trim() || rip?.trim() || "";
  if (fromHeader) {
    const classified = classifyIp(fromHeader);
    const { ipv4, ipv6 } = sanitizeClientIp(classified.ipv4, classified.ipv6);
    const meaningful = ipv4 != null || ipv6 != null;
    return NextResponse.json({
      ipv4,
      ipv6,
      /** `loopback` — в заголовке был только localhost/::1, публичного адреса нет */
      source: meaningful ? "proxy" : "loopback",
    });
  }
  return NextResponse.json({
    ipv4: null,
    ipv6: null,
    source: "local",
  });
}
