/**
 * What the customer dashboard shows. Product-specific: the three numbers
 * are this firm's (new leads, qualified, callbacks due); the needs-you
 * list is the open task queue. Days run in the tenant's timezone, not
 * the server's.
 */

import { q } from "./db";
import { configOf } from "./tenant-config";
import type { Tenant } from "./tenancy";

export interface StatCard {
  label: string;
  today: number;
  yesterday: number;
}

export interface NeedsYouItem {
  /** Product-specific: this product uses task kinds and failed_message. */
  kind: string;
  id: string;
  title: string;
  detail: string;
  when: string;
  phone: string | null;
  /** Set when "Done" can clear it from the list. */
  canDone: boolean;
  /** Set when the item points at a call worth opening. */
  callId: string | null;
}

/** What the little green tag on a handled call says, in this product's words. */
export const BOOKED_TAG = "matter opened";
/** The upcoming panel's title, in this product's words. */
export const UPCOMING_TITLE = "Callbacks due";

export interface CallRow {
  call_id: string;
  flagged: boolean;
  started_at: string;
  ended_at: string | null;
  channel: string;
  from_number: string | null;
  /** For this product the tag slot carries the qualification. */
  urgency: string | null;
  outcome: string | null;
  after_hours: boolean;
  booked: boolean;
  ticket_value: number | null;
  summary: string | null;
  has_transcript: boolean;
  has_recording: boolean;
}

export interface CallDetail extends CallRow {
  transcript: string | null;
  recording_url: string | null;
  pipeline: { step: string; status: string; detail: string | null; occurred_at: string }[];
  events: { action: string; outcome: string | null; urgency: string | null; occurred_at: string }[];
  texts: { to_label: string | null; to_number: string; body: string; status: string; created_at: string }[];
}

export interface UpcomingVisit {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  worker_name: string | null;
  urgency: string;
  by_agent: boolean;
}

export interface HomeData {
  stats: StatCard[];
  needsYou: NeedsYouItem[];
  todaysCalls: CallRow[];
  upcoming: UpcomingVisit[];
  agent: {
    published: boolean;
    phoneNumber: string | null;
    weekCalls: number;
    avgSeconds: number | null;
  };
  hasAnyCalls: boolean;
  timezone: string;
}

/** Midnight, `daysBack` days ago, in the tenant's timezone, as a UTC instant. */
export function dayStartUtc(tz: string, daysBack = 0): Date {
  const now = new Date();
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysBack);
    return d;
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const midnightAsUtc = Date.UTC(get("year"), get("month") - 1, get("day") - daysBack);
  return new Date(midnightAsUtc - offsetMs);
}

const TASK_TITLES: Record<string, string> = {
  attorney_callback: "Attorney callback",
  conflict_review: "Conflict review",
  referral: "Referral to place",
  callback: "Intake callback",
};

/* The firm's calls table: the tag slot carries the qualification, a call
   counts as handled when a matter was opened, and web form leads
   (call_id like form_) stay out of the call counts. */
const CALL_COLS = `call_id, false as flagged, started_at, ended_at, channel, from_number,
       qualification as urgency, outcome, after_hours,
       (matter_id is not null) as booked, fee_value::float as ticket_value, summary,
       (transcript is not null) as has_transcript, (recording_url is not null) as has_recording`;

export async function homeData(tenant: Tenant): Promise<HomeData> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const today = dayStartUtc(tz);
  const yesterday = dayStartUtc(tz, 1);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const [callCounts] = await q<{ t_leads: number; t_qualified: number; y_leads: number; y_qualified: number; all_calls: number }>(
    `select count(*) filter (where started_at >= $2)::int as t_leads,
            count(*) filter (where started_at >= $2 and qualification = 'qualified')::int as t_qualified,
            count(*) filter (where started_at >= $3 and started_at < $2)::int as y_leads,
            count(*) filter (where started_at >= $3 and started_at < $2 and qualification = 'qualified')::int as y_qualified,
            count(*)::int as all_calls
       from demo_calls where tenant_id = $1 and call_id not like 'form_%'`,
    [tenant.id, today, yesterday],
  );
  const [taskCounts] = await q<{ due_today: number; due_yesterday: number }>(
    `select count(*) filter (where due_at >= $2 and due_at < $4 and status = 'open')::int as due_today,
            count(*) filter (where due_at >= $3 and due_at < $2)::int as due_yesterday
       from demo_tasks where tenant_id = $1`,
    [tenant.id, today, yesterday, tomorrow],
  );

  const stats: StatCard[] = [
    { label: "New leads", today: callCounts.t_leads, yesterday: callCounts.y_leads },
    { label: "Qualified", today: callCounts.t_qualified, yesterday: callCounts.y_qualified },
    { label: "Callbacks due", today: taskCounts.due_today, yesterday: taskCounts.due_yesterday },
  ];

  const tasks = await q<{ id: number; call_id: string | null; kind: string; assigned_to: string | null; due_at: string | null; priority: string; note: string | null; created_at: string; reference: string | null }>(
    `select t.id, t.call_id, t.kind, t.assigned_to, t.due_at, t.priority, t.note, t.created_at, m.reference
       from demo_tasks t left join demo_matters m on m.id = t.matter_id and m.tenant_id = t.tenant_id
      where t.tenant_id = $1 and t.status = 'open' order by t.due_at asc nulls last limit 8`,
    [tenant.id],
  );
  const failed = await q<{ id: number; to_address: string; body: string; created_at: string }>(
    `select id, to_address, body, created_at from outbound_messages
      where tenant_id = $1 and status = 'failed' and created_at > now() - interval '7 days'
      order by created_at desc limit 5`,
    [tenant.id],
  );
  const staffName = new Map(c.staff.map((s) => [s.id, s.firstName]));

  const needsYou: NeedsYouItem[] = [
    ...tasks.map((t) => ({
      kind: "task",
      id: String(t.id),
      title: `${TASK_TITLES[t.kind] ?? t.kind}${t.reference ? ` · ${t.reference}` : ""}`,
      detail: [t.note, t.assigned_to ? `for ${staffName.get(t.assigned_to) ?? t.assigned_to}` : null, t.priority !== "normal" ? t.priority : null]
        .filter(Boolean)
        .join(" · ") || "Open task from the assistant.",
      when: t.due_at ?? t.created_at,
      phone: null,
      canDone: true,
      callId: t.call_id,
    })),
    ...failed.map((r) => ({
      kind: "failed_message",
      id: String(r.id),
      title: `A message to ${r.to_address} failed`,
      detail: r.body.slice(0, 120),
      when: r.created_at,
      phone: null,
      canDone: false,
      callId: null,
    })),
  ];

  const todaysCalls = await q<CallRow>(
    `select ${CALL_COLS} from demo_calls
      where tenant_id = $1 and started_at >= $2 and call_id not like 'form_%'
      order by started_at desc limit 8`,
    [tenant.id, today],
  );

  const upcomingRows = await q<{ id: number; kind: string; due_at: string; priority: string; assigned_to: string | null; reference: string | null; contact: string | null }>(
    `select t.id, t.kind, t.due_at, t.priority, t.assigned_to, m.reference,
            (select co.first_name || ' ' || left(co.last_name, 1) || '.' from demo_contacts co where co.id = m.contact_id and co.tenant_id = t.tenant_id) as contact
       from demo_tasks t left join demo_matters m on m.id = t.matter_id and m.tenant_id = t.tenant_id
      where t.tenant_id = $1 and t.status = 'open' and t.due_at is not null and t.kind = 'attorney_callback'
      order by t.due_at asc limit 4`,
    [tenant.id],
  );
  const upcoming: UpcomingVisit[] = upcomingRows.map((t) => ({
    id: String(t.id),
    title: `${TASK_TITLES[t.kind] ?? t.kind}${t.reference ? ` · ${t.reference}` : ""}`,
    starts_at: t.due_at,
    ends_at: t.due_at,
    client_name: t.contact || "New caller",
    worker_name: (t.assigned_to && staffName.get(t.assigned_to)) || null,
    urgency: t.priority === "urgent" ? "emergency" : t.priority === "high" ? "urgent" : "routine",
    by_agent: true,
  }));

  const [week] = await q<{ calls: number; avg_seconds: number | null }>(
    `select count(*)::int as calls,
            avg(extract(epoch from (ended_at - started_at)))::float as avg_seconds
       from demo_calls
      where tenant_id = $1 and started_at > now() - interval '7 days' and ended_at is not null and call_id not like 'form_%'`,
    [tenant.id],
  );

  return {
    stats,
    needsYou,
    todaysCalls,
    upcoming,
    agent: {
      published: Boolean(tenant.retell_agent_id),
      phoneNumber: tenant.phone_number || c.phone.existingNumber || null,
      weekCalls: week?.calls ?? 0,
      avgSeconds: week?.avg_seconds ?? null,
    },
    hasAnyCalls: callCounts.all_calls > 0,
    timezone: tz,
  };
}

export async function listCalls(tenantId: string, limit = 50): Promise<CallRow[]> {
  return q<CallRow>(
    `select ${CALL_COLS} from demo_calls
      where tenant_id = $1 and call_id not like 'form_%' order by started_at desc limit $2`,
    [tenantId, limit],
  );
}

export async function callDetail(tenantId: string, callId: string): Promise<CallDetail | null> {
  const [call] = await q<CallDetail>(
    `select ${CALL_COLS}, transcript, recording_url from demo_calls where tenant_id = $1 and call_id = $2`,
    [tenantId, callId],
  );
  if (!call) return null;
  call.pipeline = await q(
    `select step, status, detail, occurred_at from pipeline_events
      where tenant_id = $1 and call_id = $2 order by id asc limit 40`,
    [tenantId, callId],
  );
  call.events = await q(
    `select action, outcome, null as urgency, occurred_at from call_events
      where tenant_id = $1 and call_id = $2 order by id asc limit 40`,
    [tenantId, callId],
  );
  call.texts = await q(
    `select to_label, to_address as to_number, body, status, created_at from outbound_messages
      where tenant_id = $1 and call_id = $2 order by id asc limit 20`,
    [tenantId, callId],
  );
  return call;
}

/** "Done" on a Needs-you row, routed by the product-specific kind. */
export async function markNeedsDone(tenantId: string, kind: string, id: string): Promise<void> {
  if (kind === "task") {
    await q(`update demo_tasks set status = 'done' where tenant_id = $1 and id = $2 and status = 'open'`, [tenantId, Number(id)]);
  }
}

/** Open tasks grouped for the Schedule page: overdue, then day by day. */
export interface DayTasks {
  label: string;
  tasks: { id: number; kind: string; due_at: string | null; priority: string; note: string | null; assigned: string | null; reference: string | null; contact: string | null; callId: string | null }[];
}

export async function callbackBoard(tenant: Tenant): Promise<{ days: DayTasks[]; timezone: string }> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const today = dayStartUtc(tz);
  const staffName = new Map(c.staff.map((s) => [s.id, s.name]));
  const rows = await q<{ id: number; kind: string; due_at: string | null; priority: string; note: string | null; assigned_to: string | null; call_id: string | null; reference: string | null; contact: string | null }>(
    `select t.id, t.kind, t.due_at, t.priority, t.note, t.assigned_to, t.call_id, m.reference,
            (select co.first_name || ' ' || left(co.last_name, 1) || '.' from demo_contacts co where co.id = m.contact_id and co.tenant_id = t.tenant_id) as contact
       from demo_tasks t left join demo_matters m on m.id = t.matter_id and m.tenant_id = t.tenant_id
      where t.tenant_id = $1 and t.status = 'open'
      order by t.due_at asc nulls last limit 60`,
    [tenant.id],
  );
  const dayIndex = (iso: string | null): number => {
    if (!iso) return 99;
    const diff = Math.floor((new Date(iso).getTime() - today.getTime()) / 86_400_000);
    return diff < 0 ? -1 : diff;
  };
  const labels = new Map<number, string>([
    [-1, "Overdue"],
    [0, "Today"],
    [1, "Tomorrow"],
    [99, "No due time"],
  ]);
  const groups = new Map<number, DayTasks>();
  for (const r of rows) {
    const idx = dayIndex(r.due_at);
    const label =
      labels.get(idx) ??
      new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz }).format(new Date(r.due_at!));
    if (!groups.has(idx)) groups.set(idx, { label, tasks: [] });
    groups.get(idx)!.tasks.push({
      id: r.id,
      kind: TASK_TITLES[r.kind] ?? r.kind,
      due_at: r.due_at,
      priority: r.priority,
      note: r.note,
      assigned: (r.assigned_to && staffName.get(r.assigned_to)) || r.assigned_to,
      reference: r.reference,
      contact: r.contact,
      callId: r.call_id,
    });
  }
  const days = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  return { days, timezone: tz };
}

/** This month's answered minutes against the plan, for the billing card. */
export async function monthUsage(tenant: Tenant): Promise<{ minutes: number; included: number; plan: string }> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const now = dayStartUtc(tz);
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  const [row] = await q<{ seconds: number }>(
    `select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)::float as seconds
       from demo_calls where tenant_id = $1 and started_at >= $2 and ended_at is not null`,
    [tenant.id, monthStart],
  );
  return { minutes: Math.ceil((row?.seconds ?? 0) / 60), included: tenant.included_minutes ?? 0, plan: tenant.plan || "trial" };
}
