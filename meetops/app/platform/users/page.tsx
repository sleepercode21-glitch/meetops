import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { RoleBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { getCurrentUser, getPlatformUsers, type ApiPlatformUser } from "@/lib/web-api";

export default async function PlatformUsersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.platformOwner) {
    redirect("/dashboard");
  }

  const { users } = await getPlatformUsers();
  const calendarReady = users.filter((user) => user.google.calendar_events_scope_granted).length;
  const admins = users.filter((user) => user.counts.admin_groups > 0).length;

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Registered Users"
          subtitle={`${users.length} users · ${admins} group admins · ${calendarReady} calendar-ready`}
          badge={<RoleBadge role="owner" />}
          primaryAction={<ButtonLink href="/dashboard">Back to Dashboard</ButtonLink>}
        />

        <div className="grid auto-rows-fr gap-3 md:grid-cols-4">
          <MetricCard label="Users" value={users.length} />
          <MetricCard label="Group admins" value={admins} />
          <MetricCard label="Calendar ready" value={calendarReady} />
          <MetricCard label="No groups" value={users.filter((user) => user.counts.groups === 0).length} />
        </div>

        <section>
          <SectionTitle
            title="User directory"
            subtitle="Product-owner view of registered accounts, memberships, and app activity."
          />
          <div className="mt-3 space-y-3">
            {users.map((user) => (
              <UserCard key={user.user_id} user={user} />
            ))}
          </div>
        </section>
      </div>
    </AuthenticatedPage>
  );
}

function UserCard({ user }: { user: ApiPlatformUser }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          {user.profile_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.profile_photo}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border border-zinc-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
              {initials(displayName(user))}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-zinc-950">{displayName(user)}</h2>
              {user.platform_owner ? <RoleBadge role="owner" /> : null}
              {user.counts.admin_groups > 0 ? <RoleBadge role="admin" /> : null}
            </div>
            <p className="truncate text-sm text-zinc-500">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
              <InfoChip label="Timezone" value={user.timezone} />
              <InfoChip label="Joined" value={formatDate(user.joined_at)} />
              <InfoChip label="Updated" value={formatDate(user.updated_at)} />
              <InfoChip
                label="Calendar"
                value={
                  user.google.calendar_events_scope_granted
                    ? "Ready"
                    : user.google.connected
                      ? "Needs reconnect"
                      : "Not connected"
                }
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
          <MiniMetric label="Groups" value={user.counts.groups} />
          <MiniMetric label="Hosted" value={user.counts.hosted_sessions} />
          <MiniMetric label="Votes" value={user.counts.votes} />
          <MiniMetric label="Comments" value={user.counts.comments} />
        </div>
      </div>

      <div className="grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)]">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Groups</div>
          {user.memberships.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {user.memberships.map((membership) => (
                <span
                  key={`${user.user_id}-${membership.group_id}`}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700"
                >
                  {membership.group_name}
                  {membership.is_admin ? <span className="font-medium text-zinc-950"> · Admin</span> : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No group memberships yet.</p>
          )}
        </div>
        <div className="text-sm text-zinc-600">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Google</div>
          <p className="mt-2">Connected: {user.google.connected ? "Yes" : "No"}</p>
          <p>Calendar scope: {user.google.calendar_events_scope_granted ? "Granted" : "Missing"}</p>
          <p>Token expires: {formatDateTime(user.google.access_token_expires_at)}</p>
        </div>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="min-h-24">
      <div className="text-2xl font-semibold text-zinc-950">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="font-semibold text-zinc-950">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
      <span className="text-zinc-500">{label}: </span>
      <span className="font-medium text-zinc-800">{value}</span>
    </span>
  );
}

function displayName(user: ApiPlatformUser) {
  return [user.firstname, user.lastname].filter(Boolean).join(" ") || user.email;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}
