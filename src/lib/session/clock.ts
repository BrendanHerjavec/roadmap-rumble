"use client";

/**
 * Server time, as seen from this tab.
 *
 * Every clock in the game — the vote countdown, when the host closes voting,
 * the result hold, the discussion timer — is measured from a timestamp Postgres
 * wrote with `now()`. Comparing that against the local `Date.now()` assumes the
 * two clocks agree, and laptops drift: a machine 15 seconds fast sees every
 * 10-second voting window as already expired, so the host resolves each matchup
 * the instant it opens, with nobody having voted.
 *
 * So we estimate the offset and keep it as an interval rather than a number:
 *
 *   - The REST `Date` header (1s resolution) says the server read D at some
 *     point during the request, so offset is within [D - t1, D + 1000 - t0].
 *   - Every Realtime change carries `commit_timestamp`, and it can only arrive
 *     after it was committed, so offset >= commit - received.
 *
 * Intersecting the two gives a sub-second estimate that tightens as the
 * session runs. Until anything arrives the offset is zero, which is exactly
 * the old behaviour.
 */

let lower = -Infinity;
let upper = Infinity;
let syncing: Promise<void> | null = null;

function offset(): number {
  if (lower === -Infinity && upper === Infinity) return 0;
  if (lower === -Infinity) return upper - 500;
  if (upper === Infinity || upper < lower) return lower;
  return (lower + upper) / 2;
}

/** `Date.now()`, corrected to the database's clock. */
export function serverNow(): number {
  return Date.now() + offset();
}

/** Feed a Realtime payload's `commit_timestamp` in as it arrives. */
export function observeCommit(commitTimestamp: string | undefined): void {
  if (!commitTimestamp) return;
  const t = new Date(commitTimestamp).getTime();
  if (Number.isNaN(t)) return;
  lower = Math.max(lower, t - Date.now());
}

/** One-shot calibration against the REST endpoint's `Date` header. */
export function syncServerClock(): Promise<void> {
  syncing ??= calibrate();
  return syncing;
}

async function calibrate(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  // A few samples; the shortest round trip gives the tightest bound.
  for (let i = 0; i < 3; i++) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${url}/rest/v1/rr_sessions?select=id&limit=0`, {
        headers: { apikey: key },
        cache: "no-store",
      });
      const t1 = Date.now();
      const date = res.headers.get("date");
      if (!date) return;
      const d = new Date(date).getTime();
      lower = Math.max(lower, d - t1);
      upper = Math.min(upper, d + 1000 - t0);
    } catch {
      return;
    }
  }
}
