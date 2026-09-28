import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origins = new Set([
  ...(Deno.env.get("CRM_ALLOWED_ORIGINS") ?? "").split(",").map((part) => part.trim()).filter(Boolean),
  "http://localhost:4200", "http://127.0.0.1:4200",
]);
const headers = (origin: string): Headers => {
  const result = new Headers({
    "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Max-Age": "86400",
  });
  if (origins.has(origin)) result.set("Access-Control-Allow-Origin", origin);
  return result;
};
const respond = (origin: string, status: number, body: unknown): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: headers(origin) });
const env = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new CalendarError(503, "calendar_not_configured");
  return value;
};
class CalendarError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAt?: string) { super(code); }
}
type GraphCalendar = { id: string; name: string; isDefaultCalendar?: boolean };

async function token(): Promise<string> {
  const tenant = env("M365_TENANT_ID");
  const form = new URLSearchParams({
    client_id: env("M365_CLIENT_ID"), client_secret: env("M365_CLIENT_SECRET"),
    grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default",
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST", body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new CalendarError(503, "microsoft_authorization_unavailable");
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new CalendarError(503, "microsoft_authorization_unavailable");
  // Exchange Application RBAC is additive to Entra grants. A Graph calendar app role
  // in this token would bypass the mailbox scope and is therefore rejected.
  try {
    const claims = JSON.parse(atob(payload.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      roles?: string[];
    };
    if (claims.roles?.some((role) => role.startsWith("Calendars."))) {
      throw new CalendarError(503, "unscoped_calendar_permission");
    }
  } catch (error) {
    if (error instanceof CalendarError) throw error;
    throw new CalendarError(503, "microsoft_authorization_unavailable");
  }
  return payload.access_token;
}

async function graphGet(path: string, accessToken: string): Promise<Response> {
  if (!path.startsWith("/")) throw new CalendarError(500, "invalid_graph_path");
  return await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'IdType="ImmutableId"' },
    signal: AbortSignal.timeout(10000),
  });
}

async function listCalendars(accessToken: string): Promise<GraphCalendar[]> {
  const mailbox = env("M365_MAILBOX_UPN");
  const blockedMailbox = env("M365_OUT_OF_SCOPE_MAILBOX_UPN");
  if (mailbox.toLowerCase() === blockedMailbox.toLowerCase()) {
    throw new CalendarError(503, "mailbox_scope_not_verified");
  }
  const negative = await graphGet(`/users/${encodeURIComponent(blockedMailbox)}/calendars?$top=1`, accessToken);
  if (negative.status !== 403) throw new CalendarError(503, "mailbox_scope_not_verified");
  const calendars: GraphCalendar[] = [];
  let next = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendars?$select=id,name,isDefaultCalendar&$top=100`;
  for (let page = 0; next && page < 10; page++) {
    const url = new URL(next);
    if (url.origin !== "https://graph.microsoft.com" || !url.pathname.startsWith("/v1.0/users/")) {
      throw new CalendarError(503, "microsoft_calendar_unavailable");
    }
    const response = await graphGet(url.pathname.replace(/^\/v1\.0/, "") + url.search, accessToken);
    if (!response.ok) throw new CalendarError(503, "microsoft_calendar_unavailable");
    const payload = await response.json() as { value?: GraphCalendar[]; "@odata.nextLink"?: string };
    for (const calendar of payload.value ?? []) {
      if (calendar.id && calendar.name) calendars.push({ id: calendar.id, name: calendar.name,
        isDefaultCalendar: calendar.isDefaultCalendar === true });
    }
    next = payload["@odata.nextLink"] ?? "";
  }
  if (next) throw new CalendarError(503, "microsoft_calendar_paging_incomplete");
  return calendars;
}

async function dispatchWorker(): Promise<boolean> {
  try {
    const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/crm-m365-calendar-sync`, {
      method: "POST", headers: {
        "Content-Type": "application/json",
        "x-crm-m365-scheduler-secret": env("CRM_M365_SCHEDULER_SECRET"),
      }, body: "{}", signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch { return false; }
}

serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return respond(origin, 204, {});
  if (request.method !== "POST" || !origins.has(origin)) return respond(origin, 404, { code: "unavailable" });
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4096) {
      throw new CalendarError(413, "request_too_large");
    }
    const rawBody = await request.text();
    if (rawBody.length > 4096) throw new CalendarError(413, "request_too_large");
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const action = String(body["action"] ?? "");
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) throw new CalendarError(401, "unauthorized");
    const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData.user) throw new CalendarError(401, "unauthorized");
    const role = await caller.rpc(action === "requestMonth" ? "is_internal_crm_user" : "is_calendar_integration_admin");
    if (role.error || role.data !== true) throw new CalendarError(403, "forbidden");
    const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const actor = userData.user.id;
    const monthInput = body["month"];
    const month = monthInput === undefined || monthInput === null ? null : String(monthInput);
    if (month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new CalendarError(400, "invalid_month");
    }
    if (action === "requestMonth") {
      if (!month) throw new CalendarError(400, "invalid_month");
      const result = await service.rpc("queue_crm_calendar_month", {
        p_month: `${month}-01`, p_requested_by: actor,
      });
      if (result.error) throw new CalendarError(503, "calendar_queue_unavailable");
      const status = String(result.data?.status ?? "");
      if (status === "disconnected") throw new CalendarError(409, "calendar_disconnected");
      if (status === "rate_limited") throw new CalendarError(429, "month_rate_limited", result.data?.retryAt);
      const dispatched = status === "queued" ? await dispatchWorker() : false;
      return respond(origin, 200, { ...result.data, dispatched });
    }
    if (action === "listCalendars") {
      return respond(origin, 200, { calendars: await listCalendars(await token()) });
    }
    if (action === "connect") {
      const calendarId = String(body["calendarId"] ?? "");
      if (!calendarId || calendarId.length > 512) throw new CalendarError(400, "invalid_calendar");
      const timezone = env("M365_BUSINESS_TIMEZONE");
      if (!["America/New_York", "America/Chicago", "America/Denver",
        "America/Los_Angeles", "UTC", "Etc/UTC"].includes(timezone)) {
        throw new CalendarError(503, "unsupported_timezone");
      }
      const calendars = await listCalendars(await token());
      const calendar = calendars.find((row) => row.id === calendarId);
      if (!calendar) throw new CalendarError(422, "calendar_not_in_mailbox");
      const result = await service.rpc("connect_crm_m365_calendar", {
        p_tenant_id: env("M365_TENANT_ID"), p_mailbox_user_id: env("M365_MAILBOX_UPN"),
        p_mailbox_upn: env("M365_MAILBOX_UPN"), p_calendar_id: calendar.id,
        p_calendar_name: calendar.name, p_is_primary: calendar.isDefaultCalendar === true,
        p_timezone: timezone, p_actor: actor,
      });
      if (result.error?.code === "23505") throw new CalendarError(409, "calendar_already_connected");
      if (result.error) throw new CalendarError(503, "calendar_connect_unavailable");
      return respond(origin, 200, { ...result.data, dispatched: await dispatchWorker() });
    }
    if (action === "refresh") {
      const result = await service.rpc("queue_crm_m365_manual_sync", {
        p_actor: actor, p_month: month ? `${month}-01` : null,
      });
      if (result.error?.code === "P0002") throw new CalendarError(409, "calendar_disconnected");
      if (result.error) throw new CalendarError(503, "calendar_refresh_unavailable");
      return respond(origin, 200, { ...result.data, dispatched: await dispatchWorker() });
    }
    if (action === "listConflicts") {
      const result = await service.rpc("list_crm_m365_conflicts", { p_actor: actor });
      if (result.error) throw new CalendarError(503, "calendar_conflicts_unavailable");
      return respond(origin, 200, { conflicts: result.data });
    }
    if (action === "restoreConflict") {
      const conflictId = String(body["conflictId"] ?? "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conflictId)) {
        throw new CalendarError(400, "invalid_conflict");
      }
      const result = await service.rpc("restore_crm_m365_conflict", {
        p_conflict_id: conflictId, p_actor: actor,
      });
      if (result.error?.code === "P0002") throw new CalendarError(409, "conflict_no_longer_open");
      if (result.error) throw new CalendarError(503, "conflict_restore_unavailable");
      return respond(origin, 200, { ...result.data, dispatched: await dispatchWorker() });
    }
    if (action === "disconnect") {
      const result = await service.rpc("disconnect_crm_m365_calendar", { p_actor: actor });
      if (result.error?.code === "P0002") throw new CalendarError(409, "calendar_disconnected");
      if (result.error) throw new CalendarError(503, "calendar_disconnect_unavailable");
      return respond(origin, 200, result.data);
    }
    throw new CalendarError(400, "invalid_action");
  } catch (error) {
    const safe = error instanceof CalendarError ? error : new CalendarError(503, "calendar_unavailable");
    return respond(origin, safe.status, { code: safe.code, retryAt: safe.retryAt ?? null });
  }
});
