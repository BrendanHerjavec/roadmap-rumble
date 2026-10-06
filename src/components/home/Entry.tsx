"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getRememberedName,
  rememberName,
  setIdentity,
} from "@/lib/session/identity";
import { Button } from "@/components/ui/Button";

/** Host a room, or join one with a code. No accounts, by design. */
export function Entry() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"host" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => setName(getRememberedName()), []);

  async function host() {
    setBusy("host");
    setError(null);
    try {
      rememberName(name);
      const { data, error } = await supabase().rpc("rr_create_session", {
        p_host_name: name || "Host",
      });
      if (error) throw error;

      const row = (data as { session_id: string; code: string; participant_id: string }[])[0];
      setIdentity(row.code, {
        sessionId: row.session_id,
        participantId: row.participant_id,
        name: name || "Host",
        isHost: true,
      });
      router.push(`/s/${row.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function join() {
    const room = code.trim().toUpperCase();
    if (room.length < 4) {
      setError("Room codes are four characters.");
      return;
    }
    setBusy("join");
    setError(null);
    try {
      rememberName(name);
      const { data, error } = await supabase().rpc("rr_join_session", {
        p_code: room,
        p_name: name || "Guest",
      });
      if (error) throw error;

      const row = (data as { session_id: string; participant_id: string }[])[0];
      setIdentity(room, {
        sessionId: row.session_id,
        participantId: row.participant_id,
        name: name || "Guest",
        isHost: false,
      });
      router.push(`/s/${room}`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes("No session with code")
          ? `No room called ${room}. Check the code and try again.`
          : msg,
      );
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <div className="max-w-md rounded-2xl border border-blood-500/30 bg-blood-500/[0.07] p-6 text-left">
        <h2 className="font-bold text-blood-400">Supabase isn&apos;t configured</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Add <code className="text-white/85">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-white/85">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="text-white/85">.env.local</code>, then restart the dev
          server. The champion gallery works without them.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-5">
      <label className="block text-left">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
          Your name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Priya"
          maxLength={24}
          className="mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-ember-400/60"
        />
      </label>

      <Button
        onClick={host}
        disabled={busy !== null}
        className="w-full"
      >
        {busy === "host" ? "Opening the arena…" : "Host a session"}
      </Button>

      <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.3em] text-white/25">
        <span className="h-px flex-1 bg-white/10" />
        or join
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="CODE"
          className="tabular w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-center text-2xl font-black tracking-[0.4em] text-white outline-none transition placeholder:text-white/20 focus:border-volt-400/60"
        />
        <Button variant="ghost" onClick={join} disabled={busy !== null}>
          {busy === "join" ? "…" : "Join"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-blood-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
