import Link from "next/link";
import { Entry } from "@/components/home/Entry";

export default function Home() {
  return (
    <main className="stage-bg grain relative min-h-screen overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-12 px-8 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-ember-400">
            Northwind
          </p>
          <h1 className="mt-3 text-7xl font-black uppercase italic leading-none tracking-tight text-white drop-shadow-[0_6px_0_rgba(227,92,5,0.35)]">
            Roadmap Rumble
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/60">
            Your backlog, as champions. The room votes. Where the vote splits,
            the meeting stops and argues — which is the whole point.
          </p>
        </div>

        <Entry />

        <Link
          href="/gallery"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-white/30 transition hover:text-white/70"
        >
          See the champion gallery →
        </Link>
      </div>
    </main>
  );
}
