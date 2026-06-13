"use client";

import { useRef } from "react";

export function GoogleLoginButton({ className }: { className: string }) {
  const timezoneRef = useRef<HTMLInputElement>(null);

  function attachTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone || !timezoneRef.current) {
      return;
    }
    timezoneRef.current.value = timezone;
  }

  return (
    <form action="/api/auth/google/start" method="GET" onSubmit={attachTimezone}>
      <input ref={timezoneRef} type="hidden" name="timezone" />
      <button type="submit" className={className}>
        Continue with Google
      </button>
    </form>
  );
}
