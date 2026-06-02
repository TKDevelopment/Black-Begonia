import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CanvaConnectionRow = {
  canva_connection_id: string;
  user_id: string;
  canva_user_id: string | null;
  canva_team_id: string | null;
  display_name: string | null;
  scopes: string[] | null;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  connected_at: string;
  refreshed_at: string;
  last_used_at: string | null;
  metadata: Record<string, unknown> | null;
};

type CanvaOauthSessionRow = {
  canva_oauth_session_id: string;
  user_id: string;
  state: string;
  code_verifier: string;
  redirect_uri: string;
  app_origin: string;
  status: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type DesignListItem = {
  id: string;
  title?: string | null;
  page_count?: number | null;
  updated_at?: number | null;
  thumbnail?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  urls?: {
    edit_url?: string | null;
    view_url?: string | null;
  } | null;
};

type DesignPageItem = {
  index: number;
  dimensions?: {
    width?: number | null;
    height?: number | null;
  } | null;
  thumbnail?: {
    url?: string | null;
  } | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CANVA_CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID")!;
const CANVA_CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET")!;
const CANVA_REDIRECT_URI = Deno.env.get("CANVA_REDIRECT_URI")!;
const CANVA_SCOPES = Deno.env.get("CANVA_SCOPES") ?? "design:meta:read design:content:read profile:read";
const TEMPLATE_ASSET_BUCKET = Deno.env.get("PROPOSAL_TEMPLATE_ASSET_BUCKET") ?? "proposal-template-assets";
const SIGNED_URL_TTL_SECONDS = Number(Deno.env.get("CANVA_IMPORTED_ASSET_SIGNED_URL_TTL_SECONDS") ?? "3600");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function htmlResponse(status: number, html: string) {
  return new Response(html, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "INFO", function: "canva-connect", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "ERROR", function: "canva-connect", message, ...data }));
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { error: String(error) };
}

function base64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function randomToken(length = 72): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => charset[byte % charset.length]).join("");
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return btoa(`${clientId}:${clientSecret}`);
}

async function parseJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTimestamp(epochSeconds?: number | null): string | null {
  if (!epochSeconds || !Number.isFinite(epochSeconds)) {
    return null;
  }

  return new Date(epochSeconds * 1000).toISOString();
}

async function getAuthedCrmUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    throw new Response(JSON.stringify({ success: false, error: "Missing authorization token." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new Response(JSON.stringify({ success: false, error: "Unable to validate user session." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_active, user_roles!inner(role)")
    .eq("id", userData.user.id)
    .in("user_roles.role", ["admin", "staff"])
    .maybeSingle();

  if (profileError || !profile?.is_active) {
    throw new Response(JSON.stringify({ success: false, error: "You do not have permission to manage Canva imports." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return userData.user;
}

async function canvaTokenRequest(params: URLSearchParams) {
  const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encodeBasicAuth(CANVA_CLIENT_ID, CANVA_CLIENT_SECRET)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const preview = await response.text();
    throw new Error(`Canva token request failed (${response.status}): ${preview.slice(0, 240)}`);
  }

  return await parseJson<{
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  }>(response);
}

async function revokeCanvaToken(refreshToken: string) {
  const response = await fetch("https://api.canva.com/rest/v1/oauth/revoke", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encodeBasicAuth(CANVA_CLIENT_ID, CANVA_CLIENT_SECRET)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const preview = await response.text();
    throw new Error(`Canva revoke failed (${response.status}): ${preview.slice(0, 240)}`);
  }
}

async function canvaApi<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.canva.com/rest/v1${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const preview = await response.text();
    throw new Error(`Canva API request failed (${response.status}) for ${path}: ${preview.slice(0, 240)}`);
  }

  return await parseJson<T>(response);
}

async function fetchCanvaProfile(accessToken: string): Promise<{ display_name?: string | null }> {
  return await canvaApi<{ display_name?: string | null }>(
    accessToken,
    "/users/me/profile"
  );
}

async function getConnection(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<CanvaConnectionRow | null> {
  const { data, error } = await supabase
    .from("canva_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<CanvaConnectionRow>();

  if (error) {
    throw new Error(`Unable to load Canva connection: ${error.message}`);
  }

  return data ?? null;
}

async function persistConnection(
  supabase: ReturnType<typeof createClient>,
  payload: Partial<CanvaConnectionRow> & { user_id: string }
): Promise<CanvaConnectionRow> {
  const { data, error } = await supabase
    .from("canva_connections")
    .upsert({
      ...payload,
      refreshed_at: new Date().toISOString(),
      connected_at: payload.connected_at ?? new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("*")
    .single<CanvaConnectionRow>();

  if (error || !data) {
    throw new Error(`Unable to persist Canva connection: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

async function ensureConnection(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<CanvaConnectionRow> {
  const current = await getConnection(supabase, userId);
  if (!current) {
    throw new Error("Connect Canva before importing designs.");
  }

  const expiresAt = new Date(current.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return current;
  }

  const tokenData = await canvaTokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
  }));

  const nextScopes = tokenData.scope
    ? tokenData.scope.split(/\s+/).filter(Boolean)
    : (current.scopes ?? []);
  const refreshed = await persistConnection(supabase, {
    user_id: current.user_id,
    canva_user_id: current.canva_user_id,
    canva_team_id: current.canva_team_id,
    display_name: current.display_name,
    scopes: nextScopes,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? current.refresh_token,
    token_type: tokenData.token_type ?? current.token_type ?? "Bearer",
    expires_at: new Date(Date.now() + Number(tokenData.expires_in ?? 14_400) * 1000).toISOString(),
    last_used_at: new Date().toISOString(),
    metadata: current.metadata ?? {},
  });

  logInfo("Canva access token refreshed", { user_id: userId });
  return refreshed;
}

function buildPopupHtml(
  appOrigin: string,
  payload: Record<string, unknown>,
  heading: string,
  copy: string
) {
  const messageJson = JSON.stringify(payload);
  const originJson = JSON.stringify(appOrigin);
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Canva Connection</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #10161a;
          color: #eef4fa;
          font-family: Inter, system-ui, sans-serif;
        }
        .card {
          width: min(440px, calc(100vw - 2rem));
          padding: 24px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
        }
        h1 { margin: 0 0 12px; font-size: 22px; }
        p { margin: 0; line-height: 1.5; color: #cdd8e2; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${heading}</h1>
        <p>${copy}</p>
      </div>
      <script>
        const payload = ${messageJson};
        const targetOrigin = ${originJson};
        if (window.opener && targetOrigin) {
          window.opener.postMessage(payload, targetOrigin);
        }
        setTimeout(() => window.close(), 250);
      </script>
    </body>
  </html>`;
}

function getCallbackQueryParams(url: URL) {
  let mode = url.searchParams.get("mode");
  let code = url.searchParams.get("code");
  let state = url.searchParams.get("state");
  let oauthError = url.searchParams.get("error");
  let oauthErrorDescription = url.searchParams.get("error_description");

  if (mode?.startsWith("callback?")) {
    const nested = new URLSearchParams(mode.slice("callback?".length));
    mode = "callback";
    code = code ?? nested.get("code");
    state = state ?? nested.get("state");
    oauthError = oauthError ?? nested.get("error");
    oauthErrorDescription = oauthErrorDescription ?? nested.get("error_description");
  }

  return {
    mode,
    code,
    state,
    oauthError,
    oauthErrorDescription,
  };
}

async function handleCallback(req: Request, supabase: ReturnType<typeof createClient>) {
  const url = new URL(req.url);
  const { code, state, oauthError, oauthErrorDescription } = getCallbackQueryParams(url);

  if (!state) {
    return htmlResponse(400, buildPopupHtml(
      "*",
      { type: "bb-canva-oauth", status: "error", message: "Missing Canva state." },
      "Canva connection failed",
      "The OAuth response was missing its state value."
    ));
  }

  const { data: session, error: sessionError } = await supabase
    .from("canva_oauth_sessions")
    .select("*")
    .eq("state", state)
    .maybeSingle<CanvaOauthSessionRow>();

  if (sessionError || !session) {
    logError("Canva OAuth session lookup failed", { state, error: sessionError?.message });
    return htmlResponse(400, buildPopupHtml(
      "*",
      { type: "bb-canva-oauth", status: "error", message: "This Canva connection session could not be found." },
      "Canva connection failed",
      "We couldn't find the pending Canva session for this popup."
    ));
  }

  const fail = async (message: string) => {
    await supabase
      .from("canva_oauth_sessions")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("canva_oauth_session_id", session.canva_oauth_session_id);

    return htmlResponse(400, buildPopupHtml(
      session.app_origin,
      { type: "bb-canva-oauth", status: "error", message },
      "Canva connection failed",
      message
    ));
  };

  if (oauthError) {
    return await fail(oauthErrorDescription || oauthError);
  }

  if (!code) {
    return await fail("Canva did not return an authorization code.");
  }

  try {
    const tokenData = await canvaTokenRequest(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: session.code_verifier,
      redirect_uri: session.redirect_uri,
    }));
    const profile = await fetchCanvaProfile(tokenData.access_token);
    const scopes = tokenData.scope?.split(/\s+/).filter(Boolean) ?? CANVA_SCOPES.split(/\s+/).filter(Boolean);

    await persistConnection(supabase, {
      user_id: session.user_id,
      display_name: profile.display_name ?? null,
      canva_user_id: null,
      canva_team_id: null,
      scopes,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? "",
      token_type: tokenData.token_type ?? "Bearer",
      expires_at: new Date(Date.now() + Number(tokenData.expires_in ?? 14_400) * 1000).toISOString(),
      last_used_at: new Date().toISOString(),
      metadata: {},
    });

    await supabase
      .from("canva_oauth_sessions")
      .update({
        status: "completed",
        error: null,
        completed_at: new Date().toISOString(),
      })
      .eq("canva_oauth_session_id", session.canva_oauth_session_id);

    logInfo("Canva OAuth completed", { user_id: session.user_id });
    return htmlResponse(200, buildPopupHtml(
      session.app_origin,
      { type: "bb-canva-oauth", status: "connected" },
      "Canva connected",
      "You can close this popup and continue importing designs in the CRM editor."
    ));
  } catch (error) {
    logError("Canva OAuth callback failed", { error: sanitizeError(error), user_id: session.user_id });
    return await fail(error instanceof Error ? error.message : "Unable to complete Canva sign-in.");
  }
}

async function startOAuth(req: Request, supabase: ReturnType<typeof createClient>) {
  const user = await getAuthedCrmUser(req, supabase);
  const body = await req.json() as { app_origin?: string };
  const appOrigin = String(body.app_origin ?? "").trim();

  if (!appOrigin) {
    return jsonResponse(400, { success: false, error: "Missing app origin." });
  }

  const state = randomToken(64);
  const codeVerifier = randomToken(96);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  await supabase
    .from("canva_oauth_sessions")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "pending");

  const { data: session, error } = await supabase
    .from("canva_oauth_sessions")
    .insert({
      user_id: user.id,
      state,
      code_verifier: codeVerifier,
      redirect_uri: CANVA_REDIRECT_URI,
      app_origin: appOrigin,
      status: "pending",
    })
    .select("canva_oauth_session_id")
    .single<{ canva_oauth_session_id: string }>();

  if (error || !session) {
    throw new Error(`Unable to create Canva OAuth session: ${error?.message ?? "unknown error"}`);
  }

  const authorizationUrl = new URL("https://www.canva.com/api/oauth/authorize");
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "s256");
  authorizationUrl.searchParams.set("scope", CANVA_SCOPES);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", CANVA_CLIENT_ID);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("redirect_uri", CANVA_REDIRECT_URI);

  return jsonResponse(200, {
    success: true,
    data: {
      session_id: session.canva_oauth_session_id,
      authorization_url: authorizationUrl.toString(),
      callback_origin: new URL(CANVA_REDIRECT_URI).origin,
    },
  });
}

async function getStatus(req: Request, supabase: ReturnType<typeof createClient>) {
  const user = await getAuthedCrmUser(req, supabase);
  const connection = await getConnection(supabase, user.id);

  return jsonResponse(200, {
    success: true,
    data: connection
      ? {
          connected: true,
          display_name: connection.display_name,
          scopes: connection.scopes ?? [],
          expires_at: connection.expires_at,
          canva_user_id: connection.canva_user_id,
          canva_team_id: connection.canva_team_id,
        }
      : {
          connected: false,
          scopes: [],
        },
  });
}

async function listDesigns(req: Request, supabase: ReturnType<typeof createClient>) {
  const user = await getAuthedCrmUser(req, supabase);
  const body = await req.json() as { query?: string; continuation?: string | null };
  const connection = await ensureConnection(supabase, user.id);

  const params = new URLSearchParams({
    limit: "24",
    sort_by: "modified_descending",
    ownership: "any",
  });

  if (body.query?.trim()) {
    params.set("query", body.query.trim());
  }

  if (body.continuation?.trim()) {
    params.set("continuation", body.continuation.trim());
  }

  const response = await canvaApi<{ items?: DesignListItem[]; continuation?: string | null }>(
    connection.access_token,
    `/designs?${params.toString()}`
  );

  await supabase
    .from("canva_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return jsonResponse(200, {
    success: true,
    data: {
      continuation: response.continuation ?? null,
      items: (response.items ?? []).map((item) => ({
        id: item.id,
        title: item.title ?? "Untitled Canva design",
        page_count: Number(item.page_count ?? 1),
        updated_at: normalizeTimestamp(item.updated_at),
        thumbnail_url: item.thumbnail?.url ?? null,
        thumbnail_width: item.thumbnail?.width ?? null,
        thumbnail_height: item.thumbnail?.height ?? null,
        edit_url: item.urls?.edit_url ?? null,
        view_url: item.urls?.view_url ?? null,
      })),
    },
  });
}

async function uploadImportedPage(
  supabase: ReturnType<typeof createClient>,
  templateId: string,
  designId: string,
  pageIndex: number,
  downloadUrl: string
) {
  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    const preview = await downloadResponse.text();
    throw new Error(`Unable to download Canva export page ${pageIndex}: ${preview.slice(0, 240)}`);
  }

  const extension = downloadResponse.headers.get("content-type")?.includes("jpeg") ? "jpg" : "png";
  const assetId = `canva-${designId}-${pageIndex}-${Date.now()}`;
  const storagePath = `${templateId}/canva-imports/${designId}/${assetId}.${extension}`;
  const bytes = new Uint8Array(await downloadResponse.arrayBuffer());

  const { error: uploadError } = await supabase
    .storage
    .from(TEMPLATE_ASSET_BUCKET)
    .upload(storagePath, bytes, {
      contentType: downloadResponse.headers.get("content-type") ?? `image/${extension}`,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Unable to store imported Canva page ${pageIndex}: ${uploadError.message}`);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase
    .storage
    .from(TEMPLATE_ASSET_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(`Unable to sign imported Canva page ${pageIndex}: ${signedUrlError?.message ?? "missing signed URL"}`);
  }

  return {
    id: assetId,
    type: "image" as const,
    url: signedUrlData.signedUrl,
    storage_path: storagePath,
    alt: `Imported Canva page ${pageIndex}`,
  };
}

async function importDesign(req: Request, supabase: ReturnType<typeof createClient>) {
  const user = await getAuthedCrmUser(req, supabase);
  const body = await req.json() as { template_id?: string; design_id?: string };
  const templateId = String(body.template_id ?? "").trim();
  const designId = String(body.design_id ?? "").trim();

  if (!templateId || !designId) {
    return jsonResponse(400, { success: false, error: "Missing template ID or design ID." });
  }

  const connection = await ensureConnection(supabase, user.id);
  const design = await canvaApi<{ design: DesignListItem }>(
    connection.access_token,
    `/designs/${encodeURIComponent(designId)}`
  );

  let designPages: DesignPageItem[] = [];
  try {
    const pagesResponse = await canvaApi<{ items?: DesignPageItem[] }>(
      connection.access_token,
      `/designs/${encodeURIComponent(designId)}/pages?offset=1&limit=200`
    );
    designPages = pagesResponse.items ?? [];
  } catch (error) {
    logInfo("Canva design page metadata unavailable, falling back to export-only sizing", {
      design_id: designId,
      error: sanitizeError(error),
    });
  }

  const exportJobStart = await canvaApi<{ job: { id: string; status: string } }>(
    connection.access_token,
    "/exports",
    {
      method: "POST",
      body: JSON.stringify({
        design_id: designId,
        format: {
          type: "png",
          lossless: true,
          as_single_image: false,
        },
      }),
    }
  );

  const exportId = exportJobStart.job?.id;
  if (!exportId) {
    throw new Error("Canva did not return an export job ID.");
  }

  let exportJob: { id: string; status: string; urls?: string[]; error?: { message?: string } } | null = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const current = await canvaApi<{ job: { id: string; status: string; urls?: string[]; error?: { message?: string } } }>(
      connection.access_token,
      `/exports/${encodeURIComponent(exportId)}`
    );
    exportJob = current.job;

    if (exportJob.status === "success" || exportJob.status === "failed") {
      break;
    }

    await sleep(1200);
  }

  if (!exportJob || exportJob.status !== "success" || !exportJob.urls?.length) {
    throw new Error(exportJob?.error?.message || "Canva export did not complete successfully.");
  }

  const pageAssets = [];
  for (let index = 0; index < exportJob.urls.length; index += 1) {
    const asset = await uploadImportedPage(
      supabase,
      templateId,
      designId,
      index + 1,
      exportJob.urls[index]
    );
    const pageMetadata = designPages[index];
    pageAssets.push({
      page_index: index + 1,
      page_name: `${design.design.title ?? "Canva design"} ${index + 1}`,
      width: Math.round(Number(pageMetadata?.dimensions?.width ?? pageMetadata?.thumbnail?.width ?? 1080)),
      height: Math.round(Number(pageMetadata?.dimensions?.height ?? pageMetadata?.thumbnail?.height ?? 1920)),
      thumbnail_url: pageMetadata?.thumbnail?.url ?? design.design.thumbnail?.url ?? null,
      asset,
    });
  }

  await supabase
    .from("canva_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", user.id);

  logInfo("Canva design imported", {
    user_id: user.id,
    template_id: templateId,
    design_id: designId,
    pages: pageAssets.length,
  });

  return jsonResponse(200, {
    success: true,
    data: {
      summary: {
        id: `canva-import-${designId}-${Date.now()}`,
        design_id: designId,
        title: design.design.title ?? "Untitled Canva design",
        page_count: pageAssets.length,
        imported_at: new Date().toISOString(),
        thumbnail_url: design.design.thumbnail?.url ?? null,
      },
      assets: pageAssets.map((page) => page.asset),
      imported_pages: pageAssets,
    },
  });
}

async function disconnect(req: Request, supabase: ReturnType<typeof createClient>) {
  const user = await getAuthedCrmUser(req, supabase);
  const connection = await getConnection(supabase, user.id);

  if (connection?.refresh_token) {
    try {
      await revokeCanvaToken(connection.refresh_token);
    } catch (error) {
      logError("Canva token revoke failed", { user_id: user.id, error: sanitizeError(error) });
    }
  }

  const { error } = await supabase
    .from("canva_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Unable to remove Canva connection: ${error.message}`);
  }

  return jsonResponse(200, {
    success: true,
    data: null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
    requireEnv("CANVA_CLIENT_ID", CANVA_CLIENT_ID);
    requireEnv("CANVA_CLIENT_SECRET", CANVA_CLIENT_SECRET);
    requireEnv("CANVA_REDIRECT_URI", CANVA_REDIRECT_URI);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const callbackParams = getCallbackQueryParams(url);

    if (
      req.method === "GET" &&
      (
        callbackParams.mode === "callback" ||
        url.pathname.endsWith("/callback") ||
        url.searchParams.has("code") ||
        url.searchParams.has("error")
      )
    ) {
      return await handleCallback(req, supabase);
    }

    if (req.method !== "POST") {
      return jsonResponse(405, { success: false, error: "Method not allowed." });
    }

    const body = await req.clone().json() as { action?: string };
    const action = String(body.action ?? "").trim();

    switch (action) {
      case "start":
        return await startOAuth(req, supabase);
      case "status":
        return await getStatus(req, supabase);
      case "list_designs":
        return await listDesigns(req, supabase);
      case "import_design":
        return await importDesign(req, supabase);
      case "disconnect":
        return await disconnect(req, supabase);
      default:
        return jsonResponse(400, { success: false, error: "Unknown Canva action." });
    }
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    logError("Unhandled Canva integration error", { error: sanitizeError(error) });
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unhandled Canva integration error.",
    });
  }
});