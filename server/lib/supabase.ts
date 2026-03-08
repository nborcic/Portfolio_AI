import { createServerClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import type { Context } from "hono";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSupabaseFromContext(c: Context) {
  const cookiesToSet: string[] = [];
  const cookieHeader = c.req.raw.headers.get("Cookie") ?? "";

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return Object.entries(parse(cookieHeader)).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSetInput) {
        cookiesToSetInput.forEach(({ name, value, options }) =>
          cookiesToSet.push(serialize(name, value, options))
        );
      },
    },
  });

  function setCookiesOnResponse(res: Response): Response {
    if (cookiesToSet.length === 0) return res;
    const newRes = new Response(res.body, { status: res.status, headers: res.headers });
    cookiesToSet.forEach((cookie) => newRes.headers.append("Set-Cookie", cookie));
    return newRes;
  }

  return { supabase, setCookiesOnResponse: setCookiesOnResponse };
}
