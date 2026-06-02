import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FloralProposalRow = {
  floral_proposal_id: string;
  lead_id: string;
  version: number;
  customer_email: string;
  passcode_hash: string;
  pdf_storage_path: string | null;
  pdf_url: string | null;
  is_active: boolean;
  status: string;
  created_at: string;
};

type LeadRow = {
  lead_id: string;
  first_name: string;
  last_name: string;
  service_type: string;
  event_type: string | null;
  event_date: string | null;
};

type RequestBody = {
  email: string;
  passcode: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROPOSAL_ACCESS_SIGNING_KEY = Deno.env.get("PROPOSAL_ACCESS_SIGNING_KEY")!;
const PROPOSAL_SIGNED_URL_TTL_SECONDS = Number(Deno.env.get("PROPOSAL_SIGNED_URL_TTL_SECONDS") ?? "3600");
const FLORAL_PROPOSAL_BUCKET = Deno.env.get("FLORAL_PROPOSAL_BUCKET") ?? "floral-proposals";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { error };
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "INFO", function: "verify-floral-proposal-access", message, ...data }));
}

function logWarn(message: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "WARN", function: "verify-floral-proposal-access", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "verify-floral-proposal-access", message, ...data }));
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createHmacSignature(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(PROPOSAL_ACCESS_SIGNING_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

async function createAccessToken(payload: Record<string, unknown>): Promise<string> {
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await createHmacSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(passcode));
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("PROPOSAL_ACCESS_SIGNING_KEY", PROPOSAL_ACCESS_SIGNING_KEY);

    const body = await req.json() as RequestBody;
    const email = String(body.email ?? "").trim().toLowerCase();
    const passcode = String(body.passcode ?? "").trim();

    if (!email) return jsonResponse(400, { success: false, error: "Missing email." });
    if (!/^\d{6}$/.test(passcode)) return jsonResponse(400, { success: false, error: "Missing or invalid passcode." });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const passcodeHash = await hashPasscode(passcode);

    const { data: proposals, error: proposalsError } = await supabase
      .from("floral_proposals")
      .select("floral_proposal_id, lead_id, version, customer_email, passcode_hash, pdf_storage_path, pdf_url, is_active, status, created_at")
      .eq("customer_email", email)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<FloralProposalRow[]>();

    if (proposalsError) {
      logError("Proposal lookup failed", { error: sanitizeError(proposalsError) });
      return jsonResponse(500, { success: false, error: "Unable to verify Floral Proposal access." });
    }

    const proposal = (proposals ?? []).find((row) => row.passcode_hash === passcodeHash && row.status === "submitted");
    if (!proposal) {
      logWarn("Proposal access denied", { email });
      return jsonResponse(200, { success: false, error: "The email or passcode is not valid." });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("lead_id, first_name, last_name, service_type, event_type, event_date")
      .eq("lead_id", proposal.lead_id)
      .single<LeadRow>();

    if (leadError || !lead) {
      logError("Lead lookup failed", { floral_proposal_id: proposal.floral_proposal_id, error: leadError ? sanitizeError(leadError) : null });
      return jsonResponse(404, { success: false, error: "Proposal lead not found." });
    }

    let pdfUrl = proposal.pdf_url;
    if (proposal.pdf_storage_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from(FLORAL_PROPOSAL_BUCKET).createSignedUrl(proposal.pdf_storage_path, PROPOSAL_SIGNED_URL_TTL_SECONDS);
      if (signedUrlError || !signedUrlData?.signedUrl) {
        logError("Signed URL creation failed", { floral_proposal_id: proposal.floral_proposal_id, error: signedUrlError ? sanitizeError(signedUrlError) : null });
        return jsonResponse(500, { success: false, error: "Unable to generate a secure Floral Proposal link." });
      }
      pdfUrl = signedUrlData.signedUrl;
    }

    const authenticatedAt = new Date();
    const expiresAt = new Date(authenticatedAt.getTime() + PROPOSAL_SIGNED_URL_TTL_SECONDS * 1000);
    const accessToken = await createAccessToken({ floral_proposal_id: proposal.floral_proposal_id, email, exp: Math.floor(expiresAt.getTime() / 1000) });

    logInfo("Floral Proposal access granted", { floral_proposal_id: proposal.floral_proposal_id, lead_id: lead.lead_id, email, expires_at: expiresAt.toISOString() });

    return jsonResponse(200, {
      success: true,
      session: {
        floral_proposal_id: proposal.floral_proposal_id,
        lead_id: lead.lead_id,
        customer_email: proposal.customer_email,
        client_name: `${lead.first_name} ${lead.last_name}`.trim(),
        service_type: lead.service_type,
        event_type: lead.event_type,
        event_date: lead.event_date,
        proposal_version: proposal.version,
        version: proposal.version,
        file_name: `floral-proposal-v${proposal.version}.pdf`,
        pdf_url: pdfUrl,
        access_token: accessToken,
        authenticated_at: authenticatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        response_action: null,
        response_feedback: null,
        responded_at: null,
      },
    });
  } catch (error) {
    logError("Unhandled function error", { error: sanitizeError(error) });
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Unhandled server error." });
  }
});