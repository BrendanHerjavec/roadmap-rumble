"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ChampionRow } from "@/lib/supabase/types";

/**
 * The case behind a champion.
 *
 * The art carries the quantitative comparison — who is bigger, better armoured,
 * better armed. This carries everything that comparison can't hold: the actual
 * problem, the argument against reading the headline numbers straight, the
 * verbatim customer lines, and which named deals died on it.
 *
 * That distinction is the reason this exists. A champion with $19k at stake and
 * a twig for a weapon can still be the right vote, but only if the room can see
 * *why*. Without this panel the game rewards whoever has the biggest sword,
 * which would make it a worse tool than the meeting it replaces.
 *
 * Deliberately does not show origin — mined or typed-in stays hidden until the
 * results screen.
 */
export function EvidenceDrawer({
  champion,
  side,
  open,
  onClose,
}: {
  champion: ChampionRow;
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
}) {
  const quotes = champion.evidence ?? [];
  const deals = champion.lost_deal_companies ?? [];

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className={`absolute bottom-0 z-30 w-[min(460px,42vw)] ${
            side === "left" ? "left-4" : "right-4"
          }`}
        >
          <div className="max-h-[62vh] overflow-y-auto rounded-2xl border border-white/12 bg-pit-900/95 p-5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-black uppercase italic leading-tight tracking-tight text-white">
                {champion.name}
              </h3>
              <button
                onClick={onClose}
                className="shrink-0 text-xs font-bold uppercase tracking-widest text-white/35 transition hover:text-white/80"
              >
                close
              </button>
            </div>

            <Section label="The problem">
              <p className="text-[13px] leading-relaxed text-white/75">
                {champion.problem || champion.description}
              </p>
            </Section>

            {champion.counterweight ? (
              <Section label="What the numbers don't say" tone="ember">
                <p className="text-[13px] leading-relaxed text-ember-300/90">
                  {champion.counterweight}
                </p>
              </Section>
            ) : null}

            {deals.length ? (
              <Section label={`Lost deals citing this (${deals.length})`} tone="blood">
                <ul className="space-y-1">
                  {deals.map((d) => (
                    <li
                      key={`${d.company}-${d.date}`}
                      className="flex items-baseline justify-between gap-3 text-[12px]"
                    >
                      <span className="truncate text-white/70">{d.company}</span>
                      <span className="tabular shrink-0 font-semibold text-blood-400">
                        ${Math.round(d.dealSizeUsd / 1000)}k
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : (
              <Section label="Lost deals citing this">
                <p className="text-[12px] italic text-white/35">
                  None. No deal has died on this.
                </p>
              </Section>
            )}

            {quotes.length ? (
              <Section label={`What customers said (${quotes.length})`}>
                <ul className="space-y-2.5">
                  {quotes.slice(0, 6).map((q) => (
                    <li key={q.callId} className="border-l-2 border-white/12 pl-3">
                      <p className="text-[12.5px] leading-relaxed text-white/70">
                        “{q.quote}”
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">
                        {q.company} · {q.date}
                      </p>
                    </li>
                  ))}
                </ul>
                {quotes.length > 6 ? (
                  <p className="mt-2 text-[11px] text-white/30">
                    +{quotes.length - 6} more calls
                  </p>
                ) : null}
              </Section>
            ) : (
              <Section label="What customers said">
                <p className="text-[12px] italic text-white/35">
                  Nothing in the corpus. This one stands on the argument in the room.
                </p>
              </Section>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function Section({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "ember" | "blood";
}) {
  const colour =
    tone === "ember"
      ? "text-ember-400"
      : tone === "blood"
        ? "text-blood-400"
        : "text-white/40";
  return (
    <section className="mt-4">
      <h4 className={`text-[10px] font-bold uppercase tracking-[0.22em] ${colour}`}>
        {label}
      </h4>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
