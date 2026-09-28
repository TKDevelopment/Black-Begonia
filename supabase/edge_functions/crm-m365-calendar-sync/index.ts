import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Database = ReturnType<typeof createClient<any>>;
type Projection = {
  eligible: boolean; sourceType?: string; sourceId?: string; title?: string;
  start?: string; end?: string; allDay?: boolean; timezone?: string; isInactive?: boolean;
};
type Association = {
  association_id: string; connection_id: string; source_type: string; source_id: string;
  graph_event_id: string | null; transaction_id: string;
  last_export_fingerprint: string | null; last_export_change_key: string | null;
  state: "creating" | "active" | "conflict" | "retired";
};
type Outbox = {
  outbox_id: string; source_type: string; source_id: string; generation: number; attempt_count: number;
};
type Run = {
  claimed: boolean; owner: string; runId: string; connectionId: string;
  mailboxUpn: string; calendarId: string; isPrimary: boolean; timezone: string;
  trigger: string; requestedMonth: string | null;
};
type GraphEvent = {
  id: string; subject?: string; isAllDay?: boolean; isCancelled?: boolean;
  showAs?: string;
  sensitivity?: string; changeKey?: string; "@odata.etag"?: string;
  transactionId?: string; seriesMasterId?: string; webLink?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  "@removed"?: Record<string, unknown>;
};
type Snapshot = { title: string; start: string; end: string; allDay: boolean; inactive: boolean };
type SanitizedChange = {
  id: string; deleted?: boolean; seriesMasterId?: string | null;
  startAt?: string; endAt?: string; localStartDate?: string; localEndDate?: string;
  isAllDay?: boolean; isPrivate?: boolean; isCanceled?: boolean;
  title?: string; location?: string | null; outlookWebUrl?: string | null;
};

class SyncError extends Error {
  constructor(readonly code: string, readonly retrySeconds = 60) { super(code); }
}
const env = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new SyncError("sync_not_configured");
  return value;
};
const reply = (status: number, body: unknown): Response => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const safeRetry = (response: Response, attempt = 1): number => {
  const header = Number(response.headers.get("Retry-After"));
  return Number.isFinite(header) && header > 0
    ? Math.min(3600, Math.ceil(header)) : Math.min(3600, 15 * 2 ** Math.min(8, attempt));
};

async function accessToken(): Promise<string> {
  const form = new URLSearchParams({
    client_id: env("M365_CLIENT_ID"), client_secret: env("M365_CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(env("M365_TENANT_ID"))}/oauth2/v2.0/token`,
    { method: "POST", body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new SyncError("authorization_lost", safeRetry(response));
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new SyncError("authorization_lost");
  try {
    const claims = JSON.parse(atob(payload.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      roles?: string[];
    };
    if (claims.roles?.some((role) => role.startsWith("Calendars."))) {
      throw new SyncError("authorization_lost");
    }
  } catch { throw new SyncError("authorization_lost"); }
  return payload.access_token;
}

async function graph(urlOrPath: string, token: string, options: {
  method?: string; body?: unknown; ifMatch?: string; attempt?: number;
} = {}): Promise<Response> {
  const url = new URL(urlOrPath.startsWith("/")
    ? `https://graph.microsoft.com/v1.0${urlOrPath}` : urlOrPath);
  if (url.origin !== "https://graph.microsoft.com" || !url.pathname.startsWith("/v1.0/")) {
    throw new SyncError("invalid_graph_url");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'IdType="ImmutableId", outlook.timezone="UTC"',
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.ifMatch ? { "If-Match": options.ifMatch } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(12000),
    });
  } catch { throw new SyncError("graph_unavailable", Math.min(3600, 15 * 2 ** Math.min(8, options.attempt ?? 1))); }
  if (response.status === 429 || response.status >= 500) {
    throw new SyncError(response.status === 429 ? "graph_throttled" : "graph_unavailable",
      safeRetry(response, options.attempt));
  }
  if (response.status === 401 || response.status === 403) throw new SyncError("authorization_lost", 300);
  return response;
}

const calendarPath = (run: Run): string =>
  `/users/${encodeURIComponent(run.mailboxUpn)}/calendars/${encodeURIComponent(run.calendarId)}`;
const eventPath = (run: Run, id: string): string => `${calendarPath(run)}/events/${encodeURIComponent(id)}`;

function graphTimezone(zone: string): string {
  const zones: Record<string, string> = {
    "America/New_York": "Eastern Standard Time", "America/Chicago": "Central Standard Time",
    "America/Denver": "Mountain Standard Time", "America/Los_Angeles": "Pacific Standard Time",
    "UTC": "UTC", "Etc/UTC": "UTC",
  };
  const result = zones[zone];
  if (!result) throw new SyncError("unsupported_timezone");
  return result;
}
function localParts(instant: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const value = (name: string): string => parts.find((part) => part.type === name)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}
function localDate(instant: string, zone: string): string { return localParts(instant, zone).slice(0, 10); }
function nextDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function monthEnd(value: string): string {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}
function localMidnightUtc(day: string, zone: string): string {
  const approximate = new Date(`${day}T00:00:00Z`).getTime();
  const local = localParts(new Date(approximate).toISOString(), zone);
  const interpreted = new Date(`${local}Z`).getTime();
  return new Date(approximate - (interpreted - approximate)).toISOString();
}
function payloadFor(projection: Projection, transactionId?: string): Record<string, unknown> {
  if (!projection.title || !projection.start || !projection.end || !projection.timezone) {
    throw new SyncError("invalid_crm_projection");
  }
  const zone = projection.timezone;
  const graphZone = graphTimezone(zone);
  const allDay = projection.allDay === true;
  return {
    subject: projection.title,
    start: { dateTime: allDay ? `${projection.start}T00:00:00` : localParts(projection.start, zone),
      timeZone: graphZone },
    end: { dateTime: allDay ? `${projection.end}T00:00:00` : localParts(projection.end, zone),
      timeZone: graphZone },
    isAllDay: allDay, showAs: projection.isInactive ? "free" : "busy",
    location: { displayName: "" },
    ...(transactionId ? { transactionId } : {}),
  };
}
function snapshotFor(projection: Projection): Snapshot {
  return {
    title: projection.title ?? "",
    start: projection.allDay ? projection.start ?? "" : new Date(projection.start ?? "").toISOString(),
    end: projection.allDay ? projection.end ?? "" : new Date(projection.end ?? "").toISOString(),
    allDay: projection.allDay === true, inactive: projection.isInactive === true,
  };
}
function remoteChanges(remote: GraphEvent, snapshot: Snapshot, zone: string): string[] {
  const fields: string[] = [];
  if ((remote.subject ?? "") !== snapshot.title) fields.push("title");
  if (remote.isAllDay !== snapshot.allDay) fields.push("allDay");
  if (!remote.start?.dateTime || !remote.end?.dateTime) return [...fields, "time"];
  const remoteStart = snapshot.allDay
    ? localDate(`${remote.start.dateTime.replace(/Z$/, "")}Z`, zone)
    : new Date(`${remote.start.dateTime.replace(/Z$/, "")}Z`).toISOString();
  const remoteEnd = snapshot.allDay
    ? localDate(`${remote.end.dateTime.replace(/Z$/, "")}Z`, zone)
    : new Date(`${remote.end.dateTime.replace(/Z$/, "")}Z`).toISOString();
  if (remoteStart !== snapshot.start) fields.push("start");
  if (remoteEnd !== snapshot.end) fields.push("end");
  if ((remote.location?.displayName ?? "") !== "") fields.push("location");
  if ((remote.showAs === "free") !== snapshot.inactive) fields.push("availability");
  return fields;
}
const etag = (event: GraphEvent): string | null => event["@odata.etag"] ?? event.changeKey ?? null;

async function createConflict(db: Database, association: Association, remote: GraphEvent | null,
  fields: string[], outboxId?: string): Promise<void> {
  const isPrivate = remote?.sensitivity === "private" || remote?.sensitivity === "confidential";
  const existing = await db.from("crm_m365_sync_conflicts").select("conflict_id,status")
    .eq("association_id", association.association_id).in("status", ["open", "restoring"]).maybeSingle();
  if (existing.error) throw new SyncError("conflict_record_failed");
  if (existing.data?.status === "restoring") {
    const reopened = await db.from("crm_m365_sync_conflicts").update({
      status: "open", reviewed_at: null, reviewed_by: null, resolved_at: null,
      remote_change_key: remote ? etag(remote) : null,
      changed_fields: fields, remote_title: isPrivate ? null : remote?.subject ?? null,
      remote_start_at: null, remote_end_at: null, is_remote_private: isPrivate,
    }).eq("conflict_id", existing.data.conflict_id);
    if (reopened.error) throw new SyncError("conflict_record_failed");
  } else if (!existing.data) {
    const inserted = await db.from("crm_m365_sync_conflicts").insert({
      association_id: association.association_id, remote_change_key: remote ? etag(remote) : null,
      changed_fields: fields, remote_title: isPrivate ? null : remote?.subject ?? null,
      remote_start_at: null, remote_end_at: null, is_remote_private: isPrivate,
    });
    if (inserted.error) throw new SyncError("conflict_record_failed");
  }
  const linked = await db.from("crm_m365_event_associations").update({ state: "conflict" })
    .eq("association_id", association.association_id);
  if (linked.error) throw new SyncError("conflict_record_failed");
  if (outboxId) await db.from("crm_m365_calendar_outbox").update({
    state: "blocked_conflict", lease_expires_at: null,
  }).eq("outbox_id", outboxId);
}

async function updateAssociation(db: Database, associationId: string,
  graphEvent: GraphEvent | null, projection: Projection, state: "active" | "retired"): Promise<void> {
  const result = await db.from("crm_m365_event_associations").update({
    graph_event_id: graphEvent?.id ?? null,
    last_export_change_key: graphEvent ? etag(graphEvent) : null,
    last_export_fingerprint: JSON.stringify(snapshotFor(projection)),
    state, last_exported_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("association_id", associationId);
  if (result.error) throw new SyncError("association_update_failed");
}

async function processOutbox(db: Database, run: Run, token: string): Promise<{ exported: number; conflicts: number; failed: number }> {
  let exported = 0; let conflicts = 0; let failed = 0;
  for (let batch = 0; batch < 2; batch++) {
    const claimed = await db.rpc("claim_crm_m365_outbox", { p_limit: 100 });
    if (claimed.error) throw new SyncError("outbox_claim_failed");
    const jobs = (claimed.data ?? []) as Outbox[];
    if (jobs.length === 0) break;
    for (const job of jobs) {
    try {
      const projectionResult = await db.rpc("get_crm_m365_export_projection", {
        p_source_type: job.source_type, p_source_id: job.source_id,
      });
      if (projectionResult.error) throw new SyncError("export_projection_failed");
      const projection = projectionResult.data as Projection;
      const found = await db.from("crm_m365_event_associations").select("*")
        .eq("connection_id", run.connectionId).eq("source_type", job.source_type)
        .eq("source_id", job.source_id).maybeSingle();
      if (found.error) throw new SyncError("association_read_failed");
      let association = found.data as Association | null;
      if (!association && !projection.eligible) {
        await db.rpc("ack_crm_m365_outbox", {
          p_outbox_id: job.outbox_id, p_generation: job.generation, p_success: true,
        });
        continue;
      }
      if (!association) {
        const created = await db.from("crm_m365_event_associations").insert({
          connection_id: run.connectionId, source_type: job.source_type, source_id: job.source_id,
          transaction_id: crypto.randomUUID(), state: "creating",
        }).select("*").single();
        if (created.error || !created.data) throw new SyncError("association_create_failed");
        association = created.data as Association;
      }
      if (association.state === "retired" && projection.eligible) {
        const reset = await db.from("crm_m365_event_associations").update({
          graph_event_id: null, transaction_id: crypto.randomUUID(),
          state: "creating", last_export_change_key: null,
        }).eq("association_id", association.association_id).select("*").single();
        if (reset.error || !reset.data) throw new SyncError("association_update_failed");
        association = reset.data as Association;
      }
      const conflict = await db.from("crm_m365_sync_conflicts").select("*")
        .eq("association_id", association.association_id)
        .in("status", ["open", "restoring"]).maybeSingle();
      if (conflict.error) throw new SyncError("conflict_read_failed");
      if (conflict.data?.status === "open") {
        await db.from("crm_m365_calendar_outbox").update({ state: "blocked_conflict", lease_expires_at: null })
          .eq("outbox_id", job.outbox_id);
        continue;
      }
      let remote: GraphEvent | null = null;
      if (association.graph_event_id) {
        const response = await graph(eventPath(run, association.graph_event_id), token, { attempt: job.attempt_count });
        if (response.ok) remote = await response.json() as GraphEvent;
        else if (response.status !== 404) throw new SyncError("graph_unavailable");
      }
      if (conflict.data?.status === "restoring") {
        if (remote && conflict.data.remote_change_key && etag(remote) !== conflict.data.remote_change_key) {
          await db.from("crm_m365_sync_conflicts").update({ status: "open", reviewed_at: null,
            reviewed_by: null, remote_change_key: etag(remote) }).eq("conflict_id", conflict.data.conflict_id);
          await db.from("crm_m365_calendar_outbox").update({ state: "blocked_conflict", lease_expires_at: null })
            .eq("outbox_id", job.outbox_id);
          continue;
        }
      } else if (remote && association.last_export_fingerprint) {
        const fields = remoteChanges(remote, JSON.parse(association.last_export_fingerprint) as Snapshot,
          projection.timezone ?? run.timezone);
        if (fields.length) {
          await createConflict(db, association, remote, fields, job.outbox_id);
          conflicts++;
          continue;
        }
      } else if (!remote && association.graph_event_id && projection.eligible) {
        await createConflict(db, association, null, ["deleted"], job.outbox_id);
        conflicts++;
        continue;
      }
      if (!projection.eligible) {
        if (remote && association.graph_event_id) {
          const deleted = await graph(eventPath(run, association.graph_event_id), token,
            { method: "DELETE", ifMatch: etag(remote) ?? undefined, attempt: job.attempt_count });
          if (!deleted.ok && deleted.status !== 404) throw new SyncError("export_failed");
        }
        const retired = await db.from("crm_m365_event_associations")
          .update({ state: "retired", last_exported_at: new Date().toISOString() })
          .eq("association_id", association.association_id);
        if (retired.error) throw new SyncError("association_update_failed");
      } else if (!association.graph_event_id || !remote) {
        if (association.graph_event_id && !remote) {
          const reset = await db.from("crm_m365_event_associations").update({
            graph_event_id: null, transaction_id: crypto.randomUUID(),
            last_export_change_key: null, state: "creating",
          }).eq("association_id", association.association_id).select("*").single();
          if (reset.error || !reset.data) throw new SyncError("association_update_failed");
          association = reset.data as Association;
        }
        const response = await graph(`${calendarPath(run)}/events`, token, {
          method: "POST", body: payloadFor(projection, association.transaction_id), attempt: job.attempt_count,
        });
        if (!response.ok) throw new SyncError("export_failed");
        const created = await response.json() as GraphEvent;
        if (!created.id) throw new SyncError("export_failed");
        await updateAssociation(db, association.association_id, created, projection, "active");
        exported++;
      } else {
        const nextSnapshot = JSON.stringify(snapshotFor(projection));
        if (association.last_export_fingerprint !== nextSnapshot || conflict.data?.status === "restoring") {
          const response = await graph(eventPath(run, association.graph_event_id), token, {
            method: "PATCH", body: payloadFor(projection), ifMatch: etag(remote) ?? undefined,
            attempt: job.attempt_count,
          });
          if (response.status === 412) {
            await createConflict(db, association, remote, ["changed_during_restore"], job.outbox_id);
            conflicts++;
            continue;
          }
          if (!response.ok) throw new SyncError("export_failed");
          const updated = await response.json() as GraphEvent;
          await updateAssociation(db, association.association_id, updated, projection, "active");
          exported++;
        }
      }
      if (conflict.data?.status === "restoring") {
        await db.from("crm_m365_sync_conflicts").update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("conflict_id", conflict.data.conflict_id);
      }
      await db.rpc("ack_crm_m365_outbox", {
        p_outbox_id: job.outbox_id, p_generation: job.generation, p_success: true,
      });
    } catch (error) {
      const failure = error instanceof SyncError ? error : new SyncError("export_failed");
      failed++;
      await db.rpc("ack_crm_m365_outbox", {
        p_outbox_id: job.outbox_id, p_generation: job.generation,
        p_success: false, p_error_code: failure.code, p_retry_seconds: failure.retrySeconds,
      });
      if (failure.code === "graph_throttled" || failure.code === "authorization_lost") throw failure;
    }
    }
    if (jobs.length < 100) break;
  }
  return { exported, conflicts, failed };
}

function instantFromGraph(value: { dateTime: string; timeZone: string } | undefined): string {
  if (!value?.dateTime) throw new SyncError("invalid_graph_event");
  // Graph is requested with outlook.timezone="UTC"; reject a response in another zone
  // rather than guessing an offset from a named Windows time zone.
  if (value.timeZone.toUpperCase() !== "UTC") throw new SyncError("invalid_graph_timezone");
  const raw = value.dateTime;
  const parsed = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) throw new SyncError("invalid_graph_event");
  return parsed.toISOString();
}
function safeOutlookUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !["outlook.office.com", "outlook.office365.com"].includes(url.hostname)) {
      return null;
    }
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}
function sanitize(event: GraphEvent, zone: string): SanitizedChange {
  if (event["@removed"]) return { id: event.id, deleted: true };
  const startAt = instantFromGraph(event.start);
  const endAt = instantFromGraph(event.end);
  if (new Date(endAt) <= new Date(startAt)) throw new SyncError("invalid_graph_event");
  const first = localDate(startAt, zone);
  const endLocal = localDate(endAt, zone);
  const allDay = event.isAllDay === true;
  const endDate = allDay ? endLocal :
    localParts(endAt, zone).endsWith("T00:00:00") ? endLocal : nextDate(endLocal);
  const privateEvent = event.sensitivity === "private" || event.sensitivity === "confidential";
  return {
    id: event.id, seriesMasterId: event.seriesMasterId ?? null,
    startAt, endAt, localStartDate: first,
    localEndDate: endDate > first ? endDate : nextDate(first),
    isAllDay: allDay, isPrivate: privateEvent, isCanceled: event.isCancelled === true,
    title: privateEvent ? "Private event" : (event.subject?.trim() || "Untitled event").slice(0, 240),
    location: privateEvent ? null : (event.location?.displayName?.trim().slice(0, 240) ?? null),
    outlookWebUrl: safeOutlookUrl(event.webLink),
  };
}

async function detectLinkedChange(db: Database, association: Association, event: GraphEvent,
  zone: string): Promise<boolean> {
  if (association.state === "conflict" || !association.last_export_fingerprint) return false;
  const fields = event["@removed"] ? ["deleted"] :
    remoteChanges(event, JSON.parse(association.last_export_fingerprint) as Snapshot, zone);
  if (!fields.length) return false;
  await createConflict(db, association, event["@removed"] ? null : event, fields);
  return true;
}

async function scanMonth(db: Database, run: Run, token: string, month: string): Promise<{
  imported: number; conflicts: number;
}> {
  const current = await db.from("crm_m365_sync_months")
    .select("opaque_delta_link,last_successful_scan_at")
    .eq("connection_id", run.connectionId).eq("month_start", month).maybeSingle();
  if (current.error) throw new SyncError("month_state_unavailable");
  const full = !run.isPrimary || !current.data?.opaque_delta_link;
  const startAt = localMidnightUtc(month, run.timezone);
  const endAt = localMidnightUtc(monthEnd(month), run.timezone);
  const params = new URLSearchParams({ startDateTime: startAt, endDateTime: endAt });
  if (!run.isPrimary) {
    params.set("$select", "id,subject,start,end,isAllDay,isCancelled,sensitivity,seriesMasterId,webLink,changeKey,transactionId,location,showAs");
    params.set("$top", "200");
  }
  let next = run.isPrimary
    ? current.data?.opaque_delta_link ||
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(run.mailboxUpn)}/calendarView/delta?${params}`
    : `https://graph.microsoft.com/v1.0${calendarPath(run)}/calendarView?${params}`;
  const changes: SanitizedChange[] = [];
  const linked = await db.from("crm_m365_event_associations").select("*")
    .eq("connection_id", run.connectionId).in("state", ["active", "creating", "conflict"]);
  if (linked.error) throw new SyncError("association_read_failed");
  const byGraph = new Map<string, Association>();
  const byTransaction = new Map<string, Association>();
  for (const association of (linked.data ?? []) as Association[]) {
    if (association.graph_event_id) byGraph.set(association.graph_event_id, association);
    byTransaction.set(association.transaction_id, association);
  }
  const seen = new Set<string>();
  let deltaLink: string | null = null;
  let conflicts = 0;
  let pages = 0;
  while (next && pages++ < 50) {
    const response = await graph(next, token);
    if (response.status === 410 && run.isPrimary) {
      const reset = await db.from("crm_m365_sync_months").update({ opaque_delta_link: null })
        .eq("connection_id", run.connectionId).eq("month_start", month);
      if (reset.error) throw new SyncError("month_state_unavailable");
      throw new SyncError("delta_expired", 15);
    }
    if (!response.ok) throw new SyncError("scan_failed", safeRetry(response));
    const page = await response.json() as {
      value?: GraphEvent[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string;
    };
    for (const event of page.value ?? []) {
      if (!event.id) continue;
      const association = byGraph.get(event.id) ||
        (event.transactionId ? byTransaction.get(event.transactionId) : undefined);
      if (association) {
        seen.add(association.association_id);
        if (!association.graph_event_id && !event["@removed"]) {
          const linkedEvent = await db.from("crm_m365_event_associations")
            .update({ graph_event_id: event.id })
            .eq("association_id", association.association_id);
          if (linkedEvent.error) throw new SyncError("association_update_failed");
        }
        if (await detectLinkedChange(db, association, event, run.timezone)) conflicts++;
      } else {
        changes.push(sanitize(event, run.timezone));
      }
    }
    next = page["@odata.nextLink"] ?? "";
    if (page["@odata.deltaLink"]) deltaLink = page["@odata.deltaLink"] ?? null;
  }
  if (next || (run.isPrimary && !deltaLink)) throw new SyncError("scan_incomplete");
  if (full) {
    for (const association of (linked.data ?? []) as Association[]) {
      if (!association.graph_event_id || !association.last_export_fingerprint || seen.has(association.association_id)
        || association.state === "conflict") continue;
      const snapshot = JSON.parse(association.last_export_fingerprint) as Snapshot;
      const date = snapshot.allDay ? snapshot.start : localDate(snapshot.start, run.timezone);
      if (date >= month && date < monthEnd(month)) {
        await createConflict(db, association, null, ["deleted"]);
        conflicts++;
      }
    }
  }
  const committed = await db.rpc("commit_crm_m365_month_scan", {
    p_run: run.runId, p_owner: run.owner, p_month: month,
    p_mode: full ? "full" : "delta", p_changes: changes,
    p_delta_link: run.isPrimary ? deltaLink : null,
  });
  if (committed.error) throw new SyncError("scan_commit_failed");
  return { imported: Number(committed.data ?? 0), conflicts };
}

async function monthsForRun(db: Database, run: Run): Promise<string[]> {
  if (run.requestedMonth) return [run.requestedMonth];
  const result = await db.rpc("list_crm_m365_tracked_months");
  if (result.error) throw new SyncError("tracked_months_unavailable");
  return ((result.data ?? []) as Array<{ month_start: string }>).map((row) => row.month_start).slice(0, 15);
}

function equalSecret(actual: string, expected: string): boolean {
  if (!expected || actual.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < actual.length; i++) different |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return different === 0;
}

serve(async (request) => {
  if (request.method !== "POST" || !equalSecret(request.headers.get("x-crm-m365-scheduler-secret") ?? "",
    Deno.env.get("CRM_M365_SCHEDULER_SECRET") ?? "")) return reply(401, { code: "unauthorized" });
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } });
  const claim = await db.rpc("claim_crm_m365_sync_run");
  if (claim.error) return reply(503, { code: "sync_unavailable" });
  const run = claim.data as Run;
  if (!run?.claimed) return reply(200, { status: "idle" });
  let exported = 0; let imported = 0; let conflicts = 0; let failed = 0;
  let errorCode: string | null = null;
  try {
    const token = await accessToken();
    const months = await monthsForRun(db, run);
    for (const month of months) {
      try {
        const result = await scanMonth(db, run, token, month);
        imported += result.imported;
        conflicts += result.conflicts;
      } catch (error) {
        const safe = error instanceof SyncError ? error : new SyncError("scan_failed");
        await db.from("crm_m365_sync_months").update({
          last_error_code: safe.code,
          retry_after_at: new Date(Date.now() + safe.retrySeconds * 1000).toISOString(),
        }).eq("connection_id", run.connectionId).eq("month_start", month);
        failed++;
        errorCode = safe.code;
        if (safe.code === "graph_throttled" || safe.code === "authorization_lost") break;
      }
    }
    if (errorCode !== "graph_throttled" && errorCode !== "authorization_lost") {
      const outbound = await processOutbox(db, run, token);
      exported += outbound.exported;
      conflicts += outbound.conflicts;
      failed += outbound.failed;
      if (outbound.failed && !errorCode) errorCode = "export_failed";
    }
  } catch (error) {
    errorCode = error instanceof SyncError ? error.code : "sync_unavailable";
    failed++;
  }
  const finished = await db.rpc("finish_crm_m365_sync_run", {
    p_run: run.runId, p_owner: run.owner,
    p_status: failed ? "failed" : "succeeded", p_error_code: errorCode,
    p_exported: exported, p_imported: imported, p_conflicts: conflicts,
  });
  if (finished.error || finished.data !== true) return reply(503, { code: "run_completion_unavailable" });
  return reply(failed ? 503 : 200, {
    status: failed ? "failed" : "succeeded", exported, imported, conflicts,
    code: errorCode,
  });
});
