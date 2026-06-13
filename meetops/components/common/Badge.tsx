import type { PollStatus, SessionStatus, UserRole } from "@/types/domain";
import { pollStatusLabels, roleLabels, sessionStatusLabels } from "@/lib/labels";

const sessionTone: Record<SessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  interest_check: "bg-sky-50 text-sky-700 border-sky-200",
  topic_selection: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  availability_collection: "bg-indigo-50 text-indigo-700 border-indigo-200",
  polling: "bg-blue-50 text-blue-700 border-blue-200",
  needs_host_decision: "bg-amber-50 text-amber-800 border-amber-200",
  scheduling: "bg-amber-50 text-amber-800 border-amber-200",
  scheduled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduling_failed: "bg-rose-50 text-rose-700 border-rose-200",
  rescheduling: "bg-amber-50 text-amber-800 border-amber-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 line-through",
  completed: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const pollTone: Record<PollStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-zinc-100 text-zinc-700 border-zinc-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  superseded: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const roleTone: Record<UserRole | "host" | "meeting_owner", string> = {
  owner: "bg-teal-900 text-white border-teal-900",
  admin: "bg-zinc-900 text-white border-zinc-900",
  member: "bg-white text-zinc-700 border-zinc-300",
  host: "bg-blue-50 text-blue-700 border-blue-200",
  meeting_owner: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return <Badge className={sessionTone[status]}>{sessionStatusLabels[status]}</Badge>;
}

export function PollStatusBadge({ status }: { status: PollStatus }) {
  return <Badge className={pollTone[status]}>{pollStatusLabels[status]}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole | "host" | "meeting_owner" }) {
  return <Badge className={roleTone[role]}>{roleLabels[role]}</Badge>;
}

export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
