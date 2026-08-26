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

const headers = (origin: string) => {
  const value = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) value.set("Access-Control-Allow-Origin", origin);
  return value;
};
const respond = (origin: string, status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: headers(origin),
  });
const withinLimit = (userId: string) => {
  const now = Date.now();
  const current = rates.get(userId);
  if (!current || current.resetAt <= now) {
    rates.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 10;
};
const stripePost = async (
  path: string,
  form: URLSearchParams,
  idempotencyKey: string,
) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_RESTRICTED_KEY") ?? ""}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Stripe catalog request failed (${response.status})`);
  }
  return await response.json() as Record<string, unknown>;
};

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    return respond(origin, 404, { error: "Request unavailable" });
  }

  let service: ReturnType<typeof createClient<any>> | null = null;
  let definitionId = "";
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const caller = createClient<any>(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) return respond(origin, 401, { error: "Request unavailable" });
    const internal = await caller.rpc("is_internal_crm_user");
    if (internal.error || internal.data !== true) {
      return respond(origin, 403, { error: "Request unavailable" });
    }
    if (!withinLimit(userData.user.id)) {
      return respond(origin, 429, { error: "Catalog synchronization is temporarily unavailable" });
    }

    const body = await request.json() as Record<string, unknown>;
    definitionId = String(body["definitionId"] ?? "");
    const amountMinor = Number(body["amountMinor"]);
    const currency = String(body["currency"] ?? "").toUpperCase();
    const commandKey = String(body["commandKey"] ?? "");
    if (
      !/^[0-9a-f-]{36}$/i.test(definitionId)
      || !/^[0-9a-f-]{36}$/i.test(commandKey)
      || !Number.isSafeInteger(amountMinor)
      || amountMinor <= 0
      || amountMinor > 100_000_000
      || currency !== "USD"
    ) {
      return respond(origin, 400, { error: "Invalid catalog request" });
    }

    service = createClient<any>(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const definitionResult = await service.from("workshop_definitions")
      .select("workshop_definition_id,title,advertising_line,stripe_product_id")
      .eq("workshop_definition_id", definitionId).single();
    if (definitionResult.error || !definitionResult.data) {
      return respond(origin, 404, { error: "Workshop definition not found" });
    }
    const existingPrice = await service.from("workshop_stripe_price_versions")
      .select("*").eq("workshop_definition_id", definitionId)
      .eq("amount_minor", amountMinor).eq("currency", currency)
      .eq("state", "active").maybeSingle();
    if (existingPrice.error) throw existingPrice.error;
    if (existingPrice.data) {
      return respond(origin, 200, {
        productId: definitionResult.data.stripe_product_id,
        priceId: existingPrice.data.stripe_price_id,
        priceVersionId: existingPrice.data.workshop_stripe_price_version_id,
        reused: true,
      });
    }

    await service.from("workshop_definitions").update({
      stripe_catalog_state: "pending",
      stripe_catalog_error: null,
    }).eq("workshop_definition_id", definitionId);

    let productId = String(definitionResult.data.stripe_product_id ?? "");
    if (!productId) {
      const productForm = new URLSearchParams({
        name: String(definitionResult.data.title),
        description: String(definitionResult.data.advertising_line).slice(0, 500),
        "metadata[workshop_definition_id]": definitionId,
      });
      const product = await stripePost(
        "products",
        productForm,
        `workshop-product-${definitionId}`,
      );
      productId = String(product["id"] ?? "");
      if (!productId) throw new Error("Stripe product response was incomplete");
    }

    const priceForm = new URLSearchParams({
      product: productId,
      currency: currency.toLowerCase(),
      unit_amount: String(amountMinor),
      "metadata[workshop_definition_id]": definitionId,
      "metadata[command_key]": commandKey,
    });
    const price = await stripePost("prices", priceForm, commandKey);
    const priceId = String(price["id"] ?? "");
    if (!priceId) throw new Error("Stripe price response was incomplete");

    await service.from("workshop_stripe_price_versions")
      .update({ state: "inactive", deactivated_at: new Date().toISOString() })
      .eq("workshop_definition_id", definitionId).eq("state", "active");
    const versionResult = await service.from("workshop_stripe_price_versions")
      .insert({
        workshop_definition_id: definitionId,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        amount_minor: amountMinor,
        currency,
        state: "active",
        provider_created_at: new Date(Number(price["created"] ?? Date.now() / 1000) * 1000).toISOString(),
        created_by: userData.user.id,
      }).select("workshop_stripe_price_version_id").single();
    if (versionResult.error) throw versionResult.error;
    const definitionUpdate = await service.from("workshop_definitions").update({
      stripe_product_id: productId,
      stripe_catalog_state: "ready",
      stripe_catalog_error: null,
      updated_by: userData.user.id,
    }).eq("workshop_definition_id", definitionId);
    if (definitionUpdate.error) throw definitionUpdate.error;

    return respond(origin, 200, {
      productId,
      priceId,
      priceVersionId: versionResult.data.workshop_stripe_price_version_id,
      reused: false,
    });
  } catch (error) {
    if (service && definitionId) {
      const failed = await service.from("workshop_definitions").update({
        stripe_catalog_state: "failed",
        stripe_catalog_error: "Catalog provider synchronization failed.",
      }).eq("workshop_definition_id", definitionId);
      if (failed.error) {
        console.error(JSON.stringify({
          function: "manage-workshop-catalog",
          message: "failed to persist catalog failure state",
        }));
      }
    }
    console.error(JSON.stringify({
      function: "manage-workshop-catalog",
      message: error instanceof Error ? error.message : "catalog sync failed",
    }));
    return respond(origin, 502, { error: "Workshop catalog could not be synchronized" });
  }
});
