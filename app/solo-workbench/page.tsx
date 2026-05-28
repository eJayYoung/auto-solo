import { SoloWorkbenchHomeClient } from "@/components/solo-workbench-home-client";
import { readSoloSessions } from "@/lib/services/solo-workflow";

export default async function SoloWorkbenchPage() {
  const sessions = await readSoloSessions();

  return <SoloWorkbenchHomeClient initialSessions={sessions} />;
}
