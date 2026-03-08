#!/usr/bin/env node
/**
 * Create first invite (when no admin exists yet).
 * Usage: node scripts/seed-invite.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const token = randomBytes(32).toString("hex");
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const link = `${baseUrl}/auth?token=${token}`;

const { error } = await supabase.from("invites").insert({ token, created_by: null });
if (error) {
  console.error(error);
  process.exit(1);
}

console.log("Invite created. Send this link:");
console.log(link);
