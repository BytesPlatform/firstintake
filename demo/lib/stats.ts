/**
 * The numbers a firm is sent about its week and its day. Product-specific:
 * each product counts what its dashboard counts.
 */
import { dayStartUtc } from "./dash";
import { q } from "./db";

export interface WeekStats {
  calls: number;
  lines: { label: string; value: string }[];
}

export interface DayStats {
  calls: number;
  lines: { label: string; value: string }[];
  /** Open items on the dashboard's Needs-you list. */
  needsYou: number;
}

/** Today so far, in the firm's timezone, for the close-of-business email. */
export async function dayStats(tenantId: string, tz: string): Promise<DayStats> {
  const today = dayStartUtc(tz);
  const [s] = await q<{ calls: number; qualified: number; retainers: number; fee: number; tasks: number }>(
    `select (select count(*)::int from demo_calls where tenant_id = $1 and call_id not like 'form_%' and started_at >= $2) as calls,
            (select count(*)::int from demo_calls where tenant_id = $1 and qualification = 'qualified' and started_at >= $2) as qualified,
            (select count(*)::int from demo_matters where tenant_id = $1 and created_by_agent and stage = 'retainer_sent' and created_at >= $2) as retainers,
            (select coalesce(sum(fee_value),0)::float from demo_calls where tenant_id = $1 and matter_id is not null and started_at >= $2) as fee,
            (select count(*)::int from demo_tasks where tenant_id = $1 and status = 'open') as tasks`,
    [tenantId, today],
  );
  return {
    calls: s.calls,
    lines: [
      { label: "Leads answered", value: String(s.calls) },
      { label: "Qualified", value: String(s.qualified) },
      { label: "Retainers sent", value: String(s.retainers) },
      { label: "Fee value opened, at your typical fees", value: `$${Math.round(s.fee).toLocaleString()}` },
    ],
    needsYou: s.tasks,
  };
}

export async function weekStats(tenantId: string): Promise<WeekStats> {
  const [s] = await q<{ calls: number; qualified: number; retainers: number; fee: number; tasks: number }>(
    `select (select count(*)::int from demo_calls where tenant_id = $1 and call_id not like 'form_%' and started_at > now() - interval '7 days') as calls,
            (select count(*)::int from demo_calls where tenant_id = $1 and qualification = 'qualified' and started_at > now() - interval '7 days') as qualified,
            (select count(*)::int from demo_matters where tenant_id = $1 and created_by_agent and stage = 'retainer_sent' and created_at > now() - interval '7 days') as retainers,
            (select coalesce(sum(fee_value),0)::float from demo_calls where tenant_id = $1 and matter_id is not null and started_at > now() - interval '7 days') as fee,
            (select count(*)::int from demo_tasks where tenant_id = $1 and status = 'open') as tasks`,
    [tenantId],
  );
  return {
    calls: s.calls,
    lines: [
      { label: "Leads answered", value: String(s.calls) },
      { label: "Qualified", value: String(s.qualified) },
      { label: "Retainers sent", value: String(s.retainers) },
      { label: "Fee value opened, at your typical fees", value: `$${Math.round(s.fee).toLocaleString()}` },
      { label: "Attorney tasks open", value: String(s.tasks) },
    ],
  };
}
