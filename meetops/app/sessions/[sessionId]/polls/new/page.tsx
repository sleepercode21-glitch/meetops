import { PollEditorPage } from "@/components/polls/PollEditorPage";

export default async function NewPollPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { sessionId } = await params;
  const { type } = await searchParams;
  return <PollEditorPage sessionId={sessionId} requestedType={type} />;
}
