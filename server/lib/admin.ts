import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_SECRET_KEY!;

export function createAdminClient() {
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}
