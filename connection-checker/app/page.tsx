import { ConnectionDashboard } from "@/components/connection-dashboard";
import { agentServerLog } from "@/lib/debug-agent-log-server";

export default async function Home() {
  agentServerLog({
    hypothesisId: "H4",
    location: "app/page.tsx:Home",
    message: "Home server render start",
    data: {},
  });
  return <ConnectionDashboard />;
}
