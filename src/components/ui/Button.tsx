"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ember-500 text-pit-950 hover:bg-ember-400 shadow-[0_0_28px_-6px_rgba(255,122,26,0.65)]",
  ghost: "border border-white/15 bg-white/[0.04] text-white/85 hover:bg-white/10",
  danger: "border border-blood-500/40 bg-blood-500/10 text-blood-400 hover:bg-blood-500/20",
  quiet: "text-white/45 hover:text-white/80",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={
        "rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest transition " +
        "disabled:cursor-not-allowed disabled:opacity-40 " +
        `${VARIANTS[variant]} ${className}`
      }
    />
  );
}
