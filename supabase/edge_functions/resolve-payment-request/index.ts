import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("PAYMENT_ALLOWED_ORIGINS") ?? "").split(",").map(
  (value) => value.trim(),
).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const attempts = new Map<string, { count: number; reset: number }>();
const headers = (origin: string) => {
  const result = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    result.set("Access-Control-Allow-Origin", origin);
  }
  return result;
};
const response = (origin: string, status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: headers(origin),
  });
const digest = async (token: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  ].map((value) => value.toString(16).padStart(2, "0")).join("");
const waitUntil = async (start: number) => {
  const remaining = 175 - (Date.now() - start);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
};
const allowed = (key: string) => {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + 300000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 30;
};

serve(async (request) => {
  const started = Date.now();
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return response(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return response(origin, 404, { state: "unavailable" });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!allowed(ip)) {
    await waitUntil(started);
    return response(origin, 429, { state: "unavailable" });
  }
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    let projection: unknown = { state: "unavailable" };
    if (token.length >= 40 && token.length <= 128) {
      const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const result = await client.rpc("resolve_payment_request_projection", {
        p_token_digest: await digest(token),
        p_attempt_id: body.attempt ?? null,
      });
      if (!result.error) projection = result.data ?? projection;
    }
    await waitUntil(started);
    return response(origin, 200, projection);
  } catch {
    await waitUntil(started);
    return response(origin, 200, { state: "unavailable" });
  }
});
