/**
 * How fast the session runs.
 *
 * The rules never change — only the clocks. A 20-second vote window is right
 * for a real meeting where people are reading evidence for the first time, and
 * far too slow to record eight matchups against. Blitz runs the identical game
 * in roughly a fifth of the wall time.
 *
 * Bots already scale their ballots to a fraction of the window
 * (`botDelayMs`), so a shorter window tightens everything automatically rather
 * than leaving the room waiting on an empty clock.
 */

export interface Pace {
  key: "meeting" | "brisk" | "blitz";
  label: string;
  blurb: string;
  voteSeconds: number;
  discussionSeconds: number;
}

export const PACES: Pace[] = [
  {
    key: "meeting",
    label: "Meeting",
    blurb: "20s to vote, 3 min to argue. The real thing.",
    voteSeconds: 20,
    discussionSeconds: 180,
  },
  {
    key: "brisk",
    label: "Brisk",
    blurb: "10s to vote, 90s to argue. Good for a walkthrough.",
    voteSeconds: 10,
    discussionSeconds: 90,
  },
  {
    key: "blitz",
    label: "Blitz",
    blurb: "6s to vote, 45s to argue. A full round in about two minutes.",
    voteSeconds: 6,
    discussionSeconds: 45,
  },
];

export const DEFAULT_PACE = PACES[0];

export function paceFor(voteSeconds: number): Pace {
  return (
    PACES.find((p) => p.voteSeconds === voteSeconds) ?? {
      ...DEFAULT_PACE,
      key: "meeting",
      label: "Custom",
      blurb: `${voteSeconds}s to vote.`,
      voteSeconds,
    }
  );
}

/**
 * How long a decided result stays on screen before the session moves on.
 *
 * The brief asks for 5 seconds on a lopsided vote, which is right at meeting
 * pace: long enough to read the split and watch the loser take the hit. Faster
 * paces scale it down proportionally, with a floor that still clears the
 * ~1.6s fight animation.
 */
export function resultHoldMs(voteSeconds: number): number {
  const scaled = (voteSeconds / 20) * 5000;
  return Math.round(Math.max(2600, Math.min(5000, scaled)));
}

/** A contested vote never auto-advances — the whole point is that it stops. */
export function shouldAutoAdvance(contested: boolean): boolean {
  return !contested;
}
