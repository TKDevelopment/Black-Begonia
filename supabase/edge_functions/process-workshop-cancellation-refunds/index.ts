import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CancellationRefundJob {
  job_id: string;
  refund_request_id: string;
  command_key: string;
  provider_charge_id: string;
  amount_minor: number;
  currency: string;
  request_state: string;
  attempt_count: number;
}

const safeProviderValue = (value: unknown) =>
  typeof value === "string" ? value.replace(/[\r\n]/g, "").slice(0, 160) : null;

serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("WORKSHOP_MESSAGE_CRON_SECRET") ?? "";
  const serviceInvocation = serviceKey.length > 0 &&
    request.headers.get("authorization") === `Bearer ${serviceKey}`;
  const scheduledInvocation = cronSecret.length > 0 &&
    request.headers.get("x-cron-secret") === cronSecret;
  if (
    request.method !== "POST" || (!serviceInvocation && !scheduledInvocation)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedLimit = Number(body["batchLimit"] ?? 25);
  const batchLimit = Number.isSafeInteger(requestedLimit) &&
      requestedLimit >= 1 && requestedLimit <= 100
    ? requestedLimit
    : 25;
  const stripeKey = Deno.env.get("STRIPE_RESTRICTED_KEY") ?? "";
  if (!stripeKey) {
    return Response.json({ state: "unavailable" }, { status: 503 });
  }

  const db = createClient<any>(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );
  const worker = `workshop-cancellation-refund-${crypto.randomUUID()}`;
  const claimed = await db.rpc("claim_workshop_cancellation_refunds", {
    p_worker: worker,
    p_limit: batchLimit,
  });
  if (claimed.error) {
    return Response.json({ state: "unavailable" }, { status: 503 });
  }

  const report = { claimed: 0, accepted: 0, retrying: 0, failed: 0 };
  for (const job of (claimed.data ?? []) as CancellationRefundJob[]) {
    report.claimed += 1;
    try {
      if (["provider_accepted", "reconciled"].includes(job.request_state)) {
        await db.rpc("resolve_workshop_cancellation_refund_job", {
          p_job_id: job.job_id,
          p_worker: worker,
          p_outcome: "provider_accepted",
        });
        report.accepted += 1;
        continue;
      }
      const parameter = job.provider_charge_id.startsWith("pi_")
        ? "payment_intent"
        : job.provider_charge_id.startsWith("ch_")
        ? "charge"
        : null;
      if (!parameter) throw new Error("unsupported_provider_reference");

      const form = new URLSearchParams({
        [parameter]: job.provider_charge_id,
        amount: String(job.amount_minor),
        reason: "requested_by_customer",
        "metadata[payment_context]": "workshop",
        "metadata[workshop_refund_request_id]": job.refund_request_id,
        "metadata[workshop_cancellation_refund_job_id]": job.job_id,
      });
      const providerResponse = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": job.command_key,
        },
        body: form,
      });
      if (!providerResponse.ok) {
        const retryable = providerResponse.status === 429 ||
          providerResponse.status >= 500;
        const resolution = await db.rpc(
          "resolve_workshop_cancellation_refund_job",
          {
            p_job_id: job.job_id,
            p_worker: worker,
            p_outcome: retryable ? "retry" : "failed",
            p_error_category: `stripe_http_${providerResponse.status}`,
            p_retry_at: retryable
              ? new Date(
                Date.now() + Math.min(30, 2 ** job.attempt_count) * 60_000,
              ).toISOString()
              : null,
          },
        );
        if (!retryable || resolution.data?.state === "failed") {
          await db.rpc("manage_workshop_financials", {
            p_action: "refund_provider_failed",
            p_payload: {
              requestId: job.refund_request_id,
              safeFailure: `stripe_http_${providerResponse.status}`,
            },
            p_command_key: job.command_key,
          });
          report.failed += 1;
        } else {
          report.retrying += 1;
        }
        continue;
      }

      const providerRefund = await providerResponse.json() as Record<string, unknown>;
      const providerRefundId = safeProviderValue(providerRefund["id"]);
      if (!providerRefundId) throw new Error("provider_response_incomplete");
      const accepted = await db.rpc("manage_workshop_financials", {
        p_action: "refund_provider_accepted",
        p_payload: {
          requestId: job.refund_request_id,
          providerRefundId,
        },
        p_command_key: job.command_key,
      });
      if (accepted.error) throw new Error("acceptance_persistence_failed");
      const resolved = await db.rpc(
        "resolve_workshop_cancellation_refund_job",
        {
          p_job_id: job.job_id,
          p_worker: worker,
          p_outcome: "provider_accepted",
        },
      );
      if (resolved.error) throw new Error("job_persistence_failed");
      report.accepted += 1;
    } catch (error) {
      const category = error instanceof Error
        ? safeProviderValue(error.message) ?? "processor_failure"
        : "processor_failure";
      const resolution = await db.rpc(
        "resolve_workshop_cancellation_refund_job",
        {
          p_job_id: job.job_id,
          p_worker: worker,
          p_outcome: "retry",
          p_error_category: category,
          p_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      );
      if (resolution.data?.state === "failed") {
        await db.rpc("manage_workshop_financials", {
          p_action: "refund_provider_failed",
          p_payload: {
            requestId: job.refund_request_id,
            safeFailure: category,
          },
          p_command_key: job.command_key,
        });
        report.failed += 1;
      } else {
        report.retrying += 1;
      }
    }
  }

  return Response.json(report);
});
