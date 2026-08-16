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
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
const isToken = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 32 && value.length <= 256 &&
  /^[A-Za-z0-9_-]+$/.test(value);
const withinLimit = (key: string) => {
  const now = Date.now();
  const current = rates.get(key);
  if (!current || current.resetAt <= now) {
    rates.set(key, { count: 1, resetAt: now + 300_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 10;
};
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
    const token = body["token"];
    const commandKey = body["commandKey"];
    if (!isToken(token) || !isUuid(commandKey)) {
      return respond(origin, 200, { state: "unavailable" });
    }
    const db = createClient<any>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    if (command === "verify_request") {
      const result = await db.rpc("manage_workshop_personal_data", {
        p_action: "verify_request",
        p_payload: {
          verificationTokenDigest: await digest(token),
        },
        p_command_key: commandKey,
      });
      if (result.error || result.data?.state !== "verified") {
        return respond(origin, 200, { state: "unavailable" });
      }
      return respond(origin, 200, { state: "verified" });
    }
    if (command === "confirm_replacement_email") {
      const bookingToken = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const result = await db.rpc("manage_workshop_personal_data", {
        p_action: "confirm_replacement_email",
        p_payload: {
          replacementEmailTokenDigest: await digest(token),
          newStatusTokenDigest: await digest(bookingToken),
        },
        p_command_key: commandKey,
      });
      if (result.error || result.data?.state !== "completed") {
        return respond(origin, 200, { state: "unavailable" });
      }
      return respond(origin, 200, { state: "completed", bookingToken });
    }
    return respond(origin, 400, { state: "unavailable" });
  } catch {
    return respond(origin, 200, { state: "unavailable" });
  }
});
