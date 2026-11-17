import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isValidSupabaseUrl = (url?: string): boolean => {
  if (!url) return false;
  return (
    url.startsWith('https://') &&
    !url.includes('your-project-id.supabase.co') &&
    url.length > 15
  );
};

const isValidAnonKey = (key?: string): boolean => {
  if (!key) return false;
  return key !== 'your-supabase-anon-public-key' && key.length > 20;
};

export const isSupabaseConfigured: boolean =
  isValidSupabaseUrl(envUrl) && isValidAnonKey(envAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(envUrl!, envAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const STORAGE_BUCKET = 'warehouse-docs';
