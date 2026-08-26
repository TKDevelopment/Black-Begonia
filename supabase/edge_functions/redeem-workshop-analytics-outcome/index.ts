import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("WORKSHOP_ALLOWED_ORIGINS") ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const rates = new Map<string, { count: number; resetAt: number }>();
const encoder = new TextEncoder();

const headers = (origin: string) => {
  const result = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) result.set("Access-Control-Allow-Origin", origin);
  return result;
};
const respond = (origin: string, status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: headers(origin),
  });
const withinLimit = (key: string) => {
  const now = Date.now();
  const current = rates.get(key);
  if (!current || current.resetAt <= now) {
    rates.set(key, { count: 1, resetAt: now + 300_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 20;
};
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { state: "unavailable" });
  }
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]
    ?.trim() ?? "unknown";
  if (!withinLimit(address)) {
    return respond(origin, 429, { state: "unavailable" });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const command = String(body["command"] ?? "");
    const rawGrant = body["analyticsOutcomeGrant"];
    if (
      !["redeem_analytics_outcome", "discard_analytics_outcome"].includes(command)
      || typeof rawGrant !== "string"
      || rawGrant.length < 32
      || rawGrant.length > 256
    ) {
      return respond(origin, 200, { state: "unavailable" });
    }
    const db = createClient<any>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const result = await db.rpc("manage_workshop_analytics_outcome", {
      p_action: command === "redeem_analytics_outcome" ? "redeem" : "discard",
      p_payload: { grantDigest: await digest(rawGrant) },
    });
    if (result.error || !result.data) {
      return respond(origin, 200, { state: "unavailable" });
    }
    if (command === "discard_analytics_outcome") {
      return respond(origin, 200, {
        state: result.data.state === "discarded" ? "discarded" : "unavailable",
      });
    }
    return result.data.state === "redeemed" && result.data.outcome
      ? respond(origin, 200, result.data.outcome)
      : respond(origin, 200, { state: "unavailable" });
  } catch {
    return respond(origin, 200, { state: "unavailable" });
  }
});
