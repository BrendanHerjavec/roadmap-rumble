import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * One line of colour between matchups.
 *
 * Deliberately server-side and deliberately optional. The session must never
 * wait on a model: the client fires this off after a result has already
 * resolved, and if it fails, is slow, or there's no API key, the arena simply
 * shows nothing extra. Commentary is garnish, and garnish that can block a live
 * meeting is a bug.
 *
 * The model is given the evidence and the actual vote, and told to be a dry
 * observer rather than a hype man — the joke is that a backlog is being decided
 * by combat, and overselling it would flatten that.
 */

const MODEL = "claude-sonnet-5";

interface Body {
  winner?: string;
  loser?: string;
  votesWinner?: number;
  votesLoser?: number;
  contested?: boolean;
  winnerEvidence?: { calls: number; lostDeals: number; revenue: number };
  loserEvidence?: { calls: number; lostDeals: number; revenue: number };
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ line: null });

  try {
    const b = (await req.json()) as Body;
    if (!b.winner || !b.loser) return NextResponse.json({ line: null });

    const money = (n?: number) =>
      n === undefined ? "?" : n >= 1_000_000 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;

    const client = new Anthropic({ apiKey: key });

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 90,
      system:
        "You are the commentator for Roadmap Rumble, where a product team ranks " +
        "backlog features by making them fight as champions. Write ONE sentence, " +
        "under 20 words, about the result just seen.\n\n" +
        "Voice: dry, observational, faintly amused that a roadmap is being " +
        "settled by combat. Never exclamation marks, never hype, never emoji. " +
        "The funniest thing available is usually the gap between the evidence " +
        "and the vote — lean on that. Reply with the sentence only.",
      messages: [
        {
          role: "user",
          content:
            `${b.winner} beat ${b.loser}, ${b.votesWinner}-${b.votesLoser}` +
            `${b.contested ? " (the room was split)" : ""}.\n` +
            `${b.winner}: ${b.winnerEvidence?.calls} calls, ` +
            `${b.winnerEvidence?.lostDeals} lost deals, ${money(b.winnerEvidence?.revenue)} at stake.\n` +
            `${b.loser}: ${b.loserEvidence?.calls} calls, ` +
            `${b.loserEvidence?.lostDeals} lost deals, ${money(b.loserEvidence?.revenue)} at stake.`,
        },
      ],
    });

    const line = res.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    return NextResponse.json({ line: line || null });
  } catch (err) {
    // Never surface this to the client — a failed commentary call must not look
    // like a broken game. Do log it though: swallowing it completely made an
    // expired-env dev server indistinguishable from a model that had nothing
    // to say.
    console.error("commentary failed:", (err as Error).message);
    return NextResponse.json({ line: null });
  }
}
