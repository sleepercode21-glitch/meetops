"use client";

import { useEffect } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export function RealtimeSessionRefresh({
  enabled,
  intervalMs = 5000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);
  const jitterMs = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    jitterMs.current = Math.floor(Math.random() * Math.min(intervalMs, 1000));
    function refreshVisible() {
      const now = Date.now();
      if (document.visibilityState !== "visible" || now - lastRefreshAt.current < intervalMs) return;
      lastRefreshAt.current = now;
      router.refresh();
    }
    const delayedStart = window.setTimeout(() => {
      refreshVisible();
    }, jitterMs.current);
    const tick = window.setInterval(() => {
      refreshVisible();
    }, intervalMs + jitterMs.current);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearTimeout(delayedStart);
      window.clearInterval(tick);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [enabled, intervalMs, router]);

  return enabled ? (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Live
    </div>
  ) : null;
}
