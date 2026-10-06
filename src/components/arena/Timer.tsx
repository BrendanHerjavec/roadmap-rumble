"use client";

import { useEffect, useState } from "react";
import { serverNow } from "@/lib/session/clock";

/**
 * Countdown ring for the voting window.
 *
 * Driven off the matchup's `opened_at` rather than a local start time, so every
 * client shows the same number even if they joined halfway through.
 */
export function Timer({
  openedAt,
  seconds,
  paused,
}: {
  openedAt: string | null;
  seconds: number;
  paused?: boolean;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!openedAt || paused) return;
    const endsAt = new Date(openedAt).getTime() + seconds * 1000;

    const tick = () => setLeft(Math.max(0, (endsAt - serverNow()) / 1000));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [openedAt, seconds, paused]);

  const frac = seconds > 0 ? left / seconds : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const urgent = left <= 5;

  return (
    <div className="relative h-[86px] w-[86px]">
      <svg viewBox="0 0 86 86" className="h-full w-full -rotate-90">
        <circle cx="43" cy="43" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="43"
          cy="43"
          r={R}
          fill="none"
          stroke={urgent ? "var(--color-blood-400)" : "var(--color-ember-400)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset 120ms linear" }}
        />
      </svg>
      <span
        className={`tabular absolute inset-0 flex items-center justify-center text-2xl font-black ${
          urgent ? "text-blood-400" : "text-white"
        }`}
      >
        {Math.ceil(left)}
      </span>
    </div>
  );
}
