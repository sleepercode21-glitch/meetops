"use client";

import { useEffect } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export function RealtimeSessionRefresh({
  enabled,
  intervalMs = 750,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    function refreshVisible() {
      const now = Date.now();
      if (document.visibilityState !== "visible" || now - lastRefreshAt.current < intervalMs) return;
      lastRefreshAt.current = now;
      router.refresh();
    }
    const tick = window.setInterval(() => {
      refreshVisible();
    }, intervalMs);
    refreshVisible();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
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
