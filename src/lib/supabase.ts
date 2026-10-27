// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { type Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Al inyectar <Database>, todo el SDK sabrá exactamente qué tablas y campos existen
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);