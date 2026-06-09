import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { auditActionLabels } from "@/lib/labels";
import { auditEvents } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/date-time";

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const events = auditEvents.filter((event) => event.groupId === groupId);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader title="Audit Log" subtitle="Debugging and traceability for group lifecycle events." />
        <Card>
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm"><option>All actions</option></select>
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Session or poll" />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="User" />
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" type="date" />
          </div>
        </Card>
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-950">{auditActionLabels[event.action] ?? event.action}</h2>
                  <p className="text-sm text-zinc-600">{event.actorName} · {event.relatedLabel}</p>
                </div>
                <div className="text-sm text-zinc-500">{formatDateTime(event.createdAt)}</div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Metadata</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-white">{JSON.stringify(event.metadata, null, 2)}</pre>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </AuthenticatedPage>
  );
}
