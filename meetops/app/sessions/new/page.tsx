import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { groups } from "@/lib/mock-data";

export default async function CreateSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const query = await searchParams;

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader title="Create session" subtitle="Start a session proposal and choose how Calendar invites should work." />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <form className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Group</span>
                <select defaultValue={query.groupId} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm">
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <Field label="Topic" placeholder="System Design: Monitoring and Logging" />
              <TextArea label="Description" placeholder="What should members expect from this session?" />
              <div>
                <div className="mb-2 text-sm font-medium">Calendar invitation policy</div>
                <div className="grid gap-3">
                  <Radio title="Invite all group members" description="Best for official community-wide sessions." />
                  <Radio title="Invite interested members only" description="Only members who selected Interested/Attending are added to Calendar." />
                  <Radio title="App link only" description="Create a Meet link but do not add members as Calendar attendees." defaultChecked />
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Initial planning flow</div>
                <select className="min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm">
                  <option>Create session only</option>
                  <option>Create topic poll</option>
                  <option>Create availability poll</option>
                  <option>Create final timing poll</option>
                </select>
              </div>
              <div className="flex gap-2"><Button tone="primary">Create session</Button><Button>Cancel</Button></div>
            </form>
          </Card>
          <Card>
            <h2 className="font-semibold">Preview</h2>
            <p className="mt-2 text-sm text-zinc-600">The session will start as a draft until a poll is published or scheduling begins.</p>
          </Card>
        </div>
      </div>
    </AuthenticatedPage>
  );
}

function Field({ label, placeholder }: { label: string; placeholder?: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><input placeholder={placeholder} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" /></label>;
}

function TextArea({ label, placeholder }: { label: string; placeholder?: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><textarea placeholder={placeholder} rows={4} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>;
}

function Radio({ title, description, defaultChecked = false }: { title: string; description: string; defaultChecked?: boolean }) {
  return <label className="flex gap-3 rounded-md border border-zinc-200 p-3"><input type="radio" name="policy" defaultChecked={defaultChecked} /><span><span className="block text-sm font-medium">{title}</span><span className="text-sm text-zinc-600">{description}</span></span></label>;
}
