/**
 * What the dashboard shows before the first real call: believable rows
 * marked "Example", so a new firm sees what the screens will hold.
 * They disappear on the first real event. Product-specific copy.
 */

import type { CallRow, NeedsYouItem, StatCard, UpcomingVisit } from "./dash";
import { dayStartUtc } from "./dash";

export interface ExampleHome {
  stats: StatCard[];
  needsYou: NeedsYouItem[];
  todaysCalls: CallRow[];
  upcoming: UpcomingVisit[];
}

function at(base: Date, hours: number, minutes = 0): string {
  return new Date(base.getTime() + (hours * 60 + minutes) * 60_000).toISOString();
}

export function exampleHome(tz: string): ExampleHome {
  const today = dayStartUtc(tz);
  const call = (n: number, row: Partial<CallRow>): CallRow => ({
    call_id: `example_${n}`,
    flagged: false,
    started_at: at(today, 8),
    ended_at: null,
    channel: "phone",
    from_number: null,
    urgency: null,
    outcome: "completed",
    after_hours: false,
    booked: false,
    ticket_value: null,
    summary: null,
    has_transcript: false,
    has_recording: false,
    ...row,
  });
  return {
    stats: [
      { label: "New leads", today: 9, yesterday: 7 },
      { label: "Qualified", today: 4, yesterday: 3 },
      { label: "Callbacks due", today: 3, yesterday: 2 },
    ],
    needsYou: [
      {
        kind: "task",
        id: "ex_1",
        title: "Attorney callback · MVA-1042",
        detail: "Rear-ended on the interstate, treated same day. Qualified; the caller expects a call before 5.",
        when: at(today, 15),
        phone: null,
        canDone: false,
        callId: null,
      },
      {
        kind: "task",
        id: "ex_2",
        title: "Conflict review · SF-1043",
        detail: "The adverse party may match an existing client. Review before the retainer goes out.",
        when: at(today, 12),
        phone: null,
        canDone: false,
        callId: null,
      },
    ],
    todaysCalls: [
      call(1, {
        started_at: at(today, 21, 12),
        after_hours: true,
        urgency: "qualified",
        booked: true,
        ticket_value: 8000,
        summary: "Rear-end collision Saturday night, saw a doctor, police report filed. Retainer sent to sign on the phone.",
      }),
      call(2, {
        started_at: at(today, 10, 4),
        urgency: "review",
        summary: "Slip and fall at a grocery store; unclear treatment. Attorney callback scheduled for this afternoon.",
      }),
      call(3, {
        started_at: at(today, 9, 30),
        urgency: "referral",
        summary: "Workers compensation matter; referred to the partner firm with the caller's consent.",
      }),
    ],
    upcoming: [
      {
        id: "ex_v1",
        title: "Attorney callback · MVA-1042",
        starts_at: at(today, 17),
        ends_at: at(today, 17),
        client_name: "Jordan P.",
        worker_name: "R. Castellano",
        urgency: "urgent",
        by_agent: true,
      },
      {
        id: "ex_v2",
        title: "Attorney callback · DB-1041",
        starts_at: at(today, 33),
        ends_at: at(today, 33),
        client_name: "Alicia M.",
        worker_name: "R. Castellano",
        urgency: "routine",
        by_agent: true,
      },
    ],
  };
}
