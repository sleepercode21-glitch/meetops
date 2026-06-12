"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { ConfirmButton } from "@/components/common/ConfirmAction";
import type { Session } from "@/types/domain";

export function SessionActions({
  session,
  canManage,
}: {
  session: Session;
  canManage: boolean;
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

  return (
    <div className="space-y-2">
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
      {!["cancelled", "completed", "scheduled"].includes(session.status) ? (
        <ButtonLink href={`/sessions/${session.id}/edit`} className="w-full">
          Edit Session
        </ButtonLink>
      ) : null}
      {!["cancelled", "completed", "scheduling"].includes(session.status) ? (
        <ConfirmButton
          tone="danger"
          className="w-full"
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
    <ButtonLink href={`/sessions/${sessionId}/reschedule`} tone="primary" className="w-full">
      Choose Final Time
    </ButtonLink>
  );
}
