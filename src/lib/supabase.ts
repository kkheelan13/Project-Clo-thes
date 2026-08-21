import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The project URL, with any API path stripped.
 *
 * Supabase's Data API settings page shows the REST endpoint --
 * `https://<project>.supabase.co/rest/v1` -- right next to the project URL, and
 * it is the easier of the two to copy. Pasting it sends every auth call to
 * `/rest/v1/auth/v1/...`, which the gateway answers with "Invalid path
 * specified in request URL". A project URL never has a path, so anything after
 * the host is a paste error rather than a choice.
 */
function projectUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;
  return trimmed.replace(/\/(rest|auth|storage|realtime)\/v\d+$/, '');
}

const url = projectUrl(import.meta.env.VITE_SUPABASE_URL);
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** True when the app has been pointed at a Supabase project. */
export const cloudConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
