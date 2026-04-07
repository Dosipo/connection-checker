import { NextRequest, NextResponse } from "next/server";

import { agentServerLog } from "@/lib/debug-agent-log-server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;
const DEFAULT_BYTES = 1024 * 1024;

export async function GET(req: NextRequest) {
  agentServerLog({
    hypothesisId: "H2",
    location: "app/api/speed/route.ts:GET",
    message: "GET entry",
    data: { searchParams: Object.fromEntries(req.nextUrl.searchParams) },
  });
  try {
    const raw = req.nextUrl.searchParams.get("bytes");
    const requested = raw ? Number.parseInt(raw, 10) : DEFAULT_BYTES;
    const bytes = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1024), MAX_BYTES)
      : DEFAULT_BYTES;

    agentServerLog({
      hypothesisId: "H2",
      location: "app/api/speed/route.ts:GET",
      message: "before Buffer.alloc",
      data: { bytes },
    });

    const buffer = Buffer.alloc(bytes, 0x2e);

    agentServerLog({
      hypothesisId: "H2",
      location: "app/api/speed/route.ts:GET",
      message: "after Buffer.alloc ok",
      data: { bytes },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (e) {
    agentServerLog({
      hypothesisId: "H2",
      location: "app/api/speed/route.ts:GET",
      message: "GET uncaught path",
      data: {
        err: e instanceof Error ? e.message : String(e),
        name: e instanceof Error ? e.name : "",
      },
    });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  agentServerLog({
    hypothesisId: "H1",
    location: "app/api/speed/route.ts:POST",
    message: "POST entry",
    data: {
      contentLength: req.headers.get("content-length"),
    },
    runId: "arrayBuffer",
  });
  try {
    const clHeader = req.headers.get("content-length");
    const declared = clHeader ? Number.parseInt(clHeader, 10) : NaN;
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      agentServerLog({
        hypothesisId: "H1",
        location: "app/api/speed/route.ts:POST",
        message: "reject content-length",
        data: { declared, MAX_BYTES },
        runId: "arrayBuffer",
      });
      return NextResponse.json({ error: "too large" }, { status: 413 });
    }

    const ab = await req.arrayBuffer();
    const received = ab.byteLength;

    if (received > MAX_BYTES) {
      agentServerLog({
        hypothesisId: "H1",
        location: "app/api/speed/route.ts:POST",
        message: "reject after buffer",
        data: { received },
        runId: "arrayBuffer",
      });
      return NextResponse.json({ error: "too large" }, { status: 413 });
    }

    agentServerLog({
      hypothesisId: "H1",
      location: "app/api/speed/route.ts:POST",
      message: "POST arrayBuffer ok",
      data: { received },
      runId: "arrayBuffer",
    });

    return NextResponse.json(
      { ok: true, bytes: received, t: Date.now() },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (outer) {
    agentServerLog({
      hypothesisId: "H1",
      location: "app/api/speed/route.ts:POST",
      message: "POST outer throw",
      data: {
        err: outer instanceof Error ? outer.message : String(outer),
        stack: outer instanceof Error ? outer.stack : "",
      },
      runId: "arrayBuffer",
    });
    throw outer;
  }
}
