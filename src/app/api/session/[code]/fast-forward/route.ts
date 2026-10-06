import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { botChoice } from "@/lib/game/bots";
import { nextRoundPairs } from "@/lib/game/pairing";
import type {
  BotBias,
  ChampionRow,
  MatchupRow,
  ParticipantRow,
  SessionRow,
} from "@/lib/supabase/types";

/**
 * Play out everything that's left, at once, then finish.
 *
 * Ending a session early leaves most champions unfought at 1500, so the "final
 * ranking" is mostly alphabetical noise — useless as the closing shot of a
 * video. This plays the remaining matchups for real instead of skipping them:
 * genuine Swiss pairings, the same deterministic bot logic the live game uses,
 * the same `rr_cast_vote` and `rr_resolve_matchup` transactions, the same Elo.
 * The only thing missing is the humans, who abstain.
 *
 * So the ranking you land on is one the room *would* have produced if it had
 * kept voting exactly as the bots do — not a fabricated one. It is still worth
 * being clear about that in the room, which is why the UI calls it a
 * fast-forward rather than a result.
 *
 * Bounded by the session's own `total_rounds` and a hard ceiling, because a
 * loop that opens matchups is not something to leave unguarded.
 */

const MAX_MATCHUPS = 200;

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

    if (session.status === "finished") {
      return NextResponse.json({ played: 0, finished: true });
    }

    const { data: pData, error: pErr } = await db
      .from("rr_participants")
      .select("*")
      .eq("session_id", session.id);
    if (pErr) throw pErr;

    const bots = ((pData ?? []) as ParticipantRow[]).filter(
      (p) => p.is_bot && p.bot_bias,
    );
    if (bots.length === 0) {
      return NextResponse.json(
        { error: "Fast-forward needs at least one AI voter to cast ballots." },
        { status: 400 },
      );
    }

    const champions = async () => {
      const { data, error } = await db
        .from("rr_champions")
        .select("*")
        .eq("session_id", session.id);
      if (error) throw error;
      return (data ?? []) as ChampionRow[];
    };

    const matchups = async () => {
      const { data, error } = await db
        .from("rr_matchups")
        .select("*")
        .eq("session_id", session.id)
        .order("round")
        .order("order_in_round");
      if (error) throw error;
      return (data ?? []) as MatchupRow[];
    };

    /** Opens a matchup, has every bot vote, then closes it. */
    async function play(matchupId: string) {
      await db.rpc("rr_open_matchup", { p_matchup_id: matchupId });

      // Fresh ratings each time: the underdog bot votes on who is *currently*
      // losing, so a stale snapshot would change how it behaves.
      const roster = await champions();
      const byId = new Map(roster.map((c) => [c.id, c]));

      const all = await matchups();
      const m = all.find((x) => x.id === matchupId);
      if (!m) return;

      const a = byId.get(m.champion_a);
      const b = byId.get(m.champion_b);
      if (!a || !b) return;

      for (const bot of bots) {
        await db.rpc("rr_cast_vote", {
          p_matchup_id: matchupId,
          p_participant_id: bot.id,
          p_choice: botChoice(bot.bot_bias as BotBias, a, b),
        });
      }

      // Humans abstain, so the room is never "complete" and cast_vote won't
      // auto-resolve. Close it explicitly.
      await db.rpc("rr_resolve_matchup", { p_matchup_id: matchupId });
    }

    let played = 0;
    let round = session.round;

    while (played < MAX_MATCHUPS) {
      const all = await matchups();

      const pending = all
        .filter((m) => m.status !== "resolved" && m.round === round)
        .sort((x, y) => x.order_in_round - y.order_in_round);

      if (pending.length > 0) {
        await play(pending[0].id);
        played++;
        continue;
      }

      // Round complete — pair the next one, or stop.
      const next = round + 1;
      if (next > session.total_rounds) break;

      const pairs = nextRoundPairs(await champions(), all, next);
      if (!pairs.length) break;

      const { error } = await db.rpc("rr_create_round", {
        p_session_id: session.id,
        p_round: next,
        p_pairs: pairs,
      });
      if (error) throw error;
      round = next;
    }

    const { error: fErr } = await db.rpc("rr_finish_session", {
      p_session_id: session.id,
    });
    if (fErr) throw fErr;

    return NextResponse.json({ played, rounds: round, finished: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
