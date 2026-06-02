import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LeadRow = {
  first_name: string;
  last_name: string;
  email: string;
  service_type: string;
  event_type: string | null;
  event_date: string | null;
};

type RequestBody = {
  render_html?: string | null;
  render_contract?: {
    lead?: LeadRow;
  } | null;
  line_items?: Array<{ item_name?: string; quantity?: number; subtotal?: number }>;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_amount?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOTENBERG_URL = Deno.env.get("GOTENBERG_URL") ?? "";
const GOTENBERG_USERNAME = Deno.env.get("GOTENBERG_USERNAME") ?? "";
const GOTENBERG_PASSWORD = Deno.env.get("GOTENBERG_PASSWORD") ?? "";

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

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "preview-floral-proposal-pdf", message, ...data }));
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "INFO", function: "preview-floral-proposal-pdf", message, ...data }));
}

function normalizeGotenbergUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

function formatDisplayValue(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Not provided";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" }).format(date);
}

function sanitizePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "");
}

function encodePdfBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildFallbackPdf(body: RequestBody): Uint8Array {
  const lead = body.render_contract?.lead;
  const lines: string[] = [
    "Black Begonia Floral Co.",
    "Floral Proposal Preview",
    "",
    `Client: ${lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Not provided'}`,
    `Email: ${lead?.email ?? 'Not provided'}`,
    `Service Type: ${formatDisplayValue(lead?.service_type)}`,
    `Event Type: ${formatDisplayValue(lead?.event_type)}`,
    `Event Date: ${formatDate(lead?.event_date)}`,
    "",
    "Line Items",
    ...((body.line_items ?? []).flatMap((line) => {
      const section = [`${line.item_name ?? 'Line Item'} | Qty ${line.quantity ?? 0} | ${formatCurrency(Number(line.subtotal ?? 0))}`];
      return section.concat([""]);
    })),
    `Subtotal: ${formatCurrency(Number(body.subtotal ?? 0))}`,
    `Tax Rate: ${Number(body.tax_rate ?? 0)}%`,
    `Tax Amount: ${formatCurrency(Number(body.tax_amount ?? 0))}`,
    `Total: ${formatCurrency(Number(body.total_amount ?? 0))}`,
  ];

  const pageLines = lines.map((line, index) => {
    const y = 760 - index * 18;
    return `BT /F1 11 Tf 50 ${y} Td (${sanitizePdfText(line)}) Tj ET`;
  }).join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${pageLines.length} >> stream\n${pageLines}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

async function renderPdf(body: RequestBody): Promise<Uint8Array> {
  if (!body.render_html?.trim() || !GOTENBERG_URL.trim()) {
    return buildFallbackPdf(body);
  }

  const form = new FormData();
  form.append("files", new File([body.render_html], "index.html", { type: "text/html; charset=utf-8" }));
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");

  const headers: HeadersInit = {};
  if (GOTENBERG_USERNAME && GOTENBERG_PASSWORD) {
    headers["Authorization"] = `Basic ${btoa(`${GOTENBERG_USERNAME}:${GOTENBERG_PASSWORD}`)}`;
  }

  const response = await fetch(`${normalizeGotenbergUrl(GOTENBERG_URL)}/forms/chromium/convert/html`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logError("Gotenberg preview render failed, falling back to basic PDF", {
      status: response.status,
      response_preview: errorText.slice(0, 500),
    });
    return buildFallbackPdf(body);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function isInternalCrmUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_active, user_roles!inner(role)")
    .eq("id", userId)
    .in("user_roles.role", ["admin", "staff"])
    .maybeSingle();

  if (error) {
    logError("CRM role lookup failed", { user_id: userId, error: error.message });
    return false;
  }

  return Boolean(data?.is_active);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { success: false, error: "Method not allowed." });

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    if (GOTENBERG_URL.trim()) {
      requireEnv("GOTENBERG_USERNAME", GOTENBERG_USERNAME);
      requireEnv("GOTENBERG_PASSWORD", GOTENBERG_PASSWORD);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return jsonResponse(401, { success: false, error: "Missing authorization token." });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return jsonResponse(401, { success: false, error: "Unable to validate user session." });
    if (!(await isInternalCrmUser(supabase, user.id))) {
      return jsonResponse(403, { success: false, error: "You do not have permission to preview Floral Proposals." });
    }

    const body = await req.json() as RequestBody;
    const pdfBytes = await renderPdf(body);
    const pdfBase64 = encodePdfBase64(pdfBytes);

    logInfo("Floral Proposal preview rendered", { bytes: pdfBytes.byteLength, used_gotenberg: Boolean(body.render_html?.trim() && GOTENBERG_URL.trim()) });
    return jsonResponse(200, { success: true, pdf_base64: pdfBase64 });
  } catch (error) {
    logError("Preview render failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(500, { success: false, error: error instanceof Error ? error.message : "Unable to render Floral Proposal preview." });
  }
});