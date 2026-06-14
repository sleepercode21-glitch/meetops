"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { ConfirmButton } from "@/components/common/ConfirmAction";
import type { Session } from "@/types/domain";

type ManagementRole = "admin" | "host";

export function SessionActions({
  session,
  canManage,
  managementRole,
}: {
  session: Session;
  canManage: boolean;
  managementRole?: ManagementRole;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) {
    return <p className="text-sm text-zinc-600">Host actions are hidden for members.</p>;
  }

  async function post(path: string, action: string) {
    setPending(action);
    setMessage(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMessage(body?.error?.message ?? `Could not ${action}.`);
      return;
    }
    router.refresh();
  }

  async function deleteDraftSession() {
    setPending("delete");
    setMessage(null);
    const response = await fetch(`/api/v1/sessions/${session.id}`, { method: "DELETE" });
    setPending(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMessage(body?.error?.message ?? "Could not delete draft session.");
      return;
    }
    router.push(`/groups/${session.groupId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
      <div className="flex min-h-9 items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 sm:w-44">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-700">
          {managementRole === "admin" ? "Admin controls" : "Host controls"}
        </p>
      </div>
      {session.status === "needs_host_decision" ? (
        <ManualScheduleButton sessionId={session.id} />
      ) : null}
      {session.status === "scheduling_failed" ? (
        <Button
          tone="primary"
          className="w-full"
          disabled={pending === "retry"}
          onClick={() => post(`/api/v1/sessions/${session.id}/retry-scheduling`, "retry scheduling")}
        >
          {pending === "retry" ? "Retrying..." : "Try Scheduling Again"}
        </Button>
      ) : null}
      {session.status === "scheduled" ? (
        <>
          <ConfirmButton
            className="w-full"
            disabled={pending === "complete"}
            onConfirm={() => void post(`/api/v1/sessions/${session.id}/complete`, "complete session")}
            confirm={{
              title: "Mark session completed?",
              message: "This moves the session out of the active workflow.",
              confirmLabel: "Mark completed",
            }}
          >
            Mark as Completed
          </ConfirmButton>
          <ConfirmButton
            className="w-full"
            disabled={pending === "reschedule"}
            onConfirm={() => void post(`/api/v1/sessions/${session.id}/reschedule`, "reschedule")}
            confirm={{
              title: "Change scheduled time?",
              message: "This moves the scheduled session back into rescheduling so the host can choose a new time.",
              confirmLabel: "Change time",
            }}
          >
            Change Time
          </ConfirmButton>
        </>
      ) : null}
      {!["cancelled", "completed", "scheduled", "scheduling", "needs_host_decision"].includes(session.status) ? (
        <ButtonLink href={`/sessions/${session.id}/reschedule`} tone="primary" className="w-full sm:w-auto sm:min-w-40">
          Schedule Directly
        </ButtonLink>
      ) : null}
      {!["cancelled", "completed", "scheduled"].includes(session.status) ? (
        <ButtonLink href={`/sessions/${session.id}/edit`} className="w-full sm:w-auto sm:min-w-36">
          Edit Session
        </ButtonLink>
      ) : null}
      {session.status === "draft" ? (
        <ConfirmButton
          tone="danger"
          className="w-full sm:w-auto sm:min-w-36"
          disabled={pending === "delete"}
          onConfirm={() => void deleteDraftSession()}
          confirm={{
            title: "Delete draft session?",
            message: "This permanently removes this draft session. Published polls and scheduled sessions cannot be deleted this way.",
            confirmLabel: "Delete draft",
            cancelLabel: "Keep draft",
          }}
        >
          {pending === "delete" ? "Deleting..." : "Delete Draft"}
        </ConfirmButton>
      ) : null}
      {!["draft", "cancelled", "completed", "scheduling"].includes(session.status) ? (
        <ConfirmButton
          tone="danger"
          className="w-full sm:w-auto sm:min-w-36"
          disabled={pending === "cancel"}
          onConfirm={() => void post(`/api/v1/sessions/${session.id}/cancel`, "cancel session")}
          confirm={{
            title: "Cancel session?",
            message: "This cancels the session for everyone. Any linked calendar event will be cancelled too.",
            confirmLabel: "Cancel session",
            cancelLabel: "Keep session",
          }}
        >
          Cancel
        </ConfirmButton>
      ) : null}
      {message ? <p className="text-sm text-rose-700">{message}</p> : null}
    </div>
  );
}

function ManualScheduleButton({ sessionId }: { sessionId: string }) {
  return (
    <ButtonLink href={`/sessions/${sessionId}/reschedule`} tone="primary" className="w-full sm:w-auto sm:min-w-40">
      Schedule Directly
    </ButtonLink>
  );
}
