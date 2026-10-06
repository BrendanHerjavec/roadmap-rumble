import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * Re-runs a contested matchup after the room has argued about it.
 *
 * The re-vote is a *new* matchup rather than a reset of the old one, so the
 * original split and the arguments that followed it survive into the
 * disagreement log. Changing your mind after a discussion is the good outcome;
 * losing the evidence that you did would not be.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  await params;
  const db = serverSupabase();

  try {
    const { matchupId } = (await req.json()) as { matchupId?: string };
    if (!matchupId) {
      return NextResponse.json({ error: "matchupId is required." }, { status: 400 });
    }

    const { data, error } = await db.rpc("rr_create_revote", {
      p_matchup_id: matchupId,
    });
    if (error) throw error;

    const created = data as { id: string } | null;
    if (!created?.id) {
      return NextResponse.json({ error: "Could not queue a re-vote." }, { status: 500 });
    }

    const { error: openErr } = await db.rpc("rr_open_matchup", {
      p_matchup_id: created.id,
    });
    if (openErr) throw openErr;

    return NextResponse.json({ matchupId: created.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
