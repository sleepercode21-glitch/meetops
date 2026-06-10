import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { RoleBadge } from "@/components/common/Badge";
import type { Group } from "@/types/domain";

export function GroupCard({ group }: { group: Group }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-950">{group.name}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{group.description}</p>
        </div>
        <RoleBadge role={group.role} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Metric label="Members" value={group.memberCount} />
        <Metric label="Upcoming" value={group.upcomingSessionCount} />
        <Metric label="Polls" value={group.activePollCount} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/groups/${group.id}`} tone="primary">
          Open group
        </ButtonLink>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
      <div className="font-semibold text-zinc-950">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
