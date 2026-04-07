import { NextResponse } from "next/server";

import { agentServerLog } from "@/lib/debug-agent-log-server";

export const dynamic = "force-dynamic";

export async function GET() {
  agentServerLog({
    hypothesisId: "H4",
    location: "app/api/ping/route.ts:GET",
    message: "ping GET",
    data: {},
  });
  return NextResponse.json(
    { t: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}
