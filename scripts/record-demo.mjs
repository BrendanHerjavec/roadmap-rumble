// Drives a full Roadmap Rumble session in a Chrome window on the second
// monitor, paced for a voiceover. ffmpeg records the window separately.
import { chromium } from "playwright-core";

const URL_BASE = process.env.RR_URL ?? "http://localhost:3100";
const CDP = process.env.RR_CDP ?? "http://127.0.0.1:9333";
const HOST_NAME = process.env.RR_HOST ?? "Brendan";

const beat = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(60_000);

// Type at a human speed so the viewer can read along.
const type = async (loc, text, delay = 55) => {
  await loc.click();
  await loc.type(text, { delay });
};

// Clicking before the matchup is actually open drops the ballot silently, and a
// missing host vote changes whether a matchup lands contested — the whole beat.
const voteFor = async (name) => {
  const sel = `button[aria-label="Vote for ${name}"]`;
  // The matchup row exists a beat before it is open, so wait for a live button
  // rather than clicking into a disabled one and stalling the whole take.
  try {
    await page.locator(`${sel}:not([disabled])`).waitFor({ timeout: 20_000 });
  } catch {
    log(`NEVER VOTABLE: ${name}`);
    return;
  }
  await page.locator(sel).click({ timeout: 10_000 }).catch(() => log("click failed"));
  const locked = await page
    .getByText(/Locked in/i)
    .waitFor({ timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  log(`voted ${name} locked=${locked}`);
};

// Wait for the pair AND for voting to actually be open. Fixed pauses drift
// past a 10s window, and a missed host ballot changes which matchups split.
const waitForMatchup = async (a, b) => {
  await page.getByRole("button", { name: `Vote for ${a}` }).waitFor();
  await page.getByRole("button", { name: `Vote for ${b}` }).waitFor();
  await page.locator(`button[aria-label="Vote for ${a}"]:not([disabled])`).waitFor({ timeout: 45_000 });
  log(`matchup open: ${a} v ${b}`);
};

const waitForSplit = async () => {
  await page.getByText("The room is split").first().waitFor({ timeout: 40_000 });
  log("contested panel up");
};

/**
 * Open a champion's case and hold long enough to actually read it: the problem,
 * what the numbers don't say, the named lost deals and the customer quotes.
 * Done during a split, where no vote clock is running — a 10s voting window is
 * not enough time to read a drawer this dense.
 */
const showCase = async (idx) => {
  await page.getByRole("button", { name: "Why this matters" }).nth(idx).click();
  const drawer = page.locator("aside").filter({ hasText: "The problem" }).first();
  await drawer.waitFor({ timeout: 10_000 });
  await beat(4500);
  // Scroll inside the drawer to reach the verbatim quotes.
  await drawer.hover();
  await page.mouse.wheel(0, 260);
  await beat(4000);
  await page.mouse.wheel(0, -260);
  await beat(1200);
  await page.getByRole("button", { name: /^close$/i }).first().click();
  await drawer.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  await beat(900);
};

// Capture both sides of the argument, the way a host would in the meeting.
const argue = async (forA, forB) => {
  const boxes = page.getByPlaceholder("One line. What did they actually argue?");
  await beat(1200);
  await type(boxes.nth(0), forA);
  await beat(900);
  await type(boxes.nth(1), forB);
  await beat(2500);
};

log("opening home");
await page.goto(`${URL_BASE}/`, { waitUntil: "networkidle" });
await beat(3500);

await type(page.getByPlaceholder("Priya"), HOST_NAME);
await beat(900);
await page.getByRole("button", { name: "Host a session" }).click();

// --- lobby ---------------------------------------------------------------
await page.getByRole("button", { name: /Load 16 champions/i }).waitFor();
log("lobby");
await beat(3500); // room code on screen

for (const bot of ["The CFO", "The Sales Lead", "The PM", "The New Hire", "The Contrarian"]) {
  await page.locator("button", { hasText: bot }).first().click();
  await beat(750);
}
await beat(1800);

await page.getByRole("button", { name: /Load 16 champions/i }).click();
await page.getByText("16 in the arena").waitFor();
await beat(4000); // the field of champions

await page.locator("button", { hasText: "Brisk" }).first().click();
await beat(1200);
await page.locator('input[type="checkbox"]').check();
await beat(3000); // "Scripted demo run" explanation

await page.getByRole("button", { name: /Start the scripted run/i }).click();

// --- matchup 1: teaches the visual language ------------------------------
await waitForMatchup("Permission Grid", "Dark Mode");
await beat(1200);
await page.getByRole("button", { name: "Why this matters" }).first().click();
await beat(3500); // the evidence drawer
// The drawer overlays its own toggle, so close it with the drawer's Close.
await page.getByRole("button", { name: /^close$/i }).first().click();
await page.getByRole("button", { name: "Hide the case" }).waitFor({ state: "hidden" });
await beat(1200);
await voteFor("Permission Grid");
await beat(9000); // reveal, fight, standings slide in

// --- matchup 2: the dimension clash, contested ---------------------------
await waitForMatchup("Bulk Task Surgery", "Single Sign-On");
await beat(2500);
await voteFor("Bulk Task Surgery");
await waitForSplit();
await beat(3000);
// The split is where the drawer earns its place: read both cases, then argue.
await showCase(0);
await showCase(1);
await argue(
  "Twenty-four customers asked for it by name. Nothing else is close.",
  "Nine lost deals cited SSO. It is the only one costing us money today.",
);
await page.getByRole("button", { name: /^Move on$/ }).click();

// --- matchup 3: contested, then a re-vote --------------------------------
await waitForMatchup("Guest Passes", "Audit Trail");
await beat(2500);
await voteFor("Guest Passes");
await waitForSplit();
await beat(2500);
await argue(
  "Twenty-two calls, and every agency client hits the paywall on day one.",
  "Two point two million in lost deals, and audit is a hard compliance gate.",
);
await page.getByRole("button", { name: /Re-vote this matchup/i }).click();
log("re-vote queued");
await waitForMatchup("Guest Passes", "Audit Trail");
await beat(2000);
await voteFor("Audit Trail"); // changing your mind after the argument
await beat(9000);

// --- play the rest out ---------------------------------------------------
const ff = page.getByRole("button", { name: /Fast-forward to results/i });
if (await ff.isVisible().catch(() => false)) {
  await ff.click();
  log("fast-forwarding");
} else {
  const moveOn = page.getByRole("button", { name: /^Move on$/ });
  if (await moveOn.isVisible().catch(() => false)) await moveOn.click();
  await page.getByRole("button", { name: /Fast-forward to results/i }).click();
}

// --- results -------------------------------------------------------------
await page.getByText("The backlog, settled").waitFor({ timeout: 180_000 });
log("results");
await beat(5000);

// The champion that actually won this session, for the bracket trace later.
const winner = (await page.locator("ol li").first().innerText()).split("\n")[1]?.trim();
log(`winner: ${winner}`);

// Walk down the ranking slowly: the story is the order, not any one row.
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 220);
  await beat(1500);
}
await beat(2000);

// The disagreement log — the arguments typed during the session, kept.
const split = page.getByText("Where the room split").first();
if (await split.isVisible().catch(() => false)) {
  await split.scrollIntoViewIfNeeded();
  await beat(7000);
}

// Back to the ranking before revealing origins — the badges land on the rows
// at the top of the page, and a reveal nobody can see is a wasted beat.
const toTop = async () => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await beat(1800);
};
await toTop();
await beat(1500);

await page.getByRole("button", { name: /Reveal origins/i }).click();
log("origins revealed");
await beat(7000);

await page.getByRole("button", { name: /The bracket/i }).click();
await toTop();
await beat(5000);

// Trace the winner's whole run through the board.
if (winner) {
  // First match sits in the bracket board; the last one is the winner's name
  // down in the disagreement log, and hovering that scrolls the page off the board.
  const node = page.locator(`text=${winner} >> visible=true`).first();
  if (await node.isVisible().catch(() => false)) {
    await node.hover();
    await beat(6000);
  } else {
    log("no bracket node to trace");
    await beat(3000);
  }
}
await beat(6000);

log("done");
await browser.close().catch(() => {});
