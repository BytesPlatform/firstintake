"use server";

/**
 * What each onboarding step saves for a personal injury firm. Every action
 * re-checks the session and writes only to the signed-in tenant. The same
 * actions back Settings.
 */

import { redirect } from "next/navigation";
import { requireTenant, requestOrigin, sendInvitation } from "@/lib/auth";
import { e164 } from "@/lib/leads";
import { goLive, saveConfig, stepIndex } from "@/lib/onboarding";
import { buyNumber, provisionAgent, releaseNumber } from "@/lib/provision";
import { addMembership, recordInvitation, updateTenant } from "@/lib/tenancy";
import { DAY_KEYS, ONBOARDING_STEPS, STATE_NAMES, configOf, type DayHours, type DayKey, type StepId } from "@/lib/tenant-config";
import { CASE_TYPES, type CaseType, type Staff } from "@/lib/config";

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function next(form: FormData, step: StepId): never {
  const mode = text(form, "mode");
  if (mode === "settings") redirect(`/app/settings?ok=${encodeURIComponent("Saved.")}#${step}`);
  const i = stepIndex(step);
  const target = ONBOARDING_STEPS[i + 1]?.id;
  redirect(target ? `/app/setup/${target}` : "/app");
}

function back(step: StepId, message: string, form?: FormData): never {
  const mode = form ? text(form, "mode") : "";
  redirect(mode === "settings" ? `/app/settings?error=${encodeURIComponent(message)}#${step}` : `/app/setup/${step}?error=${encodeURIComponent(message)}`);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "item";
}

/* 1 */
export async function saveAccountAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const name = text(form, "name");
  if (!name) back("account", "The firm name is required.", form);
  const c = configOf(ctx.tenant);
  await updateTenant(ctx.tenant.id, { name, short_name: text(form, "short_name") || name.split(/\s+/)[0], timezone: text(form, "timezone") || c.basics.timezone });
  await saveConfig(ctx.tenant.id, { basics: { ...c.basics, timezone: text(form, "timezone") || c.basics.timezone, website: text(form, "website") } }, 1);
  const invite = text(form, "invite_email").toLowerCase();
  if (invite) {
    const member = await addMembership({ tenantId: ctx.tenant.id, email: invite, name: text(form, "invite_name") || undefined, role: "staff" });
    const origin = await requestOrigin();
    await recordInvitation(member.id, await sendInvitation({ email: invite, tenantId: ctx.tenant.id, role: "staff", origin }));
  }
  next(form, "account");
}

/* 2: office, state, hours */
export async function saveBusinessAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const callback = text(form, "callback_number");
  if (!callback) back("business", "The number the assistant gives out is required.", form);
  const state = text(form, "state").toUpperCase();
  if (!STATE_NAMES[state]) back("business", "Pick the state the firm practises in.", form);
  const hours = {} as Record<DayKey, DayHours>;
  for (const d of DAY_KEYS) {
    const closed = form.get(`closed_${d}`) === "on";
    const open = text(form, `open_${d}`);
    const close = text(form, `close_${d}`);
    hours[d] = closed || !open || !close ? null : { open, close };
  }
  await updateTenant(ctx.tenant.id, { main_number: callback });
  await saveConfig(ctx.tenant.id, { basics: { ...c.basics, address: text(form, "address"), city: text(form, "city"), state, callbackNumber: callback, hours } }, 2);
  next(form, "business");
}

/* 3: case types, deadlines, questions, staff, referral partner */
const TONES = ["gold", "teal", "violet", "slate"] as const;
const DAY_WORDS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export async function saveServicesAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);

  const caseTypes: CaseType[] = [];
  for (const line of text(form, "case_types").split(/\r?\n/)) {
    const [name, decision, years, fee] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const id = slug(name);
    // Keep the built-in keyword lists when the type is one of the defaults, matched by id or name.
    const known = CASE_TYPES.find((x) => x.id === id || x.name.toLowerCase() === name.toLowerCase());
    const accepted = !/refer/i.test(decision || "take");
    caseTypes.push({
      id: known?.id ?? id,
      name,
      spoken: known?.spoken ?? name.toLowerCase(),
      keywords: known ? [...known.keywords] : name.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
      deadlineYears: Math.min(6, Math.max(1, Number(years) || known?.deadlineYears || 2)),
      accepted,
      typicalFee: accepted ? Number((fee || "").replace(/[^0-9]/g, "")) || known?.typicalFee || 8000 : 0,
    });
  }
  if (!caseTypes.some((x) => x.id === "other")) {
    const other = CASE_TYPES.find((x) => x.id === "other")!;
    caseTypes.push({ ...other, keywords: [] });
  }

  const questions: Record<string, string[]> = {};
  for (const raw of text(form, "questions").split(/\r?\n/)) {
    const m = raw.trim().match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    const id = slug(m[1]);
    const key = caseTypes.find((x) => x.id === id || x.name.toLowerCase() === m[1].trim().toLowerCase())?.id ?? id;
    (questions[key] ??= []).push(m[2].trim());
  }
  if (!questions.other) questions.other = [...(c.questions.other ?? [])];

  const staff: Staff[] = [];
  let i = 0;
  for (const line of text(form, "staff").split(/\r?\n/)) {
    const [name, role, title, days] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const r = /attor/i.test(role || "") ? "attorney" : "intake";
    const onCallDays = (days || "")
      .split(/[,\s]+/)
      .map((d) => DAY_WORDS[d.toLowerCase().slice(0, 3)])
      .filter((d) => d !== undefined);
    staff.push({ id: `st_${slug(name)}`, name, firstName: name.split(/\s+/)[0], role: r, title: title || (r === "attorney" ? "Attorney" : "Intake specialist"), onCallDays, tone: TONES[i++ % TONES.length] });
  }

  if (!caseTypes.some((x) => x.accepted)) back("services", "The firm has to take at least one case type.", form);
  if (!staff.some((s) => s.role === "intake")) back("services", "Add at least one intake specialist.", form);
  if (!staff.some((s) => s.role === "attorney")) back("services", "Add at least one attorney.", form);
  const missingQ = caseTypes.find((x) => x.accepted && x.id !== "other" && !(questions[x.id]?.length));
  if (missingQ) back("services", `No qualifying questions for "${missingQ.name}". Add lines starting "${missingQ.name}: ...".`, form);

  await saveConfig(ctx.tenant.id, { caseTypes, questions, staff, referralPartner: text(form, "referral_partner") }, 3);
  next(form, "services");
}

/* 4 */
export async function saveBehaviourAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const greeting = text(form, "greeting");
  if (!greeting) back("behaviour", "The greeting is required.", form);
  if (!/record/i.test(greeting)) back("behaviour", "The greeting must tell the caller the call is recorded.", form);
  if (!/assistant|automated/i.test(greeting)) back("behaviour", "The greeting must say the caller is speaking with an assistant.", form);
  const transfer = text(form, "transfer_number");
  const transferE164 = transfer ? e164(transfer) : "";
  if (transfer && !transferE164) back("behaviour", "The intake desk number does not look like a phone number.", form);
  await saveConfig(ctx.tenant.id, { behaviour: { ...c.behaviour, greeting, tone: text(form, "tone") === "friendly" ? "friendly" : "calm", transferNumber: transferE164 || "", takeMessageWhenUnanswered: form.get("take_message") === "on" } }, 4);
  next(form, "behaviour");
}

/* 5 */
export async function saveSoftwareAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const cm = (["none", "lawmatics", "clio", "filevine", "other"].includes(text(form, "case_management")) ? text(form, "case_management") : "none") as "none" | "lawmatics" | "clio" | "filevine" | "other";
  const es = (["none", "docusign", "dropboxsign", "lawmatics"].includes(text(form, "esign")) ? text(form, "esign") : "none") as "none" | "docusign" | "dropboxsign" | "lawmatics";
  await saveConfig(ctx.tenant.id, { software: { ...c.software, caseManagement: cm, esign: es, note: text(form, "note").slice(0, 1000) } }, 5);
  next(form, "software");
}

/* 6 */
export async function publishAgentAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const step = (text(form, "step") || "phone") as StepId;
  try {
    const r = await provisionAgent(ctx.tenant.id);
    const mode = text(form, "mode");
    // A published assistant is what the test call needs, so publishing unlocks it.
    if (mode !== "settings") await saveConfig(ctx.tenant.id, {}, 6);
    redirect(mode === "settings" ? `/app/settings?ok=${encodeURIComponent(`Assistant published, version ${r.version ?? "1"}.`)}` : `/app/setup/${step}?ok=${encodeURIComponent("Assistant published.")}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    back(step, err instanceof Error ? err.message : "Could not publish the assistant.", form);
  }
}

export async function buyNumberAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  try {
    const r = await buyNumber(ctx.tenant.id, text(form, "area_code"));
    await saveConfig(ctx.tenant.id, {}, 6);
    redirect(`/app/setup/phone?ok=${encodeURIComponent(`Your number is ${r.number}.`)}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    back("phone", err instanceof Error ? err.message : "Could not buy a number.", form);
  }
}

export async function forwardNumberAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const existing = e164(text(form, "existing_number"));
  if (!existing) back("phone", "Your current number does not look like a phone number.", form);
  await saveConfig(ctx.tenant.id, { phone: { ...c.phone, mode: "forward", existingNumber: existing, carrier: text(form, "carrier") } }, 6);
  redirect("/app/setup/phone?ok=" + encodeURIComponent("Forwarding chosen. Buy the number the calls will forward to, then follow the carrier steps below."));
}

export async function releaseNumberAction(): Promise<void> {
  const ctx = await requireTenant();
  await releaseNumber(ctx.tenant.id);
  redirect("/app/settings?ok=" + encodeURIComponent("Number released."));
}

/* 7 */
export async function saveChecklistAction(callId: string, checklist: Record<string, boolean>): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  await saveConfig(ctx.tenant.id, { onboarding: { ...c.onboarding, testCallId: callId, checklist: { ...c.onboarding.checklist, ...checklist } } }, 7);
}

export async function continueFromTestAction(): Promise<void> {
  const ctx = await requireTenant();
  await saveConfig(ctx.tenant.id, {}, 7);
  redirect("/app/setup/live");
}

/* 8 */
export async function goLiveAction(): Promise<void> {
  const ctx = await requireTenant();
  try {
    await goLive(ctx.tenant.id);
  } catch (err) {
    back("live", err instanceof Error ? err.message : "Could not go live.");
  }
  redirect("/app?ok=" + encodeURIComponent("You are live."));
}
