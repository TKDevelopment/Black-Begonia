import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("PAYMENT_ALLOWED_ORIGINS") ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const respond = (origin: string, status: number, body: Record<string, unknown>) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
};

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { error: "Request unavailable" });
  }
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return respond(origin, 401, { error: "Request unavailable" });

    const body = await request.json();
    const deliveryId = String(body.deliveryId ?? "");
    const reason = String(body.reason ?? "").trim();
    if (!deliveryId || !reason) {
      return respond(origin, 400, { error: "Delivery and retry reason are required" });
    }
    const retried = await caller.rpc("retry_payment_delivery", {
      p_delivery_id: deliveryId,
      p_reason: reason,
    });
    if (retried.error) throw retried.error;
    const retryId = String(retried.data?.payment_message_delivery_id ?? "");

    const dispatch = await fetch(`${url}/functions/v1/process-payment-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "x-cron-secret": Deno.env.get("PAYMENT_CRON_SECRET") ?? "",
      },
      body: JSON.stringify({ requestedDeliveryId: retryId }),
    }).catch(() => null);
    const report = dispatch
      ? await dispatch.json().catch(() => null) as {
        error?: string;
        failureClass?: string | null;
        redactedError?: string | null;
        results?: Array<{
          deliveryId?: string;
          outcome?: string;
          failureClass?: string | null;
          redactedError?: string | null;
        }>;
      } | null
      : null;
    const result = report?.results?.find((item) => item.deliveryId === retryId);
    const deliveryDispatch = !dispatch?.ok ||
        (result && result.outcome !== "accepted")
      ? "failed"
      : result?.outcome === "accepted"
      ? "processed"
      : "queued";
    const deliveryError = !dispatch
      ? "The payment email dispatcher could not be reached."
      : !dispatch.ok
      ? report?.redactedError
        ?? `${report?.error ?? "The payment email dispatcher failed"} (HTTP ${dispatch.status}).`
      : result?.redactedError ?? null;
    return respond(origin, 200, {
      ...retried.data,
      deliveryDispatch,
      deliveryError,
    });
  } catch (error) {
    console.error(JSON.stringify({
      function: "retry-payment-delivery",
      message: error instanceof Error ? error.message : "retry failed",
    }));
    return respond(origin, 400, { error: "Payment email retry failed" });
  }
});
