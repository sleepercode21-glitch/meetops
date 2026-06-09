import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { PollCard } from "@/components/polls/PollCard";
import { SuggestionPanel } from "@/components/polls/SuggestionPanel";
import { getPoll, getPollSuggestions, getSession } from "@/lib/mock-data";
import type { Poll } from "@/types/domain";

const draftPreview: Poll = {
  id: "preview",
  sessionId: "preview-session",
  type: "final_timing",
  status: "draft",
  multiChoice: false,
  deadline: "2026-06-14T03:00:00.000Z",
  currentUserVoteIds: [],
  acceptsSuggestions: true,
  options: [
    {
      id: "preview-1",
      label: "Tue, Jun 16 evening",
      startAt: "2026-06-16T02:00:00.000Z",
      endAt: "2026-06-16T03:00:00.000Z",
      voteCount: 0,
    },
  ],
};

export function PollEditorPage({ sessionId, pollId }: { sessionId: string; pollId?: string }) {
  const session = getSession(sessionId);
  const existingPoll = pollId ? getPoll(pollId) : undefined;
  const preview = existingPoll ?? draftPreview;
  const suggestions = existingPoll ? getPollSuggestions(existingPoll.id) : [];

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title={pollId ? "Edit draft poll" : "Create poll"}
          subtitle={session?.topic ?? "Untitled session"}
          primaryAction={<Button tone="primary">Publish poll</Button>}
          secondaryActions={<Button>Save draft</Button>}
        />
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <Card>
            <form className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium">Poll type</span>
                <select defaultValue={preview.type} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm">
                  <option value="interest">Interest poll</option>
                  <option value="topic">Topic poll</option>
                  <option value="availability">Availability poll</option>
                  <option value="final_timing">Final timing poll</option>
                </select>
              </label>
              <div>
                <div className="mb-2 text-sm font-medium">Voting mode</div>
                <div className="flex gap-2">
                  <label className="rounded-md border border-zinc-200 px-3 py-2 text-sm"><input type="radio" name="mode" defaultChecked={!preview.multiChoice} /> Single choice</label>
                  <label className="rounded-md border border-zinc-200 px-3 py-2 text-sm"><input type="radio" name="mode" defaultChecked={preview.multiChoice} /> Multiple choice</label>
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Deadline</span>
                <input type="datetime-local" className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" />
              </label>
              <section>
                <SectionTitle title="Official options" subtitle="Only options added here are voteable." />
                <div className="space-y-3">
                  {preview.options.map((option) => (
                    <div key={option.id} className="grid gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <input defaultValue={option.label} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm" placeholder="Label" />
                      <input type="datetime-local" className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm" />
                      <input type="datetime-local" className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm" />
                      <Button>Delete</Button>
                    </div>
                  ))}
                </div>
                <Button className="mt-3">Add time option</Button>
              </section>
            </form>
          </Card>
          <div className="space-y-6">
            <section>
              <SectionTitle title="Live preview" subtitle="Draft preview - members cannot vote until published." />
              <PollCard poll={preview} />
            </section>
            <SuggestionPanel suggestions={suggestions} canManage />
          </div>
        </div>
      </div>
    </AuthenticatedPage>
  );
}
