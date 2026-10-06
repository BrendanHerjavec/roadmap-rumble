import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Transcript } from "./types.ts";

export const TRANSCRIPT_DIR = join(process.cwd(), "data", "transcripts");

/**
 * Deliberately minimal frontmatter parsing — no YAML dependency. The source is
 * a folder of files today and could be a CRM export tomorrow; everything
 * downstream depends only on the `Transcript` shape, not on where it came from.
 */
function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value) as string;
      } catch {
        value = value.replace(/^"|"$/g, "");
      }
    }
    meta[key] = value;
  }

  return { meta, body: raw.slice(end + 4).trimStart() };
}

/** Pulls out the customer's turns. Rep lines are noise for request extraction. */
function customerTurns(body: string, contact: string): string[] {
  const turns: string[] = [];
  for (const line of body.split("\n")) {
    const m = /^\*\*(.+?):\*\*\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, speaker, text] = m;
    if (speaker.startsWith(contact) && text) turns.push(text);
  }
  return turns;
}

export function loadTranscripts(dir: string = TRANSCRIPT_DIR): Transcript[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.map((file) => {
    const raw = readFileSync(join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const contact = meta.contact ?? "";

    return {
      callId: meta.call_id ?? file.replace(/\.md$/, ""),
      company: meta.company ?? "Unknown",
      industry: meta.industry ?? "",
      segment: meta.segment ?? "",
      date: meta.date ?? "",
      rep: meta.rep ?? "",
      contact,
      contactTitle: meta.contact_title ?? "",
      stage: meta.stage ?? "",
      outcome: (meta.deal_outcome ?? "open") as Transcript["outcome"],
      dealSizeUsd: Number(meta.deal_size_usd ?? 0),
      lostReason: meta.lost_reason ?? "",
      body,
      customerTurns: customerTurns(body, contact),
      sourceFile: file,
    };
  });
}
