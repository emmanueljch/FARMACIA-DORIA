import { createClient } from '@supabase/supabase-js';

// Estas variables las sacarás de tu panel de Supabase (Settings > API)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vpslfqulnmtidopxukcz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwc2xmcXVsbm10aWRvcHh1a2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTM3MjksImV4cCI6MjA5MzgyOTcyOX0.3X0yF5YbvSroUKkOaxVuUsMDJFDasNNOxuZo0nj3dXo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);