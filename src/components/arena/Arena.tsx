"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/lib/supabase/client";
import { Champion } from "@/components/champion/Champion";
import { EvidencePanel } from "./EvidencePanel";
import { VoteBar } from "./VoteBar";
import { Timer } from "./Timer";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { Leaderboard } from "./Leaderboard";
import { ContestedPanel } from "./ContestedPanel";
import { MuteToggle } from "./MuteToggle";
import {
  initAudio,
  sfxClash,
  sfxContested,
  sfxReveal,
  sfxVictory,
  sfxVoteLock,
} from "@/lib/audio";
import { Button } from "@/components/ui/Button";
import { rankMap } from "@/lib/game/pairing";
import type { Pose } from "@/components/champion/ChampionSvg";
import type {
  CastVoteResult,
  ChampionRow,
  MatchupRow,
  ParticipantRow,
  SessionRow,
} from "@/lib/supabase/types";

/**
 * Fight timing, in milliseconds from the reveal.
 *
 * STRIKE_MS and CONTACT_FRAC mirror `rr-strike-*` in globals.css: the strike
 * runs 900ms and its contact keyframe sits at 46%. That fraction is the one
 * authored number here — everything downstream is measured from the frame the
 * weapons meet, so the reaction, the hitstop and the clash sfx can't drift apart
 * from the swing. If the strike keyframes move, move CONTACT_FRAC with them.
 */
const REVEAL_MS = 180;
const STRIKE_MS = 900;
const CONTACT_FRAC = 0.46;
const HIT_MS = 760;
/** Short enough to read as impact rather than as a dropped frame. */
const HITSTOP_MS = 90;
/**
 * Shake and flash deliberately outlast the freeze: the figures are moving again
 * while the camera is still settling, which is what stops the hitstop from
 * reading as a stall. Matches the 280ms `rr-impact-*` keyframes in globals.css.
 */
const IMPACT_FX_MS = 280;

const CONTACT_AT = REVEAL_MS + STRIKE_MS * CONTACT_FRAC;
const REACT_AT = CONTACT_AT + HITSTOP_MS;
/** The winner's swing resumes after the freeze and still owes its recovery. */
const CELEBRATE_AT = REVEAL_MS + STRIKE_MS + HITSTOP_MS;
const SETTLED_AT = REACT_AT + HIT_MS;
const BOARD_AT = SETTLED_AT + 120;

type Phase = "idle" | "clash" | "impact" | "react" | "celebrate" | "settled";

/**
 * The matchup screen.
 *
 * Layout follows the brief literally: the two champions and the split bar are
 * the largest things here, text is secondary, and the arena is a lit stage
 * against a dark backdrop so the characters pop. Champion A is mirrored so both
 * fighters' weapons point inward and the pair reads as a face-off rather than
 * two portraits.
 */
export function Arena({
  session,
  matchup,
  champions,
  participants,
  meId,
  isHost,
  onAdvance,
  onRevote,
  onFinish,
  onFastForward,
  advancing,
}: {
  session: SessionRow;
  matchup: MatchupRow;
  champions: ChampionRow[];
  participants: ParticipantRow[];
  meId: string;
  isHost: boolean;
  onAdvance: () => void;
  onRevote: () => void;
  onFinish: () => void;
  onFastForward: () => void;
  advancing: boolean;
}) {
  const a = champions.find((c) => c.id === matchup.champion_a);
  const b = champions.find((c) => c.id === matchup.champion_b);

  const [pending, setPending] = useState<string | null>(null);
  /**
   * Which champion's evidence drawer is open, if any. Keyed to the matchup it
   * was opened from: left open across an advance, it hangs over the next pair
   * — covering one of the two champions the room is about to vote on.
   */
  const [drawer, setDrawer] = useState<{ matchupId: string; side: "left" | "right" } | null>(null);
  const openDrawer = drawer?.matchupId === matchup.id ? drawer.side : null;
  const toggleDrawer = (side: "left" | "right") =>
    setDrawer((d) =>
      d?.matchupId === matchup.id && d.side === side ? null : { matchupId: matchup.id, side },
    );
  const setOpenDrawer = (side: "left" | "right" | null) =>
    setDrawer(side ? { matchupId: matchup.id, side } : null);
  /**
   * Ballot state is keyed to the matchup it belongs to, not just held loose in
   * the component. An earlier version stored the choice on its own and cleared
   * it from an effect when the matchup changed — which left a window where the
   * new matchup was already on screen but the old choice was still set, so the
   * guard below silently swallowed the first vote of every round. Deriving it
   * makes that state impossible to reach.
   */
  const [ballot, setBallot] = useState<{ matchupId: string; choice: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<{ matchupId: string; text: string } | null>(
    null,
  );

  const revealed = matchup.status === "resolved";
  const votable = matchup.status === "open";

  /**
   * Fight choreography.
   *
   * Both champions strike on the reveal, then the result lands: winner bounces
   * into a victory pose, loser takes the hit and slumps. Driven off a phase
   * clock rather than the animations themselves so it can't desync — CSS owns
   * the motion, this owns the timing.
   *
   * Every beat is derived from one number, CONTACT_AT, because the thing that
   * makes a blow read is the reaction landing on the same frame as the blow. An
   * earlier clock ran the reaction on a fixed 1080ms, roughly half a second
   * after the blades actually met, so the swing and the flinch read as two
   * unrelated events with dead air between them.
   */
  const [commentary, setCommentary] = useState<{ id: string; line: string } | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);

  useEffect(() => initAudio(), []);
  const [phase, setPhase] = useState<Phase>("idle");
  /** Shake and flash. Separate from `phase` because they outlive the freeze. */
  const [impact, setImpact] = useState(false);
  useEffect(() => {
    if (!revealed) {
      setPhase("idle");
      setImpact(false);
      setBoardOpen(false);
      return;
    }
    sfxReveal();
    const timers = [
      setTimeout(() => setPhase("clash"), REVEAL_MS),
      // Everything the contact frame owns fires together: the freeze, the
      // camera, and the sound — which used to play on the wind-up, before the
      // weapons were anywhere near each other.
      setTimeout(() => {
        setPhase("impact");
        setImpact(true);
        sfxClash();
      }, CONTACT_AT),
      setTimeout(() => setImpact(false), CONTACT_AT + IMPACT_FX_MS),
      setTimeout(() => setPhase("react"), REACT_AT),
      setTimeout(() => {
        setPhase("celebrate");
        if (matchup.contested) sfxContested();
        else sfxVictory();
      }, CELEBRATE_AT),
      // The loser holds a slump once the knock-back has played out.
      setTimeout(() => setPhase("settled"), SETTLED_AT),
      // Ratings have already moved by now, so the table reshuffles on entry.
      // Not on a split, though: the discussion needs both champions' evidence
      // on screen, and the board slides in over the right-hand one.
      ...(matchup.contested ? [] : [setTimeout(() => setBoardOpen(true), BOARD_AT)]),
    ];
    return () => timers.forEach(clearTimeout);
    // Re-runs per matchup: a new id restarts the sequence from idle.
  }, [revealed, matchup.id]);
  // Commentary is fetched after the result is already on screen and never
  // blocks anything. No key, slow response, or failure just means no line.
  useEffect(() => {
    if (!revealed || !matchup.winner) return;
    const w = champions.find((c) => c.id === matchup.winner);
    const l = champions.find(
      (c) => c.id === (matchup.winner === matchup.champion_a ? matchup.champion_b : matchup.champion_a),
    );
    if (!w || !l) return;

    let cancelled = false;
    void fetch("/api/commentary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        winner: w.name,
        loser: l.name,
        votesWinner: matchup.winner === matchup.champion_a ? matchup.votes_a : matchup.votes_b,
        votesLoser: matchup.winner === matchup.champion_a ? matchup.votes_b : matchup.votes_a,
        contested: matchup.contested,
        winnerEvidence: { calls: w.calls, lostDeals: w.lost_deals, revenue: w.revenue_at_stake },
        loserEvidence: { calls: l.calls, lostDeals: l.lost_deals, revenue: l.revenue_at_stake },
      }),
    })
      .then((r) => r.json())
      .then((d: { line?: string | null }) => {
        if (!cancelled && d.line) setCommentary({ id: matchup.id, line: d.line });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, matchup.id, matchup.winner]);

  const voted = ballot?.matchupId === matchup.id ? ballot.choice : null;
  const currentNotice = notice?.matchupId === matchup.id ? notice.text : null;
  const ranks = rankMap(champions);

  /**
   * A draw is not a defeat. Both champions clash and then return to idle, which
   * reads as "nobody won" far better than two slumped figures would.
   *
   * Only the loser breaks off on the contact frame. The winner rides its own
   * swing through the follow-through and celebrates out of it, which is what
   * gives the exchange a direction — two figures reacting identically read as a
   * draw no matter what the vote said.
   */
  const poseFor = (isWinner: boolean, isLoser: boolean): Pose => {
    switch (phase) {
      case "idle":
        return "idle";
      case "clash":
      case "impact":
        return "strike";
      case "react":
        return isLoser ? "hit" : "strike";
      case "celebrate":
        return isWinner ? "victory" : isLoser ? "hit" : "idle";
      case "settled":
        return isWinner ? "victory" : isLoser ? "defeat" : "idle";
    }
  };

  /** Both figures freeze together — the clash is one event, not two. */
  const hitstop = phase === "impact";

  const cast = useCallback(
    async (choiceId: string) => {
      if (voted || !votable) return;
      const forMatchup = matchup.id;

      setPending(choiceId);
      // Optimistic: the ballot is secret anyway, so showing "locked in"
      // immediately costs nothing and the RPC is the real arbiter.
      setBallot({ matchupId: forMatchup, choice: choiceId });
      sfxVoteLock();

      const { data, error } = await supabase().rpc("rr_cast_vote", {
        p_matchup_id: forMatchup,
        p_participant_id: meId,
        p_choice: choiceId,
      });

      setPending(null);

      const reject = (text: string, keepBallot = false) => {
        if (!keepBallot) {
          setBallot((b) => (b?.matchupId === forMatchup ? null : b));
        }
        setNotice({ matchupId: forMatchup, text });
      };

      if (error) return reject(error.message);

      const result = (data as CastVoteResult[])[0];
      if (result?.accepted) return;

      if (result?.reason === "already_voted") {
        reject("You've already voted on this one.", true);
      } else if (result?.reason === "matchup_not_open") {
        reject("Voting closed.");
      } else {
        reject(result?.reason ?? "Vote rejected.");
      }
    },
    [matchup.id, meId, voted, votable],
  );

  if (!a || !b) return null;

  const winnerId = matchup.winner;
  const loserId = winnerId ? (winnerId === a.id ? b.id : a.id) : null;

  // Exactly one viewport tall, never more. The arena is watched, not read: a
  // vote bar or a discussion timer below the fold is a control nobody knows is
  // there. Everything inside sizes off the space that's left instead of fixed
  // pixels, so the champions shrink to make room for the contested panel rather
  // than the page growing a scrollbar.
  return (
    <main className="stage-bg grain relative flex h-[100dvh] flex-col overflow-hidden">
      {/* The camera. Everything on the stage lives in here so the shake moves it
          as one piece, while the flat backdrop on <main> stays put — which is
          both what keeps an edge from ever being exposed, and what lets <main>'s
          existing overflow-hidden clip the excursion. Shaking <main> itself made
          the whole document horizontally scrollable for the duration. */}
      <div className={`relative flex min-h-0 flex-1 flex-col ${impact ? "rr-impact-shake" : ""}`}>
        {/* stage lighting */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[52vh]"
          style={{
            background:
              "radial-gradient(ellipse 55% 100% at 50% 108%, rgba(255,150,50,0.22), transparent 70%)",
          }}
        />

        {/* The blow-out, centred where the weapons meet rather than washing the
            whole frame — a flat white flash reads as a page error, a burst with a
            location reads as two things hitting each other in that spot. Mounted
            only while it runs, so every matchup restarts it cleanly. */}
        {impact ? (
          <div
            aria-hidden
            className="rr-impact-flash pointer-events-none absolute inset-0 z-40"
            style={{
              background:
                "radial-gradient(ellipse 46% 40% at 50% 46%, rgba(255,247,226,0.95), rgba(255,158,61,0.4) 42%, transparent 70%)",
            }}
          />
        ) : null}

        <TopBar
          session={session}
          matchup={matchup}
          revealed={revealed}
          paused={revealed}
          isHost={isHost}
          onFinish={onFinish}
          onFastForward={onFastForward}
          busy={advancing}
        />

        <div className="relative z-10 mx-auto flex w-full min-h-0 max-w-[1500px] flex-1 items-stretch justify-center gap-6 px-8">
          <Side
            champion={a}
            opponent={b}
            side="left"
            rank={ranks.get(a.id)}
            selected={voted === a.id}
            disabled={Boolean(voted) || !votable}
            pending={pending === a.id}
            onVote={() => cast(a.id)}
            pose={poseFor(winnerId === a.id, loserId === a.id)}
            hitstop={hitstop}
            drawerOpen={openDrawer === "left"}
            onToggleDrawer={() => toggleDrawer("left")}
          />

          <div className="flex shrink-0 flex-col items-center justify-center gap-3 pb-16">
            <span className="text-6xl font-black italic text-white/[0.08]">VS</span>
          </div>

          <Leaderboard
            champions={champions}
            open={boardOpen}
            highlight={[a.id, b.id]}
            onToggle={() => setBoardOpen((o) => !o)}
          />

          <Side
            champion={b}
            opponent={a}
            side="right"
            rank={ranks.get(b.id)}
            selected={voted === b.id}
            disabled={Boolean(voted) || !votable}
            pending={pending === b.id}
            onVote={() => cast(b.id)}
            pose={poseFor(winnerId === b.id, loserId === b.id)}
            hitstop={hitstop}
            drawerOpen={openDrawer === "right"}
            onToggleDrawer={() => toggleDrawer("right")}
          />

          <EvidenceDrawer
            champion={a}
            side="left"
            open={openDrawer === "left"}
            onClose={() => setOpenDrawer(null)}
          />
          <EvidenceDrawer
            champion={b}
            side="right"
            open={openDrawer === "right"}
            onClose={() => setOpenDrawer(null)}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-5xl shrink-0 px-8 pb-5">
          <VoteBar
            a={a}
            b={b}
            votesA={matchup.votes_a}
            votesB={matchup.votes_b}
            revealed={revealed}
            ballotsIn={matchup.votes_cast}
            voters={participants.length}
            contested={matchup.contested}
            threshold={session.lopsided_threshold}
          />

          {/* Collapses on a split: the panel directly below already says the
              room is divided, and on a short screen this row costs the
              champions height to repeat it. */}
          <div
            className={`flex items-center justify-center ${
              matchup.contested && !currentNotice ? "min-h-0" : "mt-3 min-h-[44px]"
            }`}
          >
            <AnimatePresence mode="wait">
              {currentNotice ? (
                <motion.p
                  key="notice"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-blood-400"
                >
                  {currentNotice}
                </motion.p>
              ) : revealed ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-6"
                >
                  <p className={`text-sm text-white/55 ${matchup.contested ? "hidden" : ""}`}>
                    {matchup.contested
                      ? ""
                      : winnerId
                        ? `${winnerId === a.id ? a.name : b.name} takes it.`
                        : "Dead heat."}
                  </p>
                  {/* A contested matchup gets its own panel below, with the
                      discussion timer and the controls. Two "next" buttons on
                      screen would invite skipping the part that matters. */}
                  {isHost && !matchup.contested ? (
                    <Button onClick={onAdvance} disabled={advancing} className="px-6 py-2.5">
                      {advancing ? "…" : "Next matchup"}
                    </Button>
                  ) : null}
                </motion.div>
              ) : voted ? (
                <motion.p
                  key="locked"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-sm font-semibold uppercase tracking-[0.25em] text-volt-400"
                >
                  Locked in — waiting for the room
                </motion.p>
              ) : (
                <motion.p
                  key="prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm uppercase tracking-[0.25em] text-white/35"
                >
                  Which one ships first?
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {revealed && commentary?.id === matchup.id ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 text-center text-[13px] italic text-ember-300/80"
            >
              &ldquo;{commentary.line}&rdquo;
            </motion.p>
          ) : null}

          {revealed && matchup.contested ? (
            <ContestedPanel
              session={session}
              matchup={matchup}
              a={a}
              b={b}
              isHost={isHost}
              onRevote={onRevote}
              onMoveOn={onAdvance}
              busy={advancing}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function TopBar({
  session,
  matchup,
  revealed,
  paused,
  isHost,
  onFinish,
  onFastForward,
  busy,
}: {
  session: SessionRow;
  matchup: MatchupRow;
  revealed: boolean;
  paused: boolean;
  isHost: boolean;
  onFinish: () => void;
  onFastForward: () => void;
  busy: boolean;
}) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-[1500px] items-center justify-between px-8 pt-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-ember-400">
          Round {matchup.round}
          {matchup.revote_of ? " · re-vote" : ""}
        </p>
        <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-white/30">
          Room {session.code} · round {session.round} of {session.total_rounds}
        </p>
        <div className="mt-2">
          <MuteToggle />
        </div>
        {isHost ? (
          <div className="mt-1.5 flex flex-col items-start gap-1">
            {/* Two genuinely different endings. Fast-forward plays the rest out
                so the final ranking means something; stopping now leaves most
                champions unfought at their starting rating. */}
            <button
              onClick={onFastForward}
              disabled={busy}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ember-400/70 transition hover:text-ember-300 disabled:opacity-40"
            >
              {busy ? "Playing it out…" : "Fast-forward to results"}
            </button>
            <button
              onClick={onFinish}
              disabled={busy}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20 transition hover:text-blood-400 disabled:opacity-40"
            >
              Stop here (partial ranking)
            </button>
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="h-[86px] w-[86px]" aria-hidden />
      ) : (
        <Timer
          openedAt={matchup.opened_at}
          seconds={session.vote_seconds}
          paused={paused}
        />
      )}
    </header>
  );
}

/**
 * One fighter's column. Takes a pose rather than an outcome — who won is the
 * parent's business, and keeping the decision there is what stops a second
 * interpretation of the result from growing down here.
 */
function Side({
  champion,
  opponent,
  side,
  rank,
  selected,
  disabled,
  pending,
  onVote,
  pose,
  hitstop,
  drawerOpen,
  onToggleDrawer,
}: {
  champion: ChampionRow;
  opponent: ChampionRow;
  side: "left" | "right";
  rank?: number;
  selected: boolean;
  disabled: boolean;
  pending: boolean;
  onVote: () => void;
  pose: Pose;
  hitstop: boolean;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}) {
  const left = side === "left";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-end gap-3 pb-1">
      {/* No keyframed motion on the wrapper. It used to bounce the winner and
          flinch the loser on their own 450ms delay, which ran during the swing
          and then again underneath the rig's own victory and hit poses — two
          clocks animating one figure, neither aware of the contact frame. The
          rig owns all of it now; the wrapper only fades the loser out. */}
      <button
        onClick={onVote}
        disabled={disabled}
        aria-label={`Vote for ${champion.name}`}
        className={`group relative flex min-h-[120px] flex-1 items-end justify-center rounded-3xl px-6 pb-2 pt-4 outline-none transition ${
          disabled ? "cursor-default" : "cursor-pointer hover:bg-white/[0.03]"
        } ${selected ? "ring-2 ring-volt-400/70" : ""}`}
      >
        {/* mirror the left fighter so both weapons point inward */}
        <div
          className="h-full transition-opacity duration-500"
          style={{
            transform: left ? "scaleX(-1)" : undefined,
            opacity: pose === "defeat" ? 0.72 : 1,
          }}
        >
          <Champion
            evidence={{
              featureKey: champion.feature_key,
              calls: champion.calls,
              lostDeals: champion.lost_deals,
              revenueAtStake: champion.revenue_at_stake,
              firstMentioned: champion.first_mentioned,
            }}
            name={champion.name}
            state={{
              losses: champion.losses,
              rank,
              // Single source of truth: the face follows the rig, not a
              // separate flag that could disagree with it mid-sequence.
              defeated: pose === "defeat",
            }}
            fit
            instance={`arena-${side}`}
            pose={pose}
            hitstop={hitstop}
          />
        </div>

        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-3xl bg-pit-950/40">
            <span className="text-xs uppercase tracking-[0.3em] text-white/70">
              casting…
            </span>
          </span>
        ) : null}

        {!disabled ? (
          <span className="pointer-events-none absolute inset-x-6 bottom-0 rounded-xl bg-white/[0.06] py-2 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-white/50 opacity-0 transition group-hover:opacity-100">
            Vote
          </span>
        ) : null}
      </button>

      <EvidencePanel champion={champion} opponent={opponent} align={left ? "right" : "left"} />

      <button
        onClick={onToggleDrawer}
        aria-expanded={drawerOpen}
        className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] transition ${
          drawerOpen
            ? "bg-white/12 text-white/85"
            : "text-white/35 hover:bg-white/[0.06] hover:text-white/70"
        }`}
      >
        {drawerOpen ? "Hide the case" : "Why this matters"}
      </button>
    </div>
  );
}
