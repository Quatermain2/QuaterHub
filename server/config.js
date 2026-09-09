// Configure only the dedicated headquarters project. No shared database fallback.
export const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
export const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'';
