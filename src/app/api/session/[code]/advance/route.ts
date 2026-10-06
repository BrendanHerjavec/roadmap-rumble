import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { nextRoundPairs } from "@/lib/game/pairing";
import type { ChampionRow, MatchupRow, SessionRow } from "@/lib/supabase/types";

/**
 * Moves the session to the next matchup.
 *
 * Order of preference: the next pending matchup in this round, then a freshly
 * paired next round, then the end of the session. Pairing runs here rather than
 * in the host's browser so the schedule doesn't depend on whose tab is open.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const db = serverSupabase();

  try {
    const { data: sessionData, error: sErr } = await db
      .from("rr_sessions")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (sErr) throw sErr;
    if (!sessionData) {
      return NextResponse.json({ error: `No session ${code}.` }, { status: 404 });
    }
    const session = sessionData as SessionRow;

    const [{ data: mData, error: mErr }, { data: cData, error: cErr }] =
      await Promise.all([
        db
          .from("rr_matchups")
          .select("*")
          .eq("session_id", session.id)
          .order("round")
          .order("order_in_round"),
        db.from("rr_champions").select("*").eq("session_id", session.id),
      ]);
    if (mErr) throw mErr;
    if (cErr) throw cErr;

    const matchups = (mData ?? []) as MatchupRow[];
    const champions = (cData ?? []) as ChampionRow[];

    // Anything still open blocks the advance — close it first so no ballot is
    // silently dropped.
    const open = matchups.find((m) => m.status === "open");
    if (open) {
      await db.rpc("rr_resolve_matchup", { p_matchup_id: open.id });
    }

    const nextPending = matchups
      .filter((m) => m.status === "pending" && m.round === session.round)
      .sort((x, y) => x.order_in_round - y.order_in_round)[0];

    if (nextPending) {
      const { error } = await db.rpc("rr_open_matchup", {
        p_matchup_id: nextPending.id,
      });
      if (error) throw error;
      return NextResponse.json({ opened: nextPending.id, round: session.round });
    }

    // Round complete.
    const nextRound = session.round + 1;
    if (nextRound > session.total_rounds) {
      const { error } = await db.rpc("rr_finish_session", {
        p_session_id: session.id,
      });
      if (error) throw error;
      return NextResponse.json({ finished: true });
    }

    const pairs = nextRoundPairs(champions, matchups, nextRound);
    if (!pairs.length) {
      await db.rpc("rr_finish_session", { p_session_id: session.id });
      return NextResponse.json({ finished: true });
    }

    const { error: rErr } = await db.rpc("rr_create_round", {
      p_session_id: session.id,
      p_round: nextRound,
      p_pairs: pairs,
    });
    if (rErr) throw rErr;

    const { data: firstData, error: fErr } = await db
      .from("rr_matchups")
      .select("id")
      .eq("session_id", session.id)
      .eq("round", nextRound)
      .order("order_in_round")
      .limit(1)
      .maybeSingle();
    if (fErr) throw fErr;

    if (firstData) {
      const { error } = await db.rpc("rr_open_matchup", {
        p_matchup_id: (firstData as { id: string }).id,
      });
      if (error) throw error;
    }

    return NextResponse.json({ round: nextRound, matchups: pairs.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
