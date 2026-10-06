"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, sfxVoteLock } from "@/lib/audio";

/**
 * Sound is off until asked for.
 *
 * Muted-by-default is the only defensible starting state: this gets opened in
 * meetings and on shared screens, and audio that starts on its own is the
 * fastest way to make someone close the tab. Unmuting plays a cue immediately
 * so you know it worked — and, usefully, that first click is also the gesture
 * browsers require before an AudioContext will run at all.
 */
export function MuteToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => setOn(!isMuted()), []);

  return (
    <button
      onClick={() => {
        const next = !on;
        setOn(next);
        setMuted(!next);
        if (next) sfxVoteLock();
      }}
      aria-pressed={on}
      aria-label={on ? "Mute sound" : "Unmute sound"}
      title={on ? "Sound on" : "Sound off"}
      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] transition ${
        on
          ? "border-volt-400/40 bg-volt-500/10 text-volt-300"
          : "border-white/12 bg-white/[0.03] text-white/35 hover:text-white/70"
      }`}
    >
      {on ? "Sound on" : "Sound off"}
    </button>
  );
}
