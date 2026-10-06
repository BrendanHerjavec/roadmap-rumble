import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Still the anon key — route handlers here exist to keep orchestration (Swiss
 * pairing, commentary) off the client, not to gain privileges. Nothing in this
 * app needs the service role key, and the schema is written so it never will.
 */
export function serverSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
