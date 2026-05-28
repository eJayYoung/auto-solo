import { notFound } from "next/navigation";
import { SoloWorkbenchPageClient } from "@/components/solo-workbench-page-client";
import { readSoloSession } from "@/lib/services/solo-workflow";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SoloWorkbenchSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await readSoloSession(sessionId);
  if (!session) {
    notFound();
  }

  return <SoloWorkbenchPageClient initialSession={session} />;
}
