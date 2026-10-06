import { NextResponse } from "next/server";
import { readRoster } from "@/lib/roster";
import type { ChampionSeed } from "@/lib/supabase/types";

/**
 * The mined roster, shaped for `rr_seed_champions`.
 *
 * The mining output lives on disk (written by `npm run mine`) so the lobby can
 * load champions without the browser ever touching the Anthropic API, and so a
 * live session can't be derailed by a slow model call.
 */
export async function GET() {
  try {
    const roster = readRoster();

    const champions: ChampionSeed[] = roster.map((c) => ({
      featureKey: c.featureKey,
      name: c.name,
      description: c.description,
      calls: c.calls,
      lostDeals: c.lostDeals,
      revenueAtStake: c.revenueAtStake,
      firstMentioned: c.firstMentioned,
      origin: c.origin,
      submittedBy: c.submittedBy,
      problem: c.problem,
      counterweight: c.counterweight,
      evidence: c.evidence,
      lostDealCompanies: c.lostDealCompanies,
    }));

    return NextResponse.json({ champions });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
