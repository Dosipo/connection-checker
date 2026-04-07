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

export async function GET(request: NextRequest) {
  const xf = request.headers.get("x-forwarded-for");
  const rip = request.headers.get("x-real-ip");
  const fromHeader = xf?.split(",")[0]?.trim() || rip?.trim() || "";
  if (fromHeader) {
    const { ipv4, ipv6 } = classifyIp(fromHeader);
    return NextResponse.json({
      ipv4,
      ipv6,
      source: "proxy",
    });
  }
  return NextResponse.json({
    ipv4: null,
    ipv6: null,
    source: "local",
  });
}
