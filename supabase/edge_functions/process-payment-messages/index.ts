import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")
    .replaceAll("=", "");
const fromB64url = (value: string) =>
  Uint8Array.from(
    atob(
      value.replaceAll("-", "+").replaceAll("_", "/") +
        "===".slice((value.length + 3) % 4),
    ),
    (character) => character.charCodeAt(0),
  );
const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

const safeErrorMessage = (error: unknown) => {
  const candidate = error instanceof Error
    ? error.message
    : error && typeof error === "object"
    ? ["message", "details", "hint", "code"]
      .map((key) => (error as Record<string, unknown>)[key])
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" | ")
    : "Processor failed";
  return candidate
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/https?:\/\/\S+/g, "[redacted-url]")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[redacted-secret]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 240);
};

async function encryptNewToken() {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const keyBytes = Uint8Array.from(
    atob(Deno.env.get("PAYMENT_TOKEN_ENCRYPTION_KEY")!),
    (character) => character.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );
  return {
    token,
    digest: hex(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    ciphertext: b64url(new Uint8Array(encrypted)),
    iv: b64url(iv),
  };
}

async function decryptToken(
  ciphertext: string,
  iv: string,
  keyVersion: string,
) {
  const currentVersion = Deno.env.get("PAYMENT_TOKEN_KEY_VERSION") ?? "v1";
  const previousVersion = Deno.env.get("PAYMENT_TOKEN_PREVIOUS_KEY_VERSION") ??
    "";
  const encodedKey = keyVersion === currentVersion
    ? Deno.env.get("PAYMENT_TOKEN_ENCRYPTION_KEY")
    : keyVersion === previousVersion
    ? Deno.env.get("PAYMENT_TOKEN_PREVIOUS_ENCRYPTION_KEY")
    : null;
  if (!encodedKey) throw new Error("request token key version unavailable");
  const keyBytes = Uint8Array.from(
    atob(encodedKey),
    (character) => character.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "decrypt",
  ]);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(iv) },
    key,
    fromB64url(ciphertext),
  );
  return new TextDecoder().decode(clear);
}

async function sendMail(
  recipient: string,
  subject: string,
  html: string,
  deliveryId: string,
) {
  const envValue = (...names: string[]) =>
    names.map((name) => (Deno.env.get(name) ?? "").trim()).find(Boolean) ?? "";
  const domain = envValue("MG_DOMAIN", "MAILGUN_DOMAIN").toLowerCase();
  const apiKey = envValue("MG_API_KEY", "MAILGUN_API_KEY");
  const configuredFrom = envValue("MG_FROM_EMAIL", "MAILGUN_FROM");
  const replyTo = envValue("MG_TO_REPLY", "MAILGUN_REPLY_TO");
  const region = (envValue("MG_REGION") || "us").toLowerCase();
  if (!domain) throw new Error("MG_DOMAIN is not configured");
  if (!apiKey) throw new Error("MG_API_KEY is not configured");
  if (
    /^['\"]|['\"]$/.test(apiKey) || apiKey.includes("MG_API_KEY=") ||
    apiKey.includes("MAILGUN_API_KEY=")
  ) {
    throw new Error(
      "MG_API_KEY must contain only the raw Mailgun key value without quotes or a variable-name prefix",
    );
  }
  if (domain.includes("://") || domain.includes("/") || domain.includes("@")) {
    throw new Error("MG_DOMAIN must contain only the Mailgun sending domain");
  }
  if (!["us", "eu"].includes(region)) {
    throw new Error("MG_REGION must be either us or eu");
  }
  const configuredOrigin = envValue("MG_BASE_URL", "MAILGUN_API_ORIGIN") ||
    (region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net");
  const apiOrigin = configuredOrigin.replace(/\/+$/, "");
  if (!["https://api.mailgun.net", "https://api.eu.mailgun.net"].includes(apiOrigin)) {
    throw new Error("MG_BASE_URL is not an approved Mailgun API origin");
  }
  const form = new FormData();
  form.set(
    "from",
    configuredFrom ||
      `Black Begonia Florals <payments@${domain}>`,
  );
  form.set("to", recipient);
  form.set("subject", subject);
  form.set("html", html);
  if (replyTo) form.set("h:Reply-To", replyTo);
  form.set("v:delivery_id", deliveryId);
  form.set("o:tag", "project-payment");
  const response = await fetch(
    `${apiOrigin}/v3/${encodeURIComponent(domain)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${
          btoa(`api:${apiKey}`)
        }`,
      },
      body: form,
    },
  );
  const rawBody = await response.text().catch(() => "");
  const body = (() => {
    try {
      return JSON.parse(rawBody) as {
        id?: unknown;
        message?: unknown;
      };
    } catch {
      return {};
    }
  })();
  const statusGuidance = response.status === 401
    ? "Mailgun rejected the API credentials. Verify MG_API_KEY is an active Mailgun API key with sending permission for MG_DOMAIN, store only its raw value, and confirm MG_BASE_URL matches MG_REGION."
    : response.status === 403
    ? "Mailgun authenticated the key but it does not have permission to send for MG_DOMAIN."
    : response.status === 404
    ? "Mailgun could not find the sending domain at the configured regional API origin."
    : `Mailgun returned HTTP ${response.status}`;
  const providerMessage = typeof body.message === "string" && response.status !== 401
    ? body.message
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
      .replace(/https?:\/\/\S+/g, "[redacted-url]")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 240)
    : statusGuidance;
  return {
    ok: response.ok,
    status: response.status,
    id: typeof body.id === "string" ? body.id.replace(/[<>]/g, "") : "",
    message: providerMessage,
  };
}

serve(async (request) => {
  const cronSecret = Deno.env.get("PAYMENT_CRON_SECRET") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const serviceInvocation = serviceKey.length > 0 &&
    request.headers.get("authorization") === `Bearer ${serviceKey}`;
  const scheduledInvocation = cronSecret.length > 0 &&
    request.headers.get("x-cron-secret") === cronSecret;
  if (
    request.method !== "POST" || (!serviceInvocation && !scheduledInvocation)
  ) return new Response("Not found", { status: 404 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const report: {
    requestsCreated: number;
    claimed: number;
    accepted: number;
    failed: number;
    results: Array<{
      deliveryId: string;
      outcome: string;
      failureClass: string | null;
      redactedError: string | null;
    }>;
  } = { requestsCreated: 0, claimed: 0, accepted: 0, failed: 0, results: [] };
  let stage = "read_request";
  try {
    const requestBody = await request.json().catch(() => ({})) as {
      requestedDeliveryId?: unknown;
    };
    const requestedDeliveryId = typeof requestBody.requestedDeliveryId === "string"
      ? requestBody.requestedDeliveryId
      : "";
    if (!requestedDeliveryId) {
      stage = "refresh_project_statuses";
      await db.rpc("refresh_project_payment_statuses", {
        target_project_id: null,
      });
      const today = new Date();
      const cutoff = new Date(today.getTime() + 60 * 86400000).toISOString()
        .slice(0, 10);
      stage = "list_final_collection_projects";
      const projects = await db.from("projects").select("project_id").lte(
        "event_date",
        cutoff,
      ).gte("event_date", today.toISOString().slice(0, 10)).in("status", [
        "awaiting_deposit",
        "booked",
        "awaiting_final_payment",
      ]);
      if (projects.error) throw projects.error;
      for (const project of projects.data ?? []) {
        stage = "activate_final_collection";
        const activation = await db.rpc("activate_project_final_collection", {
          p_project_id: project.project_id,
        });
        if (activation.error || !activation.data?.eligible) continue;
        const active = await db.from("payment_requests").select(
          "payment_request_id,request_kind,principal_amount",
        ).eq("project_id", project.project_id).eq("status", "active").order(
          "created_at",
          { ascending: false },
        ).limit(1);
        if (
          active.data?.some((paymentRequest) =>
            paymentRequest.request_kind === activation.data.kind &&
            Math.round(Number(paymentRequest.principal_amount) * 100) ===
              Number(activation.data.principalCents)
          )
        ) continue;
        const token = await encryptNewToken();
        const issued = await db.rpc("issue_payment_request", {
          p_obligation_ids: activation.data.obligationIds,
          p_principal_cents: activation.data.principalCents,
          p_kind: activation.data.kind,
          p_token_digest: token.digest,
          p_token_ciphertext: token.ciphertext,
          p_token_iv: token.iv,
          p_token_key_version: Deno.env.get("PAYMENT_TOKEN_KEY_VERSION") ?? "v1",
          p_command_key: crypto.randomUUID(),
        });
        if (!issued.error) report.requestsCreated += 1;
      }
    }
    stage = requestedDeliveryId ? "claim_specific_delivery" : "claim_delivery_batch";
    const claimed = requestedDeliveryId
      ? await db.rpc("claim_specific_payment_delivery", {
        p_delivery_id: requestedDeliveryId,
      })
      : await db.rpc("claim_payment_deliveries", { p_limit: 25 });
    if (claimed.error) throw claimed.error;
    const deliveries = requestedDeliveryId
      ? claimed.data ? [claimed.data] : []
      : claimed.data ?? [];
    if (requestedDeliveryId && deliveries.length === 0) {
      stage = "read_targeted_delivery_state";
      const deliveryState = await db.from("payment_message_deliveries")
        .select("status,suppression_reason")
        .eq("payment_message_delivery_id", requestedDeliveryId)
        .maybeSingle();
      if (deliveryState.error) throw deliveryState.error;
      const outcome = String(deliveryState.data?.status ?? "not_found");
      const redactedError = outcome === "accepted"
        ? null
        : outcome === "suppressed"
        ? "The payment email was suppressed because no current billing recipient has a usable email address."
        : outcome === "not_found"
        ? "The requested payment delivery does not exist."
        : `The targeted payment delivery could not be claimed from status ${outcome}.`;
      report.results.push({
        deliveryId: requestedDeliveryId,
        outcome,
        failureClass: redactedError ? "targeted_delivery_not_claimed" : null,
        redactedError,
      });
      if (redactedError) report.failed += 1;
    }
    for (const delivery of deliveries) {
      report.claimed += 1;
      try {
        let subject = "Your Black Begonia payment update";
        let callToAction = "";
        if (
          ["initial_request", "deposit_reminder", "final_reminder"].includes(
            delivery.kind,
          )
        ) {
          if (!delivery.tokenCiphertext || !delivery.tokenIv) {
            throw new Error("active request token unavailable");
          }
          const token = await decryptToken(
            delivery.tokenCiphertext,
            delivery.tokenIv,
            String(delivery.tokenKeyVersion ?? ""),
          );
          const url = `${Deno.env.get("PAYMENT_PUBLIC_ORIGIN")}/pay/${
            encodeURIComponent(token)
          }`;
          subject = delivery.kind === "initial_request"
            ? "Your Black Begonia payment request"
            : "Reminder: your Black Begonia payment is due";
          callToAction = `<p><a href="${
            escapeHtml(url)
          }" style="display:inline-block;padding:12px 20px;background:#32261f;color:#fff;text-decoration:none;border-radius:6px">View payment options</a></p>`;
        } else if (delivery.kind === "receipt") {
          subject = "Black Begonia payment receipt";
        } else if (delivery.kind === "adjustment_notice") {
          subject = "Important Black Begonia payment adjustment";
        }
        const html =
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="font-size:24px">Black Begonia Florals</h1><p>${
            delivery.kind === "receipt"
              ? "We recorded your payment."
              : delivery.kind === "adjustment_notice"
              ? "An adjustment was recorded for your project payment."
              : "A project payment is ready."
          }</p><p><strong>Payment amount: ${
            money(Number(delivery.principalCents ?? 0))
          }</strong></p>${
            Number(delivery.customerFeeCents ?? 0)
              ? `<p>Processing fee: ${
                money(Number(delivery.customerFeeCents))
              }</p>`
              : ""
          }${callToAction}<p>If you have questions, reply to this email.</p></div>`;
        const result = await sendMail(
          String(delivery.recipientEmail),
          subject,
          html,
          String(delivery.deliveryId),
        );
        const outcome = result.ok
          ? "accepted"
          : result.status >= 500 || result.status === 429
          ? "temporary_failed"
          : "permanent_failed";
        await db.rpc("record_payment_delivery_outcome", {
          p_delivery_id: delivery.deliveryId,
          p_status: outcome,
          p_mailgun_message_id: result.id,
          p_failure_class: result.ok ? null : `mailgun_http_${result.status}`,
          p_redacted_error: result.ok
            ? null
            : result.message,
        });
        const failureClass = result.ok ? null : `mailgun_http_${result.status}`;
        report.results.push({
          deliveryId: String(delivery.deliveryId),
          outcome,
          failureClass,
          redactedError: result.ok ? null : result.message,
        });
        if (result.ok) {
          report.accepted += 1;
        } else {
          report.failed += 1;
          console.error(JSON.stringify({
            function: "process-payment-messages",
            deliveryId: String(delivery.deliveryId),
            outcome,
            failureClass,
            message: result.message,
          }));
        }
      } catch (error) {
        const redactedError = error instanceof Error
          ? error.message.slice(0, 180)
          : "Delivery state unknown";
        await db.rpc("record_payment_delivery_outcome", {
          p_delivery_id: delivery.deliveryId,
          p_status: "delivery_unknown",
          p_mailgun_message_id: "",
          p_failure_class: "processor_error",
          p_redacted_error: redactedError,
        });
        report.results.push({
          deliveryId: String(delivery.deliveryId),
          outcome: "delivery_unknown",
          failureClass: "processor_error",
          redactedError,
        });
        console.error(JSON.stringify({
          function: "process-payment-messages",
          deliveryId: String(delivery.deliveryId),
          outcome: "delivery_unknown",
          failureClass: "processor_error",
          message: redactedError,
        }));
        report.failed += 1;
      }
    }
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const redactedError = safeErrorMessage(error);
    const failureClass = `processor_${stage}`;
    console.error(
      JSON.stringify({
        function: "process-payment-messages",
        stage,
        failureClass,
        message: redactedError,
      }),
    );
    return new Response(JSON.stringify({
      error: "Processor failed",
      failureClass,
      redactedError,
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
});
