"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import type { PollType, Suggestion } from "@/types/domain";

export function SuggestionPanel({
  pollId,
  pollStatus,
  suggestions,
}: {
  pollId: string;
  pollType: PollType;
  pollStatus: "draft" | "active" | "closed" | "cancelled" | "superseded";
  suggestions: Suggestion[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canComment = pollStatus === "draft" || pollStatus === "active";

  async function submitComment() {
    if (!comment.trim()) return;
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${pollId}/suggestions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestion: comment }),
    });
    setPending(false);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not post comment."));
      return;
    }
    setComment("");
    router.refresh();
  }

  return (
    <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
        Comments {suggestions.length ? `(${suggestions.length})` : ""}
      </summary>
      <div className="mt-3 space-y-3">
        {canComment ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={comment}
              className="min-h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
              placeholder="Add a comment"
              onChange={(event) => setComment(event.target.value)}
            />
            <Button type="button" tone="primary" disabled={pending} onClick={submitComment}>
              {pending ? "Posting..." : "Post"}
            </Button>
          </div>
        ) : null}
        {message ? <p className="text-sm text-rose-700">{message}</p> : null}
        <div className="space-y-2">
          {suggestions.length ? (
            suggestions.map((item) => (
              <div key={item.id} className="rounded-md border border-zinc-200 bg-white p-3">
                <div className="text-sm text-zinc-900">{item.text}</div>
                <div className="mt-2 text-xs text-zinc-500">{item.authorName}</div>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No comments yet.</p>
          )}
        </div>
      </div>
    </details>
  );
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
