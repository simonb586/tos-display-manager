import { createClient } from '@supabase/supabase-js';

const runtimeEnv = import.meta.env || {};
const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL;
const supabaseKey = runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY || runtimeEnv.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
