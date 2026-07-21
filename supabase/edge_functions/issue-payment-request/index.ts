import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("PAYMENT_ALLOWED_ORIGINS") ?? "").split(
  ",",
).map((v) => v.trim()).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:4200",
  "http://127.0.0.1:4200",
]);
const baseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const issueRates = new Map<string, { count: number; resetAt: number }>();
const withinIssueLimit = (key: string) => {
  const now = Date.now();
  const entry = issueRates.get(key);
  if (!entry || entry.resetAt <= now) {
    issueRates.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 10;
};
const respond = (
  origin: string,
  status: number,
  body: Record<string, unknown>,
) => {
  const headers = new Headers({
    ...baseHeaders,
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers,
  });
};
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join(
    "",
  );

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { error: "Request unavailable" });
  }
  try {
    const auth = request.headers.get("authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) {
      return respond(origin, 401, { error: "Request unavailable" });
    }
    if (!withinIssueLimit(userData.user.id)) {
      return respond(origin, 429, { error: "Payment request could not be created" });
    }
    const body = await request.json();
    const obligationIds = Array.isArray(body.obligationIds)
      ? body.obligationIds
      : [];
    const principalCents = Number(body.principalCents);
    const kind = String(body.kind ?? "");
    const commandKey = String(body.commandKey ?? crypto.randomUUID());
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = b64url(tokenBytes);
    const digest = hex(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    );
    const keyBytes = Uint8Array.from(
      atob(Deno.env.get("PAYMENT_TOKEN_ENCRYPTION_KEY")!),
      (c) => c.charCodeAt(0),
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      "AES-GCM",
      false,
      ["encrypt"],
    );
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(token),
    );
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await service.rpc("issue_payment_request", {
      p_obligation_ids: obligationIds,
      p_principal_cents: principalCents,
      p_kind: kind,
      p_token_digest: digest,
      p_token_ciphertext: b64url(new Uint8Array(ciphertext)),
      p_token_iv: b64url(iv),
      p_token_key_version: Deno.env.get("PAYMENT_TOKEN_KEY_VERSION") ?? "v1",
      p_command_key: commandKey,
    });
    if (error) throw error;
    const paymentRequestId = String(data?.paymentRequestId ?? "");
    const initialDelivery = paymentRequestId
      ? await service.from("payment_message_deliveries")
        .select("payment_message_delivery_id")
        .eq("payment_request_id", paymentRequestId)
        .eq("delivery_kind", "initial_request")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      : { data: null, error: null };
    if (initialDelivery.error) throw initialDelivery.error;
    const initialDeliveryId = String(
      initialDelivery.data?.payment_message_delivery_id ?? "",
    );
    const dispatch = initialDeliveryId
      ? await fetch(
        `${url}/functions/v1/process-payment-messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "x-cron-secret": Deno.env.get("PAYMENT_CRON_SECRET") ?? "",
          },
          body: JSON.stringify({ requestedDeliveryId: initialDeliveryId }),
        },
      ).catch(() => null)
      : null;
    const dispatchReport = dispatch
      ? await dispatch.json().catch(() => null) as {
        accepted?: number;
        failed?: number;
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
    const deliveryResult = dispatchReport?.results?.find(
      (result) => result.deliveryId === initialDeliveryId,
    );
    const deliveryDispatch = !dispatch?.ok ||
        (deliveryResult && deliveryResult.outcome !== "accepted")
      ? "failed"
      : deliveryResult?.outcome === "accepted"
      ? "processed"
      : "queued";
    const deliveryError = !initialDeliveryId
      ? "The payment request was created without an initial delivery record."
      : !dispatch
      ? "The payment email dispatcher could not be reached."
      : !dispatch.ok
      ? dispatchReport?.redactedError
        ?? `${dispatchReport?.error ?? "The payment email dispatcher failed"} (HTTP ${dispatch.status}).`
      : deliveryResult?.redactedError ?? null;
    if (deliveryDispatch === "failed") {
      console.error(JSON.stringify({
        function: "issue-payment-request",
        deliveryId: initialDeliveryId,
        outcome: deliveryResult?.outcome ?? "dispatcher_failed",
        failureClass: deliveryResult?.failureClass
          ?? dispatchReport?.failureClass
          ?? null,
        message: deliveryError,
      }));
    }
    return respond(origin, 200, {
      ...data,
      deliveryQueued: true,
      deliveryDispatch,
      deliveryError,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        function: "issue-payment-request",
        message: error instanceof Error ? error.message : "request failed",
      }),
    );
    return respond(origin, 400, {
      error: "Payment request could not be created",
    });
  }
});
