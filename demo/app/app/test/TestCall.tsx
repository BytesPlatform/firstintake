"use client";

/**
 * Step 7: call your own assistant from the browser. The checklist ticks
 * itself from the pipeline steps the call produces, and the ticks are saved
 * so the go-live page can show them.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import CallPanel from "@/app/components/CallPanel";
import { useDemoState } from "@/app/hooks/useDemoState";
import { useRetellCall } from "@/app/hooks/useRetellCall";
import { saveChecklistAction } from "./actions";

const CHECKS: { key: string; label: string; steps: string[] }[] = [
  { key: "answered", label: "It answered with your greeting and the disclosures", steps: ["lead_received", "disclosures_made"] },
  { key: "classified", label: "It understood what happened and named the case type", steps: ["intake_classified"] },
  { key: "qualified", label: "It asked your questions and scored the lead", steps: ["lead_qualified"] },
  { key: "conflict", label: "It ran the conflict check against open matters", steps: ["conflict_checked"] },
  { key: "matter", label: "It created the contact and opened the matter", steps: ["contact_created", "matter_created"] },
  { key: "attorney", label: "It put the callback on an attorney's list", steps: ["attorney_tasked"] },
  { key: "retainer", label: "It sent the retainer after consent", steps: ["retainer_sent"] },
  { key: "confirmed", label: "It read the caller their file reference", steps: ["lead_confirmed"] },
];

export default function TestCall({ companyName, saved }: { companyName: string; saved: Record<string, boolean> }) {
  const call = useRetellCall("app");
  const { state } = useDemoState("app");
  const [ticks, setTicks] = useState<Record<string, boolean>>(saved);
  const lastSaved = useRef("");

  const done = useMemo(() => {
    const out: Record<string, boolean> = { ...ticks };
    if (call.callId) {
      const steps = new Set(state.pipeline.filter((r) => r.call_id === call.callId && (r.status === "ok" || r.status === "warn")).map((r) => r.step));
      for (const c of CHECKS) if (c.steps.some((s) => steps.has(s))) out[c.key] = true;
    }
    return out;
  }, [ticks, call.callId, state.pipeline]);

  useEffect(() => {
    if (!call.callId) return;
    const key = JSON.stringify(done);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    setTicks(done);
    void saveChecklistAction(call.callId, done);
  }, [done, call.callId]);

  const count = CHECKS.filter((c) => done[c.key]).length;

  return (
    <div className="setup-test">
      <div className="setup-test-call">
        <CallPanel
          phase={call.phase}
          isLive={call.isLive}
          configured={call.config?.retell.configured ?? false}
          scope="app"
          callId={call.callId}
          startedAt={call.startedAt}
          agentTalking={call.agentTalking}
          ringing={call.ringing}
          muted={call.muted}
          turns={call.turns}
          qualification={null}
          phoneNumber={call.config?.retell.phoneNumber ?? ""}
          firmName={companyName}
          error={call.error}
          endedReason={call.endedReason}
          mode="call"
          onModeChange={() => {}}
          form={null}
          onStart={() => void call.start()}
          onEnd={() => void call.end()}
          onToggleMute={call.toggleMute}
        />
      </div>
      <div className="admin-section">
        <h2 className="admin-title-sm">
          Checklist, {count} of {CHECKS.length}
        </h2>
        <p className="admin-help">
          Press Call and speak the way an injured caller would: "I was rear-ended on the interstate last Tuesday and my
          neck has been bad since", then answer its questions. Each line ticks as the assistant does it.
        </p>
        <ul className="setup-checklist">
          {CHECKS.map((c) => (
            <li key={c.key} className={done[c.key] ? "is-done" : ""}>
              <span className="setup-tick" aria-hidden="true">
                {done[c.key] ? "✓" : ""}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        <p className="admin-sub">Nothing from a test call is real: the matter lands on your pipeline marked as made by the assistant, and you can see exactly what a real lead would produce.</p>
      </div>
    </div>
  );
}
