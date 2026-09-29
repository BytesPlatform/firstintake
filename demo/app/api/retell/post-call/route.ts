/**
 * Retell's call lifecycle webhook. Closes the call, records the outcome, and
 * for a web form lead stops the stopwatch the moment the outbound call is
 * answered.
 */

import { NextRequest, NextResponse } from "next/server";
import { notifyOwners } from "@/lib/notify";
import { closeCall, logCallEvent, logPipeline, markLeadContacted, saveCallMedia, touchCall } from "@/lib/ops";
import { tenantByAgentId, withTenant } from "@/lib/tenancy";
import { signatureRequired, verifyRetellSignature } from "@/lib/retell";
import { cfg, isAfterHoursFor } from "@/lib/tenant-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: {
    event: string;
    call: {
      call_id: string;
      agent_id?: string;
      from_number?: string;
      to_number?: string;
      direction?: string;
      disconnection_reason?: string;
      transcript?: string;
      recording_url?: string;
      metadata?: Record<string, unknown>;
      call_analysis?: {
        call_summary?: string;
        user_sentiment?: string;
        custom_analysis_data?: Record<string, unknown>;
      };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "body is not valid JSON" }, { status: 400 });
  }

  const check = verifyRetellSignature(rawBody, request.headers.get("x-retell-signature"), process.env.RETELL_API_KEY);
  if (!check.ok && signatureRequired()) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const call = payload.call;
  if (!call?.call_id) return NextResponse.json({ error: "missing call_id" }, { status: 400 });

  const tenant = await tenantByAgentId(call.agent_id);
  if (!tenant) return NextResponse.json({ error: "unknown agent" }, { status: 404 });

  return withTenant(tenant, async () => {
  const leadRaw = call.metadata?.lead_id;
  const leadId = Number(leadRaw) > 0 ? Number(leadRaw) : null;
  const outbound = leadId !== null || call.direction === "outbound";

  await touchCall(call.call_id, {
    channel: outbound ? "outbound" : call.from_number ? "phone" : "web",
    fromNumber: outbound ? call.to_number : call.from_number,
    afterHours: isAfterHoursFor(cfg()),
    leadId,
  });

  if (payload.event === "call_started") {
    await logCallEvent({ callId: call.call_id, action: "call_started", outcome: "ok", detail: { outbound } });
    if (leadId) {
      // The lead picked up. This is the number the whole build is judged by.
      await markLeadContacted(leadId, { callId: call.call_id, status: "reached" });
      await logPipeline(call.call_id, "lead_received", "ok", "web form lead answered the callback");
    }
    return NextResponse.json({ received: true });
  }

  if (payload.event === "call_ended") {
    await logCallEvent({ callId: call.call_id, action: "call_ended", outcome: call.disconnection_reason ?? "ok" });
    await closeCall(call.call_id, call.disconnection_reason ?? "ended");
    await saveCallMedia(call.call_id, { transcript: call.transcript, recordingUrl: call.recording_url });
    // A call the line could not complete is worth telling the owner about.
    if (/error|failed/i.test(call.disconnection_reason ?? "") && tenant.id !== "demo") {
      await notifyOwners(tenant, {
        template: "owner_failed_call",
        subject: "A call could not be completed",
        title: "A call did not go through",
        lines: [
          `A ${call.from_number ? `call with ${call.from_number}` : "call"} ended with "${(call.disconnection_reason ?? "").replace(/_/g, " ")}".`,
          "If this repeats, reply to this email and we will look at the line together.",
        ],
        ctaLabel: "See the call",
        ctaPath: `/app/calls?call=${encodeURIComponent(call.call_id)}`,
      });
    }
    if (leadId && /voicemail|no_answer|dial_busy|dial_failed|dial_no_answer/.test(call.disconnection_reason ?? "")) {
      await markLeadContacted(leadId, { callId: call.call_id, status: "no_answer" });
    }
    return NextResponse.json({ received: true });
  }

  if (payload.event === "call_analyzed") {
    const analysis = call.call_analysis ?? {};
    const custom = analysis.custom_analysis_data ?? {};
    const outcome = String(custom.outcome ?? "completed");

    await closeCall(call.call_id, outcome, analysis.call_summary);
    await saveCallMedia(call.call_id, { transcript: call.transcript, recordingUrl: call.recording_url });
    await logCallEvent({
      callId: call.call_id,
      action: "call_analyzed",
      outcome,
      detail: { sentiment: analysis.user_sentiment ?? null, qualification: custom.qualification ?? null },
    });
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, ignored: payload.event });
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "retell call lifecycle webhook" });
}
