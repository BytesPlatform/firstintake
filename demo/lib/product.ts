/**
 * The product, as opposed to the customer. FIRM in config.ts is the firm the
 * demo agent answers for; this is what we sell and every word the landing
 * site and the emails use. The site pages and the email templates are
 * shared across the three products verbatim; this file and lib/recordings.ts
 * are what differ.
 */

export interface Step {
  title: string;
  body: string;
}

export const PRODUCT = {
  name: "FirstIntake",
  company: "Bytes Platform",
  /** One accent per product, used by the site and the emails. */
  accent: { main: "#b8860b", deep: "#8f6708", gradientFrom: "#e9b44c", gradientTo: "#c2410c" },
  headline: "Sign the injured caller before the next firm calls back",
  subhead:
    "An AI intake assistant for personal injury firms. It answers every call and web form in seconds, day or night, asks the qualifying questions, runs the conflict check, sends the retainer to sign on the caller's phone, and puts the attorney callback on the calendar. Your intake team starts every morning with signed clients, not voicemails.",
  industry: "personal injury law firms",
  buyer: "firms",
  worker: "attorney",
  booking: "matter",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://firstintake-zeta.vercel.app",
  salesInbox: process.env.SALES_INBOX || "bytesuite@bytesplatform.com",
  fromEmail: process.env.SENDGRID_FROM_EMAIL || "hello@bytesplatform.com",
  fromName: process.env.SENDGRID_FROM_NAME || "FirstIntake",
  consentText:
    "By submitting, you agree that FirstIntake may call, text and email you about your inquiry, including with automated technology. Consent is not a condition of purchase. Reply STOP to any text to opt out.",

  proof: [
    { n: "< 10 s", label: "from web form to a ringing phone" },
    { n: "24/7", label: "answers every call, weekends included" },
    { n: "1 tap", label: "for the caller to sign the retainer" },
  ],
  heroCall: { when: "Saturday, 9:12 p.m.", kind: "Inbound, after hours", result: "Qualified, retainer sent", length: "44 seconds" },
  recordingPitch: "A rear-end collision on I-275, called in on a Saturday night: qualified, conflict checked, retainer texted and the attorney callback set before the caller hung up.",
  recordingDescription: "Real scenario, the assistant answering as a fictional Tampa firm. Press play, then read the transcript to see the questions it asked before it sent the retainer.",

  steps: [
    { title: "It answers", body: "Every call and every web form, in seconds, with the recording disclosure your state requires. It asks what happened and listens for the case type." },
    { title: "It qualifies", body: "The questions your intake team asks first: when, injuries and treatment, fault, police report, prior counsel. It scores the lead against your rules and runs the conflict check against open matters." },
    { title: "It hands over", body: "A strong case gets the retainer texted to sign and an attorney callback within the hour. A borderline one goes to attorney review with everything written down. A case you do not take gets a polite referral." },
  ] as Step[],
  demoPitch: "The demo call takes twenty minutes and we run it on your own case types, intake questions and staff.",

  ladder: [
    { title: "Lead received", body: "A call, or a web form that the assistant dials back within ten seconds. The stopwatch starts here and the dashboard shows it." },
    { title: "Disclosures made", body: "Recording notice, assistant disclosure and, for texts, SMS consent, each logged with the script version so you can show which words were said on which call." },
    { title: "Intake classified", body: "Car accident, fall, dog bite, product, wrongful death, or one you refer out. Your list, your words." },
    { title: "Lead qualified", body: "Date of incident against the filing deadline, treatment, fault, police report, prior counsel. Scored against your thresholds; anything below goes to attorney review, never to a no." },
    { title: "Conflict checked", body: "The caller and the adverse party against every party on your open matters. A hit stops the intake and opens a task for a person." },
    { title: "Contact created", body: "A known number is greeted by name. A new caller is created once in your case management system with the source recorded." },
    { title: "Matter created", body: "Case type, incident date, summary in the caller's own words, score and stage, assigned to the intake specialist on call." },
    { title: "Attorney tasked", body: "A callback task on the attorney's list with the due time the assistant promised the caller." },
    { title: "Retainer sent", body: "The engagement letter as a link to sign on the caller's phone, by text or email, only after consent." },
    { title: "Lead confirmed", body: "The caller hears their reference number and what happens next. Every step is in the log you can read afterwards." },
  ] as Step[],
  setup: [
    { title: "What we need from you", body: "Onboarding is a guided setup inside the product and takes under an hour. You give it your case types and which you refer out, your qualifying questions and score thresholds, your intake staff and attorneys and who carries the after-hours phone, your retainer document and the words it uses when it answers. Then you make a test call and forward your number." },
    { title: "Forwarding your number and your forms", body: "You keep your number. Forward it always, after hours only, or when nobody picks up. Point your website's contact form at the assistant and it calls the lead back the moment the form lands." },
    { title: "What you see", body: "A dashboard with the new matters and their stage, the speed-to-lead stopwatch, the attorney task list, the consent log and every text and retainer it sent. Technical detail sits behind an Advanced page." },
  ] as Step[],

  rules: [
    "Never gives legal advice or estimates what a case is worth. It says an attorney will discuss that on the callback.",
    "Never says the firm will take a case. It says the case looks like one the firm handles and an attorney will confirm.",
    "Never sends a retainer without consent to text or email, and never before the conflict check is clear.",
    "Never argues with a caller. When someone insists on a person, it transfers or takes a message with a callback promise.",
  ],
  moreRules: [
    "Never records a call without the two-party consent disclosure where the state requires it; the opening line carries it.",
    "Never contacts a lead who did not tick the consent box on the form.",
  ],
  handover: [
    { title: "Warm transfer", body: "During office hours, a caller who asks for a person, or a call the assistant cannot classify, is transferred to the intake desk with a one-line summary spoken first." },
    { title: "Attorney review", body: "A borderline lead (near the deadline, shared fault, out of state, or a low score) is written up in full and put on an attorney's list with a due time. The caller is told an attorney will call, and when." },
    { title: "Conflict hold", body: "A conflict hit stops the intake before any details are taken further. The caller is told a person will call back; the matter opens as a conflict review task." },
    { title: "Referral", body: "A case type you do not take gets a polite, scripted referral and a message for the intake desk, so the caller never hears a bare no." },
  ] as Step[],

  integration: { name: "Lawmatics", what: "contacts, matters and tasks" },
  integrations: [
    { system: "Lawmatics", what: "Finds and creates contacts, opens matters at the right stage with tags and source, creates attorney tasks, reads parties for the conflict check.", status: "Connect in onboarding. Clio Grow and Filevine on request." },
    { system: "Built-in pipeline", what: "The matter board inside the product, for firms that want to start before connecting their software.", status: "Included on every plan." },
    { system: "Twilio (SMS)", what: "Case reference and retainer link to the caller, callback pages to the attorney, STOP handling.", status: "Switched on per firm once carrier registration clears." },
    { system: "E-signature", what: "The retainer as a link to sign on the phone: DocuSign, Dropbox Sign or Lawmatics e-sign.", status: "Connect in onboarding." },
    { system: "Retell (voice)", what: "The phone line itself: numbers, outbound callbacks, call recording, transcripts.", status: "Included; you never deal with it directly." },
    { system: "Email", what: "Daily summary, weekly report, missed-lead alerts to the intake manager.", status: "Included." },
  ],
  integrationsMore: "Clio Grow, Filevine and Litify are on the list. If your firm runs on something not named here, say so on the demo call; the matter step is built to be pointed at a new system without touching the rest.",

  plans: [
    { id: "starter", name: "Starter", price: 149, minutes: 300, blurb: "One number, one office, email notifications and the built-in pipeline." },
    { id: "practice", name: "Practice", price: 349, minutes: 1000, blurb: "Three offices, case management and e-signature integration, texts to leads when SMS is switched on, the weekly report.", popular: true },
    { id: "group", name: "Group", price: 799, minutes: 3000, blurb: "Unlimited offices, several agents, priority support.", from: true },
  ],
  overagePerMinute: 0.25,
  pricingLead: "A typical intake call lasts four to five minutes. Three hundred minutes is about seventy leads a month; a thousand covers a firm that advertises.",
  planIncludes: [
    "A dedicated number, or forwarding from yours, with after-hours and overflow rules, and the web form callback.",
    "The dashboard, the matter pipeline, the speed-to-lead stopwatch and the consent log.",
    "The conflict check against your open matters on every intake.",
    "Attorney review for borderline leads, with the write-up ready before the callback.",
    "Onboarding with a person, and a test call before your number is forwarded.",
  ],

  faq: [
    { q: "Is an AI assistant allowed to do intake?", a: "It gathers facts and schedules; it does not give legal advice, quote case values or promise representation. Those stay with your attorneys, and the assistant says so on every call. The disclosures it makes are logged with the script version." },
    { q: "What about two-party consent states?", a: "The opening line carries the recording disclosure your state requires and the assistant does not continue until the caller has heard it. The wording is per state and you approve it in onboarding." },
    { q: "Will it sign up cases we would not take?", a: "No. It qualifies against your rules and thresholds. Anything borderline goes to attorney review, not to a retainer, and case types you do not take get a scripted referral." },
    { q: "How do I cancel?", a: "Month to month. Tell us and we forward your number back the same day." },
  ],
  faqTitle: "The ones every intake manager asks",
  cta: { title: "See it on your own intake questions", body: "The demo call takes twenty minutes. We set it up with your case types, your questions and your staff, then you call it." },
  bookLead: "Leave your details and someone from our team calls you within one business day to set a time. On the call we configure the assistant with your case types, intake questions and staff, and you phone it yourself.",
  bookTitle: "Twenty minutes, on your own intake questions",
  formExample: { name: "Dana Whitlock", business: "Harbor Point Injury Law", message: "Answer after-hours calls, qualify car accident leads and get the retainer signed before Monday." },

  securityExtra: [
    { title: "What the assistant is told", body: "Only what it needs for the call: your case types, your questions, your staff's first names and, for the conflict check, the names of parties on open matters. It never sees case notes, settlements or billing." },
    { title: "Consent and disclosures", body: "The recording notice, the assistant disclosure and every SMS consent are logged with the script version and the time, so the firm can show which words were said on which call." },
  ] as Step[],
  privacyCaller: "The assistant records the call after telling you so, transcribes it, and stores your name, phone number, what happened to you and the answers you gave so the firm can evaluate your case and call you back. Nothing you say is legal advice from the assistant, and the firm decides whether to represent you.",
  baa: false,
} as const;

export type Plan = (typeof PRODUCT.plans)[number];
