# Roadmap Rumble

A live, multiplayer meeting game where a product and revenue team ranks candidate
features by voting on head-to-head matchups. Each candidate feature is a fighting
champion whose appearance is generated from the real evidence behind it.

Fictional product: **Northwind**, a team project management tool.

## Demo

[`roadmap-rumble-demo.mp4`](roadmap-rumble-demo.mp4) — a full 3:27 session: lobby,
the scripted opening three matchups including two split votes and a re-vote, the
evidence behind each champion, then the fast-forward to the final ranking, the
origin reveal and the bracket.

## Status

Steps 1–8 and 10 are complete. **Step 9 (the Blender asset kit) is the only
outstanding item**, and it is blocked rather than skipped — see below.

The game is playable end to end: host a room, load champions, add AI voters,
vote, watch the split stop the session, capture the arguments, and export the
ranked backlog and the disagreement log.

The schema is applied to a live Supabase project and the lobby has been driven
end to end in two browsers.

| Step | | |
|---|---|---|
| 1 | Scaffold, Supabase schema, 40 synthetic transcripts | done |
| 2 | Mining step producing candidate features | done |
| 3 | Champion composition system + gallery | done |
| 4 | Lobby: create/join, live roster, bots, start | done |
| 5 | Arena: face-off, evidence, vote, timer, simultaneous reveal | done |
| 6 | Swiss rounds, rating updates, live leaderboard reshuffle | done |
| — | Demo mode: scripted run with guaranteed beats | done |
| — | Champion art pass + fight animation | done |
| — | Pace controls and auto-advance | done |
| 7 | Split detection, discussion timer, argument capture | done |
| 8 | Results, origin reveal, CSV export, disagreement log | done |
| 9 | Blender asset kit | **blocked** — needs Blender running with the MCP addon |
| 10 | Commentary line, sound effects, mute toggle | done |

### Step 9, and what's blocked

The Blender kit is the one thing not built. `localhost:9876` refuses the
connection, so Blender isn't running with the MCP addon and I can't model or
render anything. The seam it plugs into is finished and waiting: flip
`ASSET_SOURCE` in `src/components/champion/Champion.tsx` to `"sprite"` and point
it at `/public/champions/`. Nothing above that file changes.

Two other things need your account rather than your code:

- **Commentary produces no line.** The route, the prompt and the fallback all
  work, but the Anthropic account is out of credits — the API returns
  `credit balance is too low`. The game degrades exactly as designed (no line,
  nothing broken) and will start writing commentary the moment the account has
  balance. `npm run mine -- --llm` hits the same wall.
- **The visuals are unverified by eye.** Everything here was checked through the
  DOM, the database and rasterised PNG contact sheets, because the preview pane
  in this environment doesn't composite frames. Nobody has actually *watched*
  the fight animation or the leaderboard reshuffle.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Open `/` to host or join a room, or `/gallery` to inspect the champions. The
gallery needs no configuration; the lobby needs Supabase.

To regenerate the data from scratch:

```bash
npm run seed:transcripts && npm run mine -- --offline && npm run verify:seed
```

### Environment

Copy `.env.local.example` to `.env.local`. Both variables are optional at this
stage:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required for the
  lobby. Use the **anon / publishable** key, never the service role key: the
  `NEXT_PUBLIC_` prefix ships its value to every browser. Run
  `supabase/schema.sql` in the SQL editor to create the tables.
- `ANTHROPIC_API_KEY` — switches mining to the LLM backend and, later, powers the
  between-matchup commentary line.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run seed:transcripts` | Regenerates the 40 synthetic sales calls |
| `npm run mine` | Mines transcripts into candidates. Anthropic if a key is set, else lexicon |
| `npm run mine -- --offline` | Forces the deterministic lexicon backend |
| `npm run mine -- --llm` | Forces the Anthropic backend, fails loudly if unavailable |
| `npm run verify:seed` | Asserts mining rediscovers the design and the engineered tensions hold |
| `npm run sheet` | Renders champion contact sheets to `public/dev/*.png` |
| `npm run sheet -- --dims` | One sheet per encoded dimension, sorted |
| `npm run sheet -- --state` | Scars, crowns, defeat poses, origin reveal |
| `npm run simulate:demo` | Replays the scripted run and asserts the beats hold |

## How the data works

The chain is `design -> transcripts -> mining -> champions`, and each link is
checkable.

**`src/lib/seed/design.ts`** is the ground truth: 18 candidate features with
target call counts, lost-deal counts, first-mention dates, and the phrasings
customers use. It is an input to transcript generation only — mining never
imports it.

**`npm run seed:transcripts`** allocates mentions and lost-deal citations across
40 calls so that every target is met exactly, then renders them as natural
conversation into `data/transcripts/`. Deterministic.

**`npm run mine`** reads those files back like a CRM export and rediscovers the
evidence. Two interchangeable backends:

- `lexicon` — matches distinctive customer phrasings to clusters. Offline,
  instant, reproducible. The default, because a live demo shouldn't depend on a
  network call.
- `anthropic` — Claude extracts requests per call in open text, then clusters the
  pooled labels and names them. This is the backend you'd point at a real CRM,
  where the vocabulary isn't known in advance.

Either way the **numbers are computed in plain code** from call metadata. Call
counts, lost-deal counts, and revenue are facts about the corpus; only the
reading of free text is delegated to a model.

**`npm run verify:seed`** closes the loop and asserts the guarantees:

- all 18 features come back with the exact designed call counts, lost-deal
  counts, and first-mention dates
- revenue at stake equals the summed ARR of the lost deals citing it
- 16 champions reach the arena: 12 mined, 4 typed in by a human
- **dimensions disagree**: Bulk Task Surgery appears in 24 calls to Single
  Sign-On's 9, but Single Sign-On is cited in 9 lost deals to its 1, and carries
  $2.63M against $31k
- **a close matchup exists**: Guest Passes leads on calls (22 v 11) while Audit
  Trail leads on lost deals and revenue (7 v 5, $2.17M v $553k) — neither
  dominates every dimension

### Where the human ideas come from

Six clusters fall below the 5-call surfacing threshold, so mining alone would
never raise them. Four of those are the ideas a person typed in before the
session — including one with two call mentions submitted by the CRO. Origin is
hidden for the entire session and revealed only on the results screen.

## The case behind a champion

The art encodes the **quantitative** evidence — who is bigger, better armoured,
better armed. That comparison is fast and honest, and it is not the whole story:
a feature with $19k at stake can matter more than one with $2.6M, and a room
needs somewhere to say so.

So every champion also carries prose, and the arena has a **"Why this matters"**
drawer per fighter:

- **The problem** — what actually breaks, in the customer's terms. "Nobody can
  answer who changed this" rather than "immutable change log".
- **What the numbers don't say** — the argument the headline counts can't hold.
  Deliberately arguable in *either* direction: Template Market's $19k hides an
  onboarding-time lever, while Permission Grid's $2.07M is partly double-counted
  against Single Sign-On and may not unblock the deal on its own. If every line
  advocated for its own champion the drawer would be decoration.
- **Lost deals citing this** — the named companies and their ARR.
- **What customers said** — verbatim quotes with company and date.

The quotes and lost-deal companies were always mined; they just had nowhere to
go. Two rules keep the drawer honest: nothing in it may reveal whether an idea
was mined or typed in (that stays hidden until the results screen), and no two
companies may be shown saying the same sentence — the transcript generator draws
each feature's phrasings from a corpus-wide pool, and mining drops repeats.

## How a champion is drawn

`src/lib/champion/traits.ts` maps evidence to appearance. Two rules keep it honest:

1. Every encoded trait is an **absolute** function of the evidence, never relative
   to the rest of the roster. A feature with 9 lost deals wears the same armour in
   every session, so champions stay comparable and reloading reproduces the
   identical character.
2. The seed derived from `featureKey` only drives **cosmetic** variation — face
   shape, cloth hue, whether there's a cape. It never touches an encoded
   dimension, or the art would start lying.

| Evidence | Appearance |
|---|---|
| Calls mentioning it | Overall scale and torso/limb bulk |
| Closed-lost deals citing it | Plate coverage and pauldron span |
| Revenue at stake | Weapon size and material, stick to glowing greatblade |
| Age in the backlog | Grey hair, cloth patches, grime, drained colour |
| Matchups lost this session | Scars and cracked armour, added live |
| Leaderboard position | Crown and glow on the top three |
| Origin | Hidden until results: circuit pattern (mined) or banner (human) |

`src/components/champion/Champion.tsx` is the composition layer, and it does not
care where the art comes from. Today the only source is procedural SVG; step 9
adds a `sprite` source that stacks pre-rendered Blender PNGs from
`/public/champions/` using the same trait indices. Swapping is a one-line change
in that file.

### What makes the figures read as drawn

Four levers, in rough order of impact:

- **A light silhouette outline.** One `feMorphology` dilate around the whole
  composed figure. It is deliberately *pale* — the first version used near-black,
  which is invisible against a near-black stage, so the champions had no edge at
  all. On this backdrop a sticker outline is what separates them from the void.
- **Chunky mascot proportions.** About 3.5 heads tall, oversized boots and
  gauntlets. Exaggeration reads as a decision; realistic proportions read as a
  default.
- **Hard-edged cel shading.** Three flat tones clipped to an angled terminator,
  not a gradient ramp. The terminator sits well off-centre — running it down the
  middle made every face look like a two-tone mask rather than a lit object.
- **A curated palette.** Ten hand-picked cloth colours instead of a free-running
  hue, which was producing muddy olives about a third of the time.

### Fight animation

The SVG is rigged: parts are grouped around explicit pivots (`rr-head`,
`rr-torso`, `rr-arm-front` at the shoulder, `rr-weapon` at the grip, `rr-cape`),
and all motion is CSS driven off `data-pose`, so posing costs nothing per frame
in React and two champions animate independently.

| Pose | What it does |
|---|---|
| `idle` | Breathing, head bob, weapon sway, cape drift. Always on, deliberately small |
| `strike` | Wind up, drive forward, weapon swings through |
| `hit` | Knocked back with a squash on the landing |
| `victory` | Weapon raised, two bounces |
| `defeat` | Held slump, head down, weapon dropped |
| `still` | All motion off — used by the PNG contact sheets |

`Arena` runs the choreography off a phase clock (`idle → clash → result →
settled`) rather than off the animations themselves, so it cannot desync: CSS
owns the motion, the clock owns the timing. A draw returns both champions to
idle, because two slumped figures read as "everyone lost".

Two things worth knowing if you touch this. Champion size lives on an **outer**
group, because the pose animations set `transform` on `.rr-figure` and a CSS
transform replaces the presentation attribute outright — sharing one group made
champions snap to full size on every strike. And `transform-box` is `view-box`,
not the default, because the pivots are authored in viewBox units.

## Server-authoritative voting

All objects are prefixed `rr_` so the schema can share a Supabase project with
other work without colliding.

`supabase/schema.sql` is written so clients can read game state but cannot write
any of it — every mutation goes through a `SECURITY DEFINER` function. Nothing
in the app ever needs the service role key.

`cast_vote` locks the matchup row, checks it is open, checks the voter belongs to
the session, checks the choice is one of the two champions, and relies on a
`unique (matchup_id, participant_id)` constraint so a double click or a second
browser window produces one ballot, not two. When the last participant votes it
resolves the matchup in the same transaction.

The `votes` table has RLS enabled and **no policies at all**, so the anon key
cannot read individual ballots even if a client tries. Tallies become visible
only when `resolve_matchup` copies them onto the matchup row — which is what
makes "votes reveal simultaneously" true rather than cosmetic.

This is a demo posture, not a production one: there are no accounts, and anyone
with a room code can call the RPCs. That is by design.

## Layout

```
data/transcripts/     40 generated sales calls, the pluggable ingestion source
data/candidates.json  full mining output, including below-threshold clusters
data/roster.json      the 16 champions the arena loads
public/dev/           contact sheets from `npm run sheet`
scripts/              seed, mine, verify, contact sheet
src/lib/seed/         design ground truth + call corpus (generation only)
src/lib/mining/       transcript parsing, lexicon, both mining backends, roster
src/lib/champion/     evidence -> traits -> palette
src/components/champion/  composition layer + procedural SVG source
supabase/schema.sql   tables, RLS, and the vote functions
```

## Pace, and how the session moves itself

Three presets, chosen in the lobby. The **rules never change — only the clocks**,
and bots scale their ballot delays to whatever window is set, so a shorter one
tightens everything rather than leaving the room waiting on an empty timer.

| Pace | Vote | Discussion | A round of 8 |
|---|---|---|---|
| Meeting | 20s | 3 min | ~3.5 min |
| Brisk | 10s | 90s | ~2 min |
| Blitz | 6s | 45s | ~80s |

A decided matchup advances on its own after a hold — 5 seconds at Meeting pace,
as the brief asks, scaled down for faster paces with a floor that still clears
the ~1.9s fight animation. **A contested matchup never auto-advances.** Stopping
is the entire point of it, so it waits for the host.

Measured on a Blitz run: 8 matchups in ~80s of running time, then Swiss round 2
paired and opened automatically.

### Skipping to the end

Two host controls in the arena, and the difference between them matters:

- **Fast-forward to results** plays every remaining matchup out server-side —
  real Swiss pairings, the same deterministic bot logic, the same
  `rr_cast_vote` / `rr_resolve_matchup` transactions, the same Elo. Only the
  humans abstain. A full 5-round session (39 matchups) completes in about 20
  seconds and lands on a ranking the room *would* have reached had it kept
  voting the way the bots do.
- **Stop here** finishes immediately with whatever has been played.

Stopping early after three matchups leaves thirteen champions unfought at 1500,
so the "final ranking" is close to alphabetical noise — fine for testing the
screen, useless as the closing shot of a video. Fast-forward exists because the
results screen is only worth showing when the numbers behind it are real.

A fast-forwarded 5-round session produced: all 16 champions played exactly 5
matchups, ratings spread 1421–1549, 6 contested matchups in the log — and **Bulk
Task Surgery, the most-requested feature in the corpus at 24 calls, finished
14th of 16** while Single Sign-On (9 calls, 9 lost deals) finished 4th. That is
the argument the whole game exists to make.

## Live standings

`src/components/arena/Leaderboard.tsx` slides in ~1.5s after each result — by
which point ratings have already moved — so the table visibly reshuffles rather
than appearing pre-sorted. Every row is a `layout` motion element, so React
reorders the list and motion tweens each row from its old position to its new
one. Nothing computes coordinates by hand; that would fight the layout engine.

## When the room splits

`ContestedPanel` is the point of the whole game. A lopsided vote shows its
result and moves on; a close one takes over the bottom of the arena, puts the
discussion clock on screen, and asks for one line per side. The clock counts
from when the matchup resolved rather than from when the panel mounted, so a
latecomer sees the same number as everyone else, and it runs *past* zero into
overtime instead of stopping — a discussion that needs another minute should get
one, and the host decides when it's done.

Arguments save as the host types and propagate to every client. A re-vote is a
**new** matchup rather than a reset, so the original split and the arguments
that followed it both survive into the disagreement log — changing your mind
after a discussion is the good outcome, losing the evidence that you did is not.

## The bracket

The results screen toggles between **Final ranking** and **The bracket**
(`src/components/results/BracketBoard.tsx`).

It is worth being precise about what this can and can't be. The game is Swiss,
deliberately — nothing is eliminated, so every champion plays in every round and
round 5 has exactly as many matchups as round 1. A classic 16-8-4-2-1 knockout
tree is a different tournament format, and drawing one would be a picture of a
tournament that didn't happen.

So the bracket borrows the *visual language* of a sports bracket and applies it
honestly: rounds as columns left to right, matchup cards with both champions,
the winner marked with a bar and lit up, contested matchups outlined in red,
orthogonal connector lines running between rounds, and a crown node at the end.

The convergence comes from **ordering**: within each round, matchups are stacked
by the final standing of their strongest champion, so contenders rise to the top
and the eventual winner's path is a line you can follow with your eye from
round 1 to the trophy. Hovering any champion traces its whole run — with 40
matchup cards and 64 connectors on screen, that is what makes it readable rather
than a thicket.

Connector geometry is **measured from the DOM** (`useLayoutEffect` +
`ResizeObserver`) rather than computed from assumed row heights. Cards change
height with champion names, and a bracket whose lines miss their rows by a few
pixels looks broken in a way nothing else on the page does. It re-measures once
`document.fonts.ready` resolves, because web fonts land after first paint and
shift every row by a pixel or two — exactly enough to look misaligned.

### The winner isn't a column

The top champion sits in the toolbar, not as a final column in the grid. It
isn't part of the round structure — it's the outcome — and keeping it out of the
scaled board buys **226px of width** (1256px against 1482px). That is the
difference between fitting at 1:1 and having to shrink on a 1340px screen, and
it means the winner never scales down with everything else. Hovering it still
traces its run through the bracket.

### Across or down

An orientation toggle sits next to the zoom control. **Across** is the canonical
bracket, rounds as columns left to right. **Down** stacks rounds as rows.

Rotating does *not* make the board smaller, which is the counterintuitive bit:
the grid is 6 rounds by 8 matchups, so transposing turns the long axis the wrong
way and at equal card size it gets *wider*. Cards narrow to 172px in this mode
so eight still fit across.

What rotating actually buys is that overflow becomes ordinary **vertical page
scrolling** instead of a nested horizontal scrollbar, which is a far better
thing to hand someone on the web. Measured: 1460 × 843 natural, fits at 1:1, no
horizontal scroll, page scrolls down normally.

**Across is the default**, because rounds-as-columns is what reads as a sports
bracket — a vertical stack looks more like a fixture list. The choice is
remembered, which matters for a recorded demo: a second take should lay out
exactly like the first rather than depending on how the window was sized.

Connector routing differs by orientation, and has to. Across, a line leaves the
right edge of a seat and enters the left edge of the next — per-seat precision,
because seats sit side by side. Down, seats are stacked *inside* a card, so
leaving a seat's bottom edge would draw straight through the other champion's
row; lines leave the card's bottom edge instead, offset to a third or
two-thirds across depending on which seat the champion occupies. That keeps
every champion's path distinct without any line crossing a card it isn't about.

### Fitting it on screen

The first version was unreadable for three compounding reasons: it was ~2000px
wide inside the results page's 1100px reading column so you could only ever see
four of six rounds; the connectors were drawn at 10% white on a near-black
stage, which is effectively invisible; and there was no way to see the whole
board at once, which is the one thing a bracket is *for*.

Now it runs **full-bleed** at the viewport width, the columns are tighter
(1482px natural, so it fits at 1:1 on a normal desktop), the connectors are at
22% with the traced path at full ember, and everything that isn't the champion
you're hovering dims away.

Below about 1550px it **scales to fit** rather than scrolling, with a Fit / 100%
toggle and a live zoom badge. Three details make that work:

- Measurements are divided by the current zoom, so the SVG stays in unscaled
  board coordinates however the board is displayed.
- The wrapper reserves `board × scale` and clips. A CSS transform doesn't change
  layout size, so without that the container still believes it is full width and
  leaves a phantom scroll region.
- The fit is recomputed after every render, not only on resize events, and
  no-ops when the answer hasn't changed. Depending on a single event source left
  the board stuck small after the window grew back — it shrank but never
  recovered.

## What you take away

Two CSVs from the results screen (`src/lib/game/export.ts`):

- **Ranked backlog** — rank, feature, the problem, what the numbers don't say,
  origin, who submitted it, rating and record, all three evidence dimensions,
  the named lost deals with their ARR, and a representative customer quote.
- **Disagreement log** — every contested matchup, its split as a percentage,
  the outcome, both captured arguments, whether it was a re-vote, and each
  champion's evidence side by side.

The second one is the unusual artefact and the reason to play: a ranking with no
record of where the room divided is what you'd have got from a spreadsheet and
one loud person.

## Sound

Every cue is synthesised with WebAudio oscillators and filtered noise bursts, so
the repo ships no binary audio: nothing to license, host, preload, or get wrong,
and the cues stay in tune because they come from one scale. Vote lock, ballot,
reveal, clash, victory, and a deliberately unresolved tritone for a contested
result.

**Muted by default.** This gets opened in meetings and on shared screens, and
audio that starts on its own is the fastest way to make someone close the tab.
The unmute click doubles as the user gesture browsers require before an
AudioContext will run at all.

## Who drives the clock

There is no server process, so the host's browser tab casts the bots' ballots
and calls `rr_resolve_matchup` when the voting window elapses
(`src/lib/session/useHostOrchestrator.ts`). If the host closes their laptop the
round stalls — a deliberate proof-of-concept tradeoff, not a trust hole: the
host can only call the same RPCs as anyone else, and the database decides what
a vote counts for.

Both orchestrator effects are written to be safely re-runnable rather than
run-once. Each owns exactly the timers it created and cancels them on cleanup,
and their dependencies are primitives (ids, timestamps) rather than row objects
— Realtime hands the hook a fresh array on every event, so depending on object
identity would rebuild the timers constantly and restart the vote countdown
each time a ballot landed. Re-running is harmless because the RPCs are
idempotent.

## The AI voters

Five lenses on the same evidence, in `src/lib/game/bots.ts`:

| Bot | Bias | Reads |
|---|---|---|
| The CFO | `revenue` | Revenue at stake above everything |
| The Sales Lead | `risk` | Closed-lost deals |
| The PM | `demand` | How many customers actually asked |
| The New Hire | `recency` | Backs the newer idea |
| The Contrarian | `underdog` | Backs whoever is losing the session |

`demand` and `risk` exist because the seed data deliberately makes call volume
and lost deals disagree — each of those dimensions needs an advocate, or the
room has nobody to argue the "everyone asks for it" side against the "it costs
us deals" side.

**They are not single-issue voters, and that matters.** The first version had
each bot compare exactly one dimension, which meant two of three systematically
backed whichever champion was smaller and newer: Single Sign-On (9 calls, 9 lost
deals, $2.63M) tied 2–2 with AI Standup Digest (2 calls, 0 lost deals, $0) and
got flagged contested. If the room splits on the easy calls then "contested"
means nothing and the discussion timer — the actual product — fires constantly.

So a bot now scores both champions on the whole evidence base and applies its
bias on top (55% shared evidence, 45% bias). A champion stronger on everything
wins even from a hostile voter; disagreement only appears where the dimensions
genuinely conflict.

## Demo mode: the scripted run

A live Swiss round is right for a real meeting and useless for a video — the
pairings depend on ratings, so the interesting matchups land wherever they land
and a re-shoot is a different session. Ticking **Scripted demo run** in the
lobby pins round 1 to a fixed order (`src/lib/game/demo-script.ts`):

| # | Matchup | Beat |
|---|---|---|
| 1 | Permission Grid v Dark Mode | Teaches the visual language: plate, helm and a greatsword against a small unarmoured figure |
| 2 | Bulk Task Surgery v Single Sign-On | The dimension clash — the biggest champion on the board carries a twig and loses to the deal-killer |
| 3 | Guest Passes v Audit Trail | The contested vote. Demand (22 calls v 11) against money and lost deals ($2.17M v $553k) |

It scripts the **pairings, never the votes** — bots decide for themselves and
the host votes for real. Rounds 2+ go back to Swiss.

```bash
npm run simulate:demo
```

replays the bots against the real roster and checks both ways the host could
vote, because the host's ballot is the only free variable. A matchup only counts
as a guaranteed split if it lands under the threshold either way. Verified live:

| # | Matchup | Predicted | Actual |
|---|---|---|---|
| 1 | Permission Grid v Dark Mode | 6–0 clear | 6–0 clear |
| 2 | Bulk Task Surgery v Single Sign-On | 2–4 contested | 2–4 contested |
| 3 | Guest Passes v Audit Trail | 3–3 contested | 3–3 contested |

The script is tuned against all five bots. The lobby refuses to pretend
otherwise — turn the toggle on with bots missing and it tells you the contested
vote isn't guaranteed, and offers to add them.
