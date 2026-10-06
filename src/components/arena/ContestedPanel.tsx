"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase/client";
import { serverNow } from "@/lib/session/clock";
import { Button } from "@/components/ui/Button";
import type { ChampionRow, MatchupRow, SessionRow } from "@/lib/supabase/types";

/**
 * What happens when the room splits.
 *
 * This is the product. Everything else in the session exists to find this
 * moment: a matchup where the evidence genuinely points both ways, so the
 * meeting's time gets spent here instead of on the eleven matchups everybody
 * already agreed about.
 *
 * The panel is deliberately loud — it takes over the bottom of the arena, puts
 * a real countdown on screen, and asks for one line per side. Capturing the
 * argument is the point: a ranked backlog with no record of *why* the room
 * disagreed is the same artefact you'd have got from a spreadsheet.
 *
 * Arguments are stored on the matchup row, so everyone sees them appear as the
 * host types. Nobody but the host can edit them.
 */
export function ContestedPanel({
  session,
  matchup,
  a,
  b,
  isHost,
  onRevote,
  onMoveOn,
  busy,
}: {
  session: SessionRow;
  matchup: MatchupRow;
  a: ChampionRow;
  b: ChampionRow;
  isHost: boolean;
  onRevote: () => void;
  onMoveOn: () => void;
  busy: boolean;
}) {
  const [argA, setArgA] = useState(matchup.argument_a ?? "");
  const [argB, setArgB] = useState(matchup.argument_b ?? "");
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Non-hosts follow the host's text as it lands.
  useEffect(() => {
    if (isHost) return;
    setArgA(matchup.argument_a ?? "");
    setArgB(matchup.argument_b ?? "");
  }, [isHost, matchup.argument_a, matchup.argument_b]);

  function queueSave(nextA: string, nextB: string) {
    if (!isHost) return;
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase().rpc("rr_record_arguments", {
        p_matchup_id: matchup.id,
        p_argument_a: nextA,
        p_argument_b: nextB,
      });
      if (!error) setSaved(true);
    }, 500);
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const total = (matchup.votes_a ?? 0) + (matchup.votes_b ?? 0);
  const share = total ? Math.round((Math.max(matchup.votes_a ?? 0, matchup.votes_b ?? 0) / total) * 100) : 50;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, type: "spring", stiffness: 150, damping: 20 }}
      className="mt-4 rounded-2xl border border-blood-500/30 bg-blood-500/[0.06] p-5 [@media(max-height:900px)]:mt-2 [@media(max-height:900px)]:p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black uppercase italic tracking-tight text-blood-400">
            The room is split
          </h2>
          <p className="mt-0.5 text-[13px] text-white/55">
            {matchup.votes_a}–{matchup.votes_b}, a {share}% lean. This is the
            conversation worth having — capture what each side actually said.
          </p>
        </div>
        <DiscussionTimer
          startedAt={matchup.resolved_at}
          seconds={session.discussion_seconds}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 [@media(max-height:900px)]:mt-2.5">
        <ArgumentField
          label={`The case for ${a.name}`}
          accent="volt"
          value={argA}
          editable={isHost}
          onChange={(v) => {
            setArgA(v);
            queueSave(v, argB);
          }}
        />
        <ArgumentField
          label={`The case for ${b.name}`}
          accent="arc"
          value={argB}
          editable={isHost}
          onChange={(v) => {
            setArgB(v);
            queueSave(argA, v);
          }}
        />
      </div>

      {isHost ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 [@media(max-height:900px)]:mt-2.5">
          <Button variant="ghost" onClick={onRevote} disabled={busy} className="px-5 py-2.5">
            Re-vote this matchup
          </Button>
          <Button onClick={onMoveOn} disabled={busy} className="px-5 py-2.5">
            {busy ? "…" : "Move on"}
          </Button>
          <span className="text-[11px] text-white/35">
            {saved ? "Arguments saved to the disagreement log." : "Both lines end up in the export."}
          </span>
        </div>
      ) : (
        <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-white/35">
          The host is capturing the arguments
        </p>
      )}
    </motion.section>
  );
}

function ArgumentField({
  label,
  accent,
  value,
  editable,
  onChange,
}: {
  label: string;
  accent: "volt" | "arc";
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const ring = accent === "volt" ? "focus:border-volt-400/70" : "focus:border-arc-400/70";
  const text = accent === "volt" ? "text-volt-400" : "text-arc-300";

  return (
    <label className="block">
      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${text}`}>
        {label}
      </span>
      {editable ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={160}
          placeholder="One line. What did they actually argue?"
          className={`mt-1 w-full rounded-xl border border-white/12 bg-pit-950/50 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 ${ring}`}
        />
      ) : (
        <p className="mt-1 min-h-[42px] rounded-xl border border-white/[0.07] bg-pit-950/40 px-3 py-2.5 text-sm text-white/70">
          {value || <span className="text-white/25">…</span>}
        </p>
      )}
    </label>
  );
}

/**
 * Counts down from when the matchup resolved, not from when this mounted, so a
 * latecomer sees the same clock as everyone else. Runs past zero into overtime
 * rather than stopping — a discussion that needs another minute should get it,
 * and the host decides when it's done.
 */
function DiscussionTimer({
  startedAt,
  seconds,
}: {
  startedAt: string | null;
  seconds: number;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!startedAt) return;
    const endsAt = new Date(startedAt).getTime() + seconds * 1000;
    const tick = () => setLeft((endsAt - serverNow()) / 1000);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt, seconds]);

  const over = left < 0;
  const abs = Math.abs(left);
  const mm = Math.floor(abs / 60);
  const ss = Math.floor(abs % 60);

  return (
    <div className="text-right">
      <span
        className={`tabular block text-4xl font-black leading-none ${
          over ? "text-blood-400" : "text-white"
        }`}
      >
        {over ? "+" : ""}
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/35">
        {over ? "over time" : "to discuss"}
      </span>
    </div>
  );
}
