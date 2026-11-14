import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  (secretKey || publishableKey)
);

export function isCloudMode(): boolean {
  return process.env.DATA_STORAGE_MODE === 'supabase' && isSupabaseConfigured;
}

// Server-side only: all cloud database queries execute via supabaseAdmin with secret/service key
export const supabaseAdmin = (isSupabaseConfigured && secretKey)
  ? createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
