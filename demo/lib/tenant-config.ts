/**
 * What onboarding collects for a personal injury firm, and how the rest of
 * the product reads it.
 *
 * Everything a firm tells us lives in tenants.config as one JSON document,
 * typed here. cfg() returns the effective configuration for the tenant in
 * scope: the firm's answers merged over the product defaults in config.ts,
 * which is also exactly what the demo tenant runs on. The tools, the board,
 * the state route and the agent renderer all read from cfg(), so a change
 * made in onboarding or Settings is what the assistant does on the next
 * call.
 *
 * The state matters more here than in the sister products: it drives the
 * recording-consent wording and the default filing deadline the firm then
 * confirms. Deadlines are the firm's numbers, entered by the firm; the
 * product never supplies legal advice.
 */

import { BUSINESS_HOURS, CASE_TYPES, FIRM, QUALIFYING_QUESTIONS, STAFF, type CaseType, type Staff } from "./config";
import { tenant, tenantInScope, type Tenant } from "./tenancy";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_NAMES: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/** "08:30" to "17:30", or null when the office is closed that day. The intake line itself answers around the clock. */
export type DayHours = { open: string; close: string } | null;

export const ONBOARDING_STEPS = [
  { id: "account", title: "Account", blurb: "Your firm name, time zone and who else needs access." },
  { id: "business", title: "Firm basics", blurb: "The office, the state you practise in, hours, and the number the assistant gives out." },
  { id: "services", title: "What you take", blurb: "Case types taken and referred, your deadline table, the qualifying questions and your intake team." },
  { id: "behaviour", title: "How it should behave", blurb: "The greeting with the recording disclosure, the tone, and the intake desk transfer." },
  { id: "software", title: "Case management and e-sign", blurb: "The built-in pipeline, or the software you already run." },
  { id: "phone", title: "Phone number", blurb: "A new number in your area code, or forward the one you have." },
  { id: "test", title: "Test call", blurb: "Call your assistant from the browser and tick the checklist." },
  { id: "live", title: "Go live", blurb: "The summary, what to tell staff, and the forwarding step." },
] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

/** States that require every party's consent before a call is recorded. */
export const ALL_PARTY_STATES = new Set(["CA", "CT", "DE", "FL", "IL", "MD", "MA", "MI", "MT", "NV", "NH", "OR", "PA", "WA"]);

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

export interface TenantConfig {
  onboarding: { step: number; startedAt: string | null; completedAt: string | null; checklist: Record<string, boolean>; testCallId: string | null };
  basics: {
    address: string;
    website: string;
    timezone: string;
    /** The number the assistant reads out for callbacks. */
    callbackNumber: string;
    /** Two-letter state the firm practises in. Drives the consent wording and the facts. */
    state: string;
    city: string;
    hours: Record<DayKey, DayHours>;
  };
  staff: Staff[];
  caseTypes: CaseType[];
  /** Qualifying questions per case type id, read out one at a time. */
  questions: Record<string, string[]>;
  /** Where cases the firm does not take are sent. Spoken as "a firm we trust with these" when blank. */
  referralPartner: string;
  behaviour: {
    greeting: string;
    tone: "calm" | "friendly";
    /** E.164, the intake desk for "speak to a person". */
    transferNumber: string;
    takeMessageWhenUnanswered: boolean;
  };
  software: {
    caseManagement: "none" | "lawmatics" | "clio" | "filevine" | "other";
    esign: "none" | "docusign" | "dropboxsign" | "lawmatics";
    note: string;
  };
  phone: { mode: "buy" | "forward" | null; areaCode: string; number: string; existingNumber: string; carrier: string };
  agent: { flowId: string | null; agentId: string | null; version: number | null; publishedAt: string | null; renderedHash: string | null; voiceId: string | null };
}

function pad(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function defaultConfig(): TenantConfig {
  const weekday: DayHours = { open: pad(BUSINESS_HOURS.weekdayOpenHour), close: pad(BUSINESS_HOURS.weekdayCloseHour) };
  return {
    onboarding: { step: 0, startedAt: null, completedAt: null, checklist: {}, testCallId: null },
    basics: {
      address: "400 North Ashley Drive, Suite 1200",
      website: "",
      timezone: FIRM.timezone,
      callbackNumber: FIRM.mainNumber,
      state: FIRM.state,
      city: FIRM.city,
      hours: {
        mon: weekday,
        tue: weekday,
        wed: weekday,
        thu: weekday,
        fri: weekday,
        sat: { open: pad(BUSINESS_HOURS.saturdayOpenHour), close: pad(BUSINESS_HOURS.saturdayCloseHour) },
        sun: BUSINESS_HOURS.sundayClosed ? null : weekday,
      },
    },
    staff: STAFF.map((s) => ({ ...s, onCallDays: [...s.onCallDays] })),
    caseTypes: CASE_TYPES.map((c) => ({ ...c, keywords: [...c.keywords] })),
    questions: Object.fromEntries(Object.entries(QUALIFYING_QUESTIONS).map(([k, v]) => [k, [...v]])),
    referralPartner: "",
    behaviour: {
      greeting:
        "Thanks for calling {{firm_name}}. This call is recorded, and you're speaking with our automated intake assistant. If you've been hurt, I can take the first details and have an attorney call you. You can say staff at any time to reach a person. What happened?",
      tone: "calm",
      transferNumber: "",
      takeMessageWhenUnanswered: true,
    },
    software: { caseManagement: "none", esign: "none", note: "" },
    phone: { mode: null, areaCode: "", number: "", existingNumber: "", carrier: "" },
    agent: { flowId: null, agentId: null, version: null, publishedAt: null, renderedHash: null, voiceId: null },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Firm answers over defaults. Arrays are replaced whole, objects merged. */
export function mergeConfig(base: TenantConfig, patch: unknown): TenantConfig {
  if (!isObject(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (out as Record<string, unknown>)[k];
    out[k] = isObject(cur) && isObject(v) ? mergeConfig(cur as unknown as TenantConfig, v) : v;
  }
  return out as unknown as TenantConfig;
}

export function configOf(t: Tenant): TenantConfig {
  const c = mergeConfig(defaultConfig(), t.config);
  if (t.retell_agent_id && !c.agent.agentId) c.agent.agentId = t.retell_agent_id;
  if (t.phone_number && !c.phone.number) c.phone.number = t.phone_number;
  return c;
}

export function cfg(): TenantConfig {
  return tenantInScope() ? configOf(tenant()) : defaultConfig();
}

/* -------------------------------------------------------------- lookups */

export function caseTypeByIdFor(c: TenantConfig, id: string): CaseType | undefined {
  return c.caseTypes.find((x) => x.id === id);
}

export function staffByIdFor(c: TenantConfig, id: string): Staff | undefined {
  return c.staff.find((s) => s.id === id);
}

export function questionsFor(c: TenantConfig, caseTypeId: string): string[] {
  return c.questions[caseTypeId] ?? c.questions.other ?? QUALIFYING_QUESTIONS.other;
}

/** Classifies a caller's own words into one of the firm's case types. Routing, never a legal opinion. */
export function classifyFor(c: TenantConfig, text: string): CaseType {
  const haystack = String(text ?? "").toLowerCase();
  // Referral categories first, so "hurt at work in a car" routes to the specialist.
  for (const type of c.caseTypes.filter((x) => !x.accepted)) {
    if (type.keywords.some((k) => haystack.includes(k))) return type;
  }
  for (const type of c.caseTypes.filter((x) => x.accepted && x.id !== "other")) {
    if (type.keywords.some((k) => haystack.includes(k))) return type;
  }
  return caseTypeByIdFor(c, "other") ?? c.caseTypes.find((x) => x.accepted) ?? c.caseTypes[0];
}

/** Local weekday and hour in the firm's time zone. */
export function localParts(when: Date, timezone: string): { day: number; hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(when);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day: day < 0 ? when.getDay() : day, hour: Number(get("hour")) % 24, minute: Number(get("minute")) };
  } catch {
    return { day: when.getDay(), hour: when.getHours(), minute: when.getMinutes() };
  }
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isAfterHoursFor(c: TenantConfig, when: Date = new Date()): boolean {
  if (process.env.DEMO_FORCE_AFTER_HOURS === "true") return true;
  if (process.env.DEMO_FORCE_AFTER_HOURS === "false") return false;
  const { day, hour, minute } = localParts(when, c.basics.timezone);
  const hours = c.basics.hours[DAY_KEYS[day]];
  if (!hours) return true;
  const now = hour * 60 + minute;
  return now < minutes(hours.open) || now >= minutes(hours.close);
}

/** Whoever is carrying the after hours intake phone on a given date. */
export function onCallIntakeFor(c: TenantConfig, when: Date = new Date()): Staff {
  const { day } = localParts(when, c.basics.timezone);
  return c.staff.find((s) => s.role === "intake" && s.onCallDays.includes(day)) ?? c.staff.find((s) => s.role === "intake") ?? c.staff[0];
}

/** The attorney a qualified matter is assigned to for review. */
export function reviewingAttorneyFor(c: TenantConfig): Staff {
  return c.staff.find((s) => s.role === "attorney") ?? c.staff[c.staff.length - 1];
}

export function stateNameFor(c: TenantConfig): string {
  return STATE_NAMES[c.basics.state] ?? c.basics.state;
}

export function recordingConsentFor(c: TenantConfig): "all-party" | "one-party" {
  return ALL_PARTY_STATES.has(c.basics.state) ? "all-party" : "one-party";
}

/* ------------------------------------------------------ spoken summaries */

function speakTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const min = m ? `:${String(m).padStart(2, "0")}` : "";
  return `${hour12}${min}${h >= 12 ? " in the afternoon" : " in the morning"}`.replace("12 in the afternoon", "noon");
}

export function hoursSummary(c: TenantConfig): string {
  const order: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const groups: { days: DayKey[]; hours: DayHours }[] = [];
  for (const d of order) {
    const h = c.basics.hours[d];
    const last = groups[groups.length - 1];
    if (last && JSON.stringify(last.hours) === JSON.stringify(h)) last.days.push(d);
    else groups.push({ days: [d], hours: h });
  }
  return groups
    .map((g) => {
      const label = g.days.length > 1 ? `${DAY_NAMES[g.days[0]]} to ${DAY_NAMES[g.days[g.days.length - 1]]}` : DAY_NAMES[g.days[0]];
      return g.hours ? `${label} ${speakTime(g.hours.open)} until ${speakTime(g.hours.close)}` : `closed ${label}`;
    })
    .join(", ");
}

export function takenSummary(c: TenantConfig): string {
  return c.caseTypes.filter((x) => x.accepted && x.id !== "other").map((x) => x.name.toLowerCase()).join(", ");
}

export function referredSummary(c: TenantConfig): string {
  return c.caseTypes.filter((x) => !x.accepted).map((x) => x.name.toLowerCase()).join(" and ");
}

/** "Motor vehicle accident: two years from the incident." One line per accepted type, from the firm's own table. */
export function deadlineSummary(c: TenantConfig): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six"];
  return c.caseTypes
    .filter((x) => x.accepted && x.id !== "other")
    .map((x) => `- ${x.name}: ${words[x.deadlineYears] ?? x.deadlineYears} year${x.deadlineYears === 1 ? "" : "s"} from the incident.`)
    .join("\n");
}

/** What is still missing before the assistant can go live, in the firm's words. */
export function readiness(c: TenantConfig): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.basics.callbackNumber.trim()) missing.push("the number the assistant gives out");
  if (!STATE_NAMES[c.basics.state]) missing.push("the state the firm practises in");
  if (!c.caseTypes.some((x) => x.accepted)) missing.push("at least one case type the firm takes");
  if (!c.staff.some((s) => s.role === "intake")) missing.push("at least one intake specialist");
  if (!c.staff.some((s) => s.role === "attorney")) missing.push("at least one attorney");
  if (!c.behaviour.greeting.trim()) missing.push("the greeting");
  if (!/record/i.test(c.behaviour.greeting)) missing.push("a recording disclosure in the greeting");
  if (!/assistant|automated/i.test(c.behaviour.greeting)) missing.push("the greeting must say the caller is speaking with an assistant");
  return { ok: missing.length === 0, missing };
}

export function onboardingComplete(c: TenantConfig): boolean {
  return Boolean(c.onboarding.completedAt);
}
