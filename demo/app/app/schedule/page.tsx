/**
 * Schedule: the open callbacks and reviews, overdue first, then day by
 * day, with who they are for. This firm's calendar is a callback list,
 * not a chair board.
 */
import Shell from "@/app/components/dash/Shell";
import { callbackBoard } from "@/lib/dash";
import { fmtTime } from "../fmt";
import { accountOf, requireDashboard } from "../shared";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const ctx = await requireDashboard();
  const { days, timezone } = await callbackBoard(ctx.tenant);
  return (
    <Shell active="schedule" account={accountOf(ctx)}>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">Callbacks and reviews</h2>
            <p className="panel-sub">Everything the assistant put on someone's plate, by when it is due</p>
          </div>
        </header>
        <div className="panel-body">
          {days.length === 0 ? (
            <p className="empty">Nothing open. New callbacks land here the moment the assistant schedules them.</p>
          ) : (
            days.map((day) => (
              <div className="sched-day" key={day.label}>
                <h3 className={`sched-day-title${day.label === "Overdue" ? " is-overdue" : ""}`}>{day.label}</h3>
                {day.tasks.map((t) => (
                  <article className={`visit-card urg-line-${t.priority === "urgent" ? "emergency" : t.priority === "high" ? "urgent" : "routine"}`} key={t.id}>
                    <span className="visit-card-when num">{t.due_at ? fmtTime(t.due_at, timezone) : "any time"}</span>
                    <span className="visit-card-title">
                      {t.kind}
                      {t.reference ? ` · ${t.reference}` : ""}
                    </span>
                    <span className="visit-card-meta">
                      {[t.contact, t.assigned ? `for ${t.assigned}` : null, t.note].filter(Boolean).join(" · ")}
                      {t.callId ? (
                        <>
                          {" · "}
                          <a className="admin-link" href={`/app/calls?call=${encodeURIComponent(t.callId)}`}>
                            the call
                          </a>
                        </>
                      ) : null}
                    </span>
                  </article>
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </Shell>
  );
}
