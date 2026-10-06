import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { nextRoundPairs, suggestedRounds } from "@/lib/game/pairing";
import { scriptedPairs } from "@/lib/game/demo-script";
import type { ChampionRow, SessionRow } from "@/lib/supabase/types";

/**
 * Starts a session: computes round 1 Swiss pairings and opens the first matchup.
 *
 * Pairing runs on the server rather than in a browser so the host's tab isn't
 * the source of truth for the schedule — any client can then just react to what
 * comes back over Realtime.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const db = serverSupabase();

  // `scripted` pins round 1 to the demo running order so a re-shoot reproduces
  // the same beats. Later rounds always fall back to Swiss.
  const scripted = await req
    .json()
    .then((b: { scripted?: boolean }) => b?.scripted === true)
    .catch(() => false);

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

    const { data: championData, error: cErr } = await db
      .from("rr_champions")
      .select("*")
      .eq("session_id", session.id);

    if (cErr) throw cErr;
    const champions = (championData ?? []) as ChampionRow[];

    if (champions.length < 4) {
      return NextResponse.json(
        { error: "Load at least 4 champions before starting." },
        { status: 400 },
      );
    }

    const pairs = scripted
      ? scriptedPairs(champions.map((c) => c.feature_key))
      : nextRoundPairs(champions, [], 1);

    if (!pairs.length) {
      return NextResponse.json({ error: "Could not pair the field." }, { status: 400 });
    }

    const { error: rErr } = await db.rpc("rr_create_round", {
      p_session_id: session.id,
      p_round: 1,
      p_pairs: pairs,
    });
    if (rErr) throw rErr;

    // Open the first matchup so every client has something to render the
    // instant the session flips to `running`.
    const { data: firstData, error: mErr } = await db
      .from("rr_matchups")
      .select("*")
      .eq("session_id", session.id)
      .eq("round", 1)
      .order("order_in_round")
      .limit(1)
      .maybeSingle();

    if (mErr) throw mErr;
    if (firstData) {
      const { error: oErr } = await db.rpc("rr_open_matchup", {
        p_matchup_id: (firstData as { id: string }).id,
      });
      if (oErr) throw oErr;
    }

    return NextResponse.json({
      round: 1,
      scripted,
      matchups: pairs.length,
      totalRounds: suggestedRounds(champions.length),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
