// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

console.info("modify-invoice-from-line-items-change: server started");

// --- Helpers --------------------------------------------------------------

function round2(n: number): number {
  return Math.round((n ?? 0) * 100) / 100;
}

function toDecimalFromStoredTaxRate(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

// --- Handler --------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Incoming payload:", payload);

    const record = payload?.record ?? payload?.new ?? payload;
    console.log("Record:", record);

    const invoice_id = record?.invoice_id;
    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "Missing invoice_id" }),
        { status: 400 }
      );
    }

    // 1) Fetch all current line items for the invoice
    const { data: lineItems, error: fetchError } = await supabase
      .from("invoice_line_items")
      .select("quantity, unit_price")
      .eq("invoice_id", invoice_id);

    if (fetchError || !lineItems) {
      console.error("Failed to fetch line items:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch line items",
          details: fetchError,
        }),
        { status: 500 }
      );
    }

    console.log("Line Items:", lineItems);

    const subtotal = round2(
      lineItems.reduce(
        (acc, item) =>
          acc + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0
      )
    );

    // 2) Fetch the invoice tax_rate so we respect what the florist entered
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("tax_rate")
      .eq("invoice_id", invoice_id)
      .single();

    if (invErr) {
      console.error("Failed to fetch invoice:", invErr);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch invoice",
          details: invErr,
        }),
        { status: 500 }
      );
    }

    const taxRateDecimal = toDecimalFromStoredTaxRate(invoice?.tax_rate);
    const tax_amount = round2(subtotal * taxRateDecimal);
    const total = round2(subtotal + tax_amount);

    console.log("Subtotal:", subtotal, "Tax Rate (dec):", taxRateDecimal, "Tax Amount:", tax_amount, "Total:", total);

    // 3) Update the invoice record using the *dynamic* tax rate
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        subtotal,
        tax_amount,
        total,
      })
      .eq("invoice_id", invoice_id);

    if (updateError) {
      console.error("Failed to update invoice:", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to update invoice",
          details: updateError,
        }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Invoice updated successfully.",
        subtotal,
        tax_amount,
        total,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Unhandled error in edge function:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      { status: 500 }
    );
  }
});