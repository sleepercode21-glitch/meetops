import { PollEditorPage } from "@/components/polls/PollEditorPage";

export default async function EditPollPage({
  params,
}: {
  params: Promise<{ sessionId: string; pollId: string }>;
}) {
  const { sessionId, pollId } = await params;
  return <PollEditorPage sessionId={sessionId} pollId={pollId} />;
}
