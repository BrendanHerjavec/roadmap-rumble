"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Champion } from "@/components/champion/Champion";
import { standings } from "@/lib/game/pairing";
import type { ChampionRow, MatchupRow } from "@/lib/supabase/types";

/**
 * The tournament, drawn as a bracket.
 *
 * ## Why it isn't a knockout tree
 *
 * This game is Swiss, deliberately: nothing is eliminated, so every champion
 * plays in every round and there are as many matchups in round 5 as in round 1.
 * A classic 16-8-4-2-1 Christmas tree is a different tournament format, and
 * drawing one here would be a picture of a tournament that didn't happen.
 *
 * So this borrows the *visual language* of a sports bracket — round groups,
 * matchup cards, winners lit up, connector lines between rounds — and applies
 * it to what Swiss actually produces. The convergence comes from ordering:
 * within each round, matchups are sorted by the final standing of their
 * strongest champion, so contenders lead each round and the winner's path is a
 * line you can follow from round 1 to the crown.
 *
 * ## Orientation
 *
 * "Across" is the canonical bracket: rounds as columns, left to right.
 * "Down" stacks rounds as rows instead.
 *
 * Rotating does *not* make the board smaller — the grid is 6 rounds by 8
 * matchups, so transposing turns the long axis the wrong way and at equal card
 * size it gets wider, not narrower. What it buys is that overflow becomes
 * ordinary vertical page scrolling rather than a nested horizontal scrollbar,
 * which is a much better thing to hand someone on the web. Cards narrow in
 * this mode so eight of them still fit across a normal viewport.
 *
 * ## Geometry
 *
 * Connector positions are measured from the DOM rather than computed from
 * assumed row heights: cards change height with champion names, and a bracket
 * whose lines miss their rows by four pixels looks broken in a way nothing else
 * on the page does. Measurements are divided by the current zoom so they stay
 * in unscaled board coordinates however the board is displayed.
 */

type Orientation = "across" | "down";

interface SeatInfo {
  el: HTMLElement;
  /** 0 = top champion of the card, 1 = bottom. */
  index: number;
}

interface Line {
  key: string;
  d: string;
  championId: string;
}

const CARD_GAP = 12;
const COL_GAP_ACROSS = 54;
const ROW_GAP_DOWN = 30;
const CARD_W_ACROSS = 208;
/** Narrower so eight matchups still fit across a normal viewport when stacked. */
const CARD_W_DOWN = 172;
/** Leaves room for the page header and a little breathing space below. */
const VIEWPORT_CHROME = 96;

const ORIENT_KEY = "roadmap-rumble:bracket-orientation";

export function BracketBoard({
  champions,
  matchups,
}: {
  champions: ChampionRow[];
  matchups: MatchupRow[];
}) {
  const table = standings(champions);
  const byId = new Map(champions.map((c) => [c.id, c]));
  const finalRank = new Map(table.map((c, i) => [c.id, i + 1]));

  const played = matchups
    .filter((m) => m.status === "resolved")
    .sort((a, b) => a.round - b.round || a.order_in_round - b.order_in_round);

  const rounds = [...new Set(played.map((m) => m.round))].sort((a, b) => a - b);

  const byRound = rounds.map((round) => ({
    round,
    matchups: played
      .filter((m) => m.round === round)
      .sort((x, y) => {
        const best = (m: MatchupRow) =>
          Math.min(finalRank.get(m.champion_a) ?? 99, finalRank.get(m.champion_b) ?? 99);
        return best(x) - best(y);
      }),
  }));

  const champion = table[0];

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef(new Map<string, SeatInfo>());
  const scaleRef = useRef(1);

  const [lines, setLines] = useState<Line[]>([]);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(true);
  const [orient, setOrientState] = useState<Orientation>("across");
  const [hover, setHover] = useState<string | null>(null);

  /**
   * Orientation persists across sessions.
   *
   * Defaults to "across" because that is what reads as a sports bracket — a
   * vertical stack looks more like a fixture list. Remembering an explicit
   * choice matters for a recorded demo: a second take should lay out exactly
   * like the first, not depend on how the window happened to be sized.
   *
   * Read in an effect rather than during render, so the server-rendered markup
   * and the first client render agree.
   */
  useLayoutEffect(() => {
    const stored = window.localStorage.getItem(ORIENT_KEY);
    if (stored === "across" || stored === "down") setOrientState(stored);
  }, []);

  const setOrient = useCallback((next: Orientation) => {
    setOrientState(next);
    try {
      window.localStorage.setItem(ORIENT_KEY, next);
    } catch {
      /* private browsing — the toggle still works for this session */
    }
  }, []);

  const across = orient === "across";
  const cardW = across ? CARD_W_ACROSS : CARD_W_DOWN;

  const setSeatRef = useCallback(
    (key: string, index: number, el: HTMLElement | null) => {
      if (el) seatRefs.current.set(key, { el, index });
      else seatRefs.current.delete(key);
    },
    [],
  );

  const measure = useCallback(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const s = scaleRef.current || 1;
    const base = boardEl.getBoundingClientRect();

    // Natural (unscaled) board size. Only commit a genuine change: the board is
    // observed for resizes and scaling changes its rendered size, so writing an
    // equal-but-new object would loop the observer against itself.
    const w = base.width / s;
    const h = base.height / s;
    setBoard((prev) =>
      Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h },
    );

    const seatsByChampion = new Map<string, string[]>();
    for (const { matchups: ms } of byRound) {
      for (const m of ms) {
        for (const cid of [m.champion_a, m.champion_b]) {
          const list = seatsByChampion.get(cid) ?? [];
          list.push(`${m.id}:${cid}`);
          seatsByChampion.set(cid, list);
        }
      }
    }

    const next: Line[] = [];
    for (const [championId, keys] of seatsByChampion) {
      for (let i = 0; i + 1 < keys.length; i++) {
        const from = seatRefs.current.get(keys[i]);
        const to = seatRefs.current.get(keys[i + 1]);
        if (!from || !to) continue;

        const p1 = exitPoint(from, base, s, across);
        const p2 = entryPoint(to, base, s, across);

        next.push({
          key: `${championId}-${i}`,
          championId,
          // Orthogonal elbows, the way a printed bracket does it.
          d: across
            ? `M ${p1.x} ${p1.y} H ${p1.x + (p2.x - p1.x) / 2} V ${p2.y} H ${p2.x}`
            : `M ${p1.x} ${p1.y} V ${p1.y + (p2.y - p1.y) / 2} H ${p2.x} V ${p2.y}`,
        });
      }
    }
    setLines(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchups, champions, across]);

  /**
   * Scale the board down until it fits, never up past 1:1.
   *
   * Idempotent and cheap on purpose, so it is safe to call after every render.
   * Relying on a single event source was fragile — a missed ResizeObserver
   * callback left the board stuck small after the window grew back, i.e. it
   * shrank but never recovered.
   */
  const refit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !fit || board.w === 0 || board.h === 0) return;
    const availW = viewport.clientWidth;
    // Stacked rounds are meant to scroll down the page, so only the width
    // constrains them — clamping height too would shrink it for no reason.
    const availH = across
      ? Math.max(320, window.innerHeight - VIEWPORT_CHROME)
      : Infinity;
    const next = Math.min(1, availW / board.w, availH / board.h);
    if (Math.abs(next - scaleRef.current) < 0.002) return;
    scaleRef.current = next;
    setScale(next);
  }, [fit, board.w, board.h, across]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (boardRef.current) ro.observe(boardRef.current);
    window.addEventListener("resize", measure);
    // Web fonts land after first paint and shift every row by a pixel or two,
    // which is exactly enough to make connectors look misaligned.
    void document.fonts?.ready.then(() => measure());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useLayoutEffect(() => {
    refit();
    // Watch the viewport element, not just the window: available width can
    // change without a window resize (a sidebar, devtools docking, split view).
    const ro = new ResizeObserver(() => refit());
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", refit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", refit);
    };
  }, [refit]);

  useLayoutEffect(() => {
    if (!fit) {
      scaleRef.current = 1;
      setScale(1);
    } else {
      refit();
    }
  }, [fit, refit]);

  // Belt and braces: re-check the fit after every render. `refit` no-ops unless
  // the answer actually changed, so this costs one division and cannot loop.
  useLayoutEffect(refit);

  if (!played.length) {
    return (
      <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-8 text-center text-sm text-white/40">
        No matchups have been played yet.
      </p>
    );
  }

  return (
    // Full-bleed: the bracket is the widest thing in the app and the results
    // page's reading column is far too narrow for it.
    <section className="relative left-1/2 w-screen -translate-x-1/2 px-6">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 pb-3">
        {/* The winner lives here rather than as a final column. It isn't part of
            the round grid — it's the outcome — and keeping it out of the scaled
            board means it never shrinks and the bracket itself is ~226px
            narrower, which is the difference between fitting at 1:1 and not on
            a lot of screens. */}
        {champion ? (
          <div
            className="flex items-center gap-3 rounded-2xl border border-ember-400/40 bg-ember-500/[0.09] py-2 pl-2 pr-4"
            onMouseEnter={() => setHover(champion.id)}
            onMouseLeave={() => setHover(null)}
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
              state={{ losses: champion.losses, rank: 1 }}
              size={68}
              instance="bracket-crown"
              pose="idle"
            />
            <span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.3em] text-ember-400">
                Top of the backlog
              </span>
              <span className="block text-base font-black uppercase italic leading-tight text-white">
                {champion.name}
              </span>
              <span className="tabular block text-[11px] text-ember-300">
                {champion.wins}–{champion.losses}
                {champion.draws ? `–${champion.draws}` : ""} ·{" "}
                {Math.round(champion.rating)} · hover to trace its run
              </span>
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={[
              { value: "across" as const, label: "Across" },
              { value: "down" as const, label: "Down" },
            ]}
            value={orient}
            onChange={setOrient}
          />
          <div className="flex gap-1 rounded-lg border border-white/[0.09] bg-white/[0.03] p-1">
            <Segmented
              bare
              options={[
                { value: true, label: "Fit" },
                { value: false, label: "100%" },
              ]}
              value={fit}
              onChange={setFit}
            />
            <span className="tabular self-center px-2 text-[10px] font-bold text-white/25">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-[1800px] pb-2 text-sm text-white/45">
        Swiss, not knockout — nobody is eliminated, so every champion appears in
        every round. Matchups lead with the strongest pairing, so contenders rise
        to the top of each round. Hover a champion to trace its run.
      </p>

      <div
        ref={viewportRef}
        className={`mx-auto max-w-[1800px] ${
          fit ? "overflow-hidden" : "overflow-x-auto"
        } pb-4`}
      >
        {/* Reserves the on-screen footprint of the scaled board. A CSS transform
            doesn't change layout size, so without this the container still
            believes it is the full unscaled width — which leaves a phantom
            scroll region and pushes the page below it around. */}
        <div
          style={{
            height: board.h * scale || undefined,
            width: board.w * scale || undefined,
            overflow: "hidden",
          }}
        >
          <div
            ref={boardRef}
            className={`relative inline-flex ${across ? "items-start" : "flex-col"}`}
            style={{
              gap: across ? COL_GAP_ACROSS : ROW_GAP_DOWN,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <svg
              width={board.w}
              height={board.h}
              className="pointer-events-none absolute left-0 top-0"
              aria-hidden="true"
            >
              {lines.map((l) => {
                const lit = hover === l.championId;
                const isChamp = champion && l.championId === champion.id;
                return (
                  <path
                    key={l.key}
                    d={l.d}
                    fill="none"
                    stroke={
                      lit
                        ? "var(--color-ember-400)"
                        : isChamp
                          ? "rgba(255,196,107,0.55)"
                          : "rgba(255,255,255,0.22)"
                    }
                    strokeWidth={lit ? 3 : isChamp ? 2.2 : 1.5}
                    strokeOpacity={hover !== null && !lit ? 0.25 : 1}
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>

            {byRound.map(({ round, matchups: ms }) => (
              <div key={round} className={across ? "shrink-0" : ""}>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
                  Round {round}
                </h3>
                <div
                  className={`flex ${across ? "flex-col" : "flex-row"}`}
                  style={{ gap: CARD_GAP }}
                >
                  {ms.map((m) => (
                    <MatchupCard
                      key={m.id}
                      matchup={m}
                      a={byId.get(m.champion_a)}
                      b={byId.get(m.champion_b)}
                      width={cardW}
                      hover={hover}
                      onHover={setHover}
                      setSeatRef={setSeatRef}
                    />
                  ))}
                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Connector anchors
 *
 * Across, a line leaves the right edge of a seat and enters the left edge of
 * the next — per-seat precision, because seats sit side by side horizontally.
 *
 * Down, seats are stacked *inside* a card, so leaving a seat's bottom edge
 * would draw straight through the other champion's row. Lines leave the card's
 * bottom edge instead, offset to a third or two-thirds across depending on
 * which seat the champion occupies, which keeps every champion's path distinct
 * without any line crossing a card it isn't about.
 * ------------------------------------------------------------------ */

function exitPoint(seat: SeatInfo, base: DOMRect, s: number, across: boolean) {
  const r = seat.el.getBoundingClientRect();
  if (across) {
    return { x: (r.right - base.left) / s, y: (r.top + r.height / 2 - base.top) / s };
  }
  const card = (seat.el.parentElement ?? seat.el).getBoundingClientRect();
  return {
    x: (card.left + card.width * (seat.index === 0 ? 0.32 : 0.68) - base.left) / s,
    y: (card.bottom - base.top) / s,
  };
}

function entryPoint(seat: SeatInfo, base: DOMRect, s: number, across: boolean) {
  const r = seat.el.getBoundingClientRect();
  if (across) {
    return { x: (r.left - base.left) / s, y: (r.top + r.height / 2 - base.top) / s };
  }
  const card = (seat.el.parentElement ?? seat.el).getBoundingClientRect();
  return {
    x: (card.left + card.width * (seat.index === 0 ? 0.32 : 0.68) - base.left) / s,
    y: (card.top - base.top) / s,
  };
}

function Segmented<T extends string | boolean>({
  options,
  value,
  onChange,
  bare,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  bare?: boolean;
}) {
  const inner = options.map((o) => (
    <button
      key={String(o.value)}
      onClick={() => onChange(o.value)}
      className={`rounded px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] transition ${
        value === o.value
          ? "bg-white/[0.10] text-white"
          : "text-white/35 hover:text-white/70"
      }`}
    >
      {o.label}
    </button>
  ));

  if (bare) return <>{inner}</>;
  return (
    <div className="flex gap-1 rounded-lg border border-white/[0.09] bg-white/[0.03] p-1">
      {inner}
    </div>
  );
}

function MatchupCard({
  matchup,
  a,
  b,
  width,
  hover,
  onHover,
  setSeatRef,
}: {
  matchup: MatchupRow;
  a?: ChampionRow;
  b?: ChampionRow;
  width: number;
  hover: string | null;
  onHover: (id: string | null) => void;
  setSeatRef: (key: string, index: number, el: HTMLElement | null) => void;
}) {
  if (!a || !b) return null;

  const involved = hover === a.id || hover === b.id;

  return (
    <div
      style={{ width }}
      className={`shrink-0 overflow-hidden rounded-xl border transition ${
        involved
          ? "border-ember-400/50 bg-pit-900"
          : matchup.contested
            ? "border-blood-500/40 bg-pit-900/70"
            : "border-white/[0.10] bg-pit-900/70"
      } ${hover !== null && !involved ? "opacity-45" : ""}`}
    >
      <Seat
        champion={a}
        index={0}
        votes={matchup.votes_a}
        won={matchup.winner === a.id}
        lost={Boolean(matchup.winner) && matchup.winner !== a.id}
        matchupId={matchup.id}
        hover={hover}
        onHover={onHover}
        setSeatRef={setSeatRef}
      />
      <div className="h-px bg-white/[0.08]" />
      <Seat
        champion={b}
        index={1}
        votes={matchup.votes_b}
        won={matchup.winner === b.id}
        lost={Boolean(matchup.winner) && matchup.winner !== b.id}
        matchupId={matchup.id}
        hover={hover}
        onHover={onHover}
        setSeatRef={setSeatRef}
      />
      {matchup.contested ? (
        <p className="bg-blood-500/20 px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-blood-400">
          {matchup.revote_of ? "re-vote · " : ""}room split
        </p>
      ) : null}
    </div>
  );
}

function Seat({
  champion,
  index,
  votes,
  won,
  lost,
  matchupId,
  hover,
  onHover,
  setSeatRef,
}: {
  champion: ChampionRow;
  index: number;
  votes: number | null;
  won: boolean;
  lost: boolean;
  matchupId: string;
  hover: string | null;
  onHover: (id: string | null) => void;
  setSeatRef: (key: string, index: number, el: HTMLElement | null) => void;
}) {
  const lit = hover === champion.id;

  return (
    <div
      ref={(el) => setSeatRef(`${matchupId}:${champion.id}`, index, el)}
      onMouseEnter={() => onHover(champion.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex cursor-default items-center gap-1.5 px-1.5 py-1 transition ${
        lit ? "bg-ember-500/25" : won ? "bg-white/[0.06]" : lost ? "opacity-60" : ""
      }`}
    >
      {/* A winner's bar, the way a bracket marks who advanced. */}
      <span
        className={`h-6 w-[3px] shrink-0 rounded-full ${
          won ? "bg-ember-400" : "bg-transparent"
        }`}
      />
      <Champion
        evidence={{
          featureKey: champion.feature_key,
          calls: champion.calls,
          lostDeals: champion.lost_deals,
          revenueAtStake: champion.revenue_at_stake,
          firstMentioned: champion.first_mentioned,
        }}
        name={champion.name}
        state={{ losses: champion.losses }}
        size={26}
        instance={`bracket-${matchupId}`}
        pose="still"
        className="shrink-0"
      />
      <span
        className={`min-w-0 flex-1 truncate text-[11.5px] leading-tight ${
          won ? "font-bold text-white" : "text-white/60"
        }`}
      >
        {champion.name}
      </span>
      <span
        className={`tabular shrink-0 text-[12px] font-black ${
          won ? "text-ember-300" : "text-white/35"
        }`}
      >
        {votes ?? "–"}
      </span>
    </div>
  );
}
