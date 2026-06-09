import { PollEditorPage } from "@/components/polls/PollEditorPage";

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <PollEditorPage sessionId={sessionId} />;
}
