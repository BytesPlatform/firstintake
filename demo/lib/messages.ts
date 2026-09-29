/**
 * Outbound texts, emails and e-sign links.
 *
 * Twilio and the e-sign provider are not connected yet, so every message is
 * written to the database with status queued and rendered in the demo. The
 * conversation, the pipeline and the panel all behave exactly as they will
 * once the providers are live, which means adding them changes one function
 * each and nothing else.
 *
 * To send texts for real set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
 * TWILIO_FROM_NUMBER.
 */

import { createHmac } from "node:crypto";
import { q } from "./db";
import { tenantId } from "./tenancy";

export type MessageTarget = "lead" | "attorney" | "intake";
export type Channel = "sms" | "email" | "esign";

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export function smsMode(): "preview" | "twilio" {
  return smsConfigured() ? "twilio" : "preview";
}

/** The carrier keywords, per CTIA. Anything else is a normal reply. */
export function stopKeyword(body: string): "stop" | "start" | "help" | null {
  const word = body.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) return "stop";
  if (["START", "YES", "UNSTOP"].includes(word)) return "start";
  if (word === "HELP") return "help";
  return null;
}

/**
 * One number, one hash: "(813) 555-0111" and "+18135550111" are the same
 * phone, so the US country code is dropped before hashing. Otherwise a
 * STOP recorded from Twilio's E.164 would not match the number we dial.
 */
export function smsHash(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  const salt = process.env.PATIENT_HASH_SALT || "demo-salt-change-me";
  return createHmac("sha256", salt).update(digits).digest("hex").slice(0, 16);
}

export async function isSuppressed(phone: string): Promise<boolean> {
  const rows = await q<{ ok: number }>(
    `select 1 as ok from suppression_list where tenant_id = $1 and phone_hash = $2`,
    [tenantId(), smsHash(phone)],
  );
  return rows.length > 0;
}

/**
 * Records the consent event and keeps the suppression list in step: an
 * opt-out lands on the list, an opt-in takes the number off it.
 */
export async function recordSmsConsent(args: {
  phone: string;
  kind: "sms_opt_in" | "sms_opt_out";
  source: string;
  callId?: string;
}): Promise<void> {
  const last4 = args.phone.replace(/\D/g, "").slice(-4) || null;
  await q(
    `insert into consent_events (tenant_id, call_id, kind, granted, script_version, phone_last4)
     values ($1,$2,$3,$4,'v1.0',$5)`,
    [tenantId(), args.callId ?? null, args.kind, args.kind === "sms_opt_in", last4],
  );
  if (args.kind === "sms_opt_out") {
    await q(
      `insert into suppression_list (tenant_id, phone_hash, source) values ($1,$2,$3)
       on conflict (tenant_id, phone_hash) do nothing`,
      [tenantId(), smsHash(args.phone), args.source],
    );
  } else {
    await q(`delete from suppression_list where tenant_id = $1 and phone_hash = $2`, [tenantId(), smsHash(args.phone)]);
  }
}

export function esignMode(): "preview" | "live" {
  return process.env.ESIGN_API_KEY ? "live" : "preview";
}

async function sendViaTwilio(to: string, body: string): Promise<{ sid: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_FROM_NUMBER as string;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Twilio returned ${res.status}`);
  return { sid: json.sid ?? "" };
}

/**
 * Queues a message, and sends it when the provider is configured. Never
 * throws into the call: a text that fails must not take down the matter that
 * earned it.
 */
export async function sendMessage(args: {
  callId?: string | null;
  matterId?: string | null;
  to: string;
  label: MessageTarget;
  channel: Channel;
  subject?: string;
  body: string;
}): Promise<{ id: number; status: "queued" | "sent" | "failed" | "suppressed" }> {
  const provider = args.channel === "sms" ? smsMode() : args.channel === "esign" ? esignMode() : "preview";

  // A number that replied STOP never gets another text, on any provider.
  if (args.channel === "sms" && args.label === "lead" && (await isSuppressed(args.to))) {
    const rows = await q<{ id: number }>(
      `insert into outbound_messages (call_id, matter_id, to_address, to_label, channel, subject, body, provider, status, error, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'suppressed','the number opted out',$9) returning id`,
      [args.callId ?? null, args.matterId ?? null, args.to, args.label, args.channel, args.subject ?? null, args.body, provider, tenantId()],
    );
    return { id: rows[0]?.id ?? 0, status: "suppressed" };
  }

  const rows = await q<{ id: number }>(
    `insert into outbound_messages (call_id, matter_id, to_address, to_label, channel, subject, body, provider, status, tenant_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'queued',$9) returning id`,
    [args.callId ?? null, args.matterId ?? null, args.to, args.label, args.channel, args.subject ?? null, args.body, provider, tenantId()],
  );
  const id = rows[0]?.id ?? 0;

  if (args.channel === "sms" && provider === "twilio") {
    try {
      const { sid } = await sendViaTwilio(args.to, args.body);
      await q(`update outbound_messages set status = 'sent', provider_id = $2 where id = $1`, [id, sid]);
      return { id, status: "sent" };
    } catch (err) {
      await q(`update outbound_messages set status = 'failed', error = $2 where id = $1`, [
        id,
        err instanceof Error ? err.message : "unknown error",
      ]);
      return { id, status: "failed" };
    }
  }

  return { id, status: "queued" };
}

/** A stable looking e-sign link for the demo. The real one comes from the provider. */
export function retainerLink(matterReference: string): string {
  const host = process.env.DEMO_HOST || process.env.VERCEL_URL || "harborpoint.example";
  return `https://${host.replace(/^https?:\/\//, "")}/sign/${matterReference.toLowerCase()}`;
}
