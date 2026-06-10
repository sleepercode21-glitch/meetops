import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDateTime } from "@/lib/date-time";
import { auditActionLabels } from "@/lib/labels";
import { ApiRequestError, getGroupAuditLogs, getGroupDetail } from "@/lib/web-api";

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, logs } = await getAuditData(groupId);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Audit Log"
          subtitle={`Traceability for ${group.name}.`}
        />
        <Card>
          <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-4">
            <Summary label="Events" value={logs.length} />
            <Summary label="Session Events" value={logs.filter((log) => log.session_id).length} />
            <Summary label="Poll Events" value={logs.filter((log) => log.poll_id).length} />
            <Summary label="System Events" value={logs.filter((log) => !log.user_id).length} />
          </div>
        </Card>
        <div className="space-y-3">
          {logs.length ? logs.map((event) => (
            <Card key={event.audit_log_id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <h2 className="font-semibold text-zinc-950">{auditActionLabels[event.action] ?? event.action}</h2>
                  <p className="text-sm text-zinc-600">
                    User {event.user_id ?? "system"}
                    {event.session_id ? ` · Session ${event.session_id}` : ""}
                    {event.poll_id ? ` · Poll ${event.poll_id}` : ""}
                  </p>
                </div>
                <div className="text-sm text-zinc-500">{formatDateTime(event.created_at)}</div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Metadata</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-white">{JSON.stringify(event.metadata, null, 2)}</pre>
              </details>
            </Card>
          )) : (
            <Card>
              <p className="text-sm text-zinc-600">No audit events yet.</p>
            </Card>
          )}
        </div>
      </div>
    </AuthenticatedPage>
  );
}

async function getAuditData(groupId: string) {
  try {
    const [group, { logs }] = await Promise.all([
      getGroupDetail(groupId),
      getGroupAuditLogs(groupId),
    ]);
    return { group, logs };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect(`/groups/${groupId}`);
    }
    throw error;
  }
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-lg font-semibold text-zinc-950">{value}</div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
    </div>
  );
}
