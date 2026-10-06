"use client";

/**
 * Who you are in a room.
 *
 * There is no auth. Identity is a participant row id kept in localStorage,
 * keyed by room code, so a refresh drops you back into the same seat instead of
 * spawning a second voter. Two tabs on the same machine therefore share one
 * ballot — which is correct, and the database enforces it anyway.
 */

const KEY = "roadmap-rumble:identity";

export interface Identity {
  sessionId: string;
  participantId: string;
  name: string;
  isHost: boolean;
}

type Store = Record<string, Identity>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Private browsing, quota, whatever — the session still works, you just
    // become a new participant on refresh.
  }
}

export function getIdentity(code: string): Identity | null {
  return read()[code.toUpperCase()] ?? null;
}

export function setIdentity(code: string, identity: Identity) {
  const store = read();
  store[code.toUpperCase()] = identity;
  write(store);
}

export function clearIdentity(code: string) {
  const store = read();
  delete store[code.toUpperCase()];
  write(store);
}

/** Remembers the display name across rooms so you only type it once. */
const NAME_KEY = "roadmap-rumble:name";

export function getRememberedName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function rememberName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* non-fatal */
  }
}
