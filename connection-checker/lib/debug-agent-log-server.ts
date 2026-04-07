import { appendFileSync } from "fs";
import path from "path";

export function agentServerLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}) {
  const line =
    JSON.stringify({
      sessionId: "953efc",
      timestamp: Date.now(),
      ...payload,
    }) + "\n";
  for (const p of [
    path.resolve(process.cwd(), "..", "debug-953efc.log"),
    path.join(process.cwd(), "debug-953efc.log"),
  ]) {
    try {
      appendFileSync(p, line);
      return;
    } catch {}
  }
}
