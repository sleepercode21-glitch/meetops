"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RealtimeSessionRefresh({
  enabled,
  intervalMs = 5000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => window.clearInterval(tick);
  }, [enabled, intervalMs, router]);

  return enabled ? (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Live
    </div>
  ) : null;
}
