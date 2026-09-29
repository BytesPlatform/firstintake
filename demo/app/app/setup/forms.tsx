/**
 * The step forms for a personal injury firm. Server components; each
 * renders one step's fields from the tenant's configuration and posts to
 * its action. Used by the setup flow (mode "setup") and by Settings.
 */
import { PRODUCT } from "@/lib/product";
import { forwardingInstructions, needsRepublish } from "@/lib/provision";
import type { Tenant } from "@/lib/tenancy";
import { ALL_PARTY_STATES, DAY_NAMES, STATE_NAMES, configOf, readiness, stateNameFor, type DayKey } from "@/lib/tenant-config";
import {
  buyNumberAction,
  forwardNumberAction,
  publishAgentAction,
  releaseNumberAction,
  saveAccountAction,
  saveBehaviourAction,
  saveBusinessAction,
  saveServicesAction,
  saveSoftwareAction,
} from "./actions";

export type Mode = "setup" | "settings";

function Submit({ mode, label }: { mode: Mode; label?: string }) {
  return (
    <div className="admin-actions">
      <button className="btn btn-cta" type="submit">
        {label ?? (mode === "setup" ? "Save and continue" : "Save")}
      </button>
    </div>
  );
}

export function AccountForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveAccountAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>Firm name, as the assistant will say it</span>
        <input name="name" defaultValue={tenant.name} required />
      </label>
      <label className="admin-field">
        <span>Short name, for texts</span>
        <input name="short_name" defaultValue={tenant.short_name} />
      </label>
      <label className="admin-field">
        <span>Time zone</span>
        <select name="timezone" defaultValue={c.basics.timezone}>
          {["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"].map((z) => (
            <option key={z} value={z}>
              {z.replace("America/", "").replace("Pacific/", "").replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Website</span>
        <input name="website" defaultValue={c.basics.website} placeholder="https://" />
      </label>
      {mode === "setup" ? (
        <>
          <div className="admin-divider" />
          <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
            Invite someone else who should see the pipeline, for example your intake manager. Optional; you can add people later under Settings.
          </p>
          <label className="admin-field">
            <span>Their name</span>
            <input name="invite_name" />
          </label>
          <label className="admin-field">
            <span>Their email</span>
            <input name="invite_email" type="email" />
          </label>
        </>
      ) : null}
      <Submit mode={mode} />
    </form>
  );
}

export function BusinessForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  const allParty = ALL_PARTY_STATES.has(c.basics.state);
  return (
    <form action={saveBusinessAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>Office address, spoken to callers who ask</span>
        <input name="address" defaultValue={c.basics.address} placeholder="400 North Ashley Drive, Suite 1200" />
      </label>
      <label className="admin-field">
        <span>City</span>
        <input name="city" defaultValue={c.basics.city} placeholder="Tampa" />
      </label>
      <label className="admin-field">
        <span>State the firm practises in</span>
        <select name="state" defaultValue={c.basics.state}>
          {Object.entries(STATE_NAMES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>The phone number the assistant gives out</span>
        <input name="callback_number" defaultValue={c.basics.callbackNumber} required placeholder="(813) 555-0142" />
      </label>
      <p className="admin-help admin-field-wide">
        {allParty
          ? `${stateNameFor(c)} requires every party's consent before a call is recorded, so the greeting announces the recording before anything else. The default wording covers it.`
          : `${stateNameFor(c)} is a one-party consent state, but the greeting still announces the recording; it is the safe wording everywhere and callers expect it.`}{" "}
        The intake line answers around the clock; office hours only decide who is on call and how calls are tagged.
      </p>
      <div className="admin-field-wide">
        <span className="admin-field" style={{ display: "block", marginBottom: "0.4rem" }}>
          Office hours
        </span>
        <table className="admin-table setup-hours">
          <tbody>
            {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((d) => {
              const h = c.basics.hours[d];
              return (
                <tr key={d}>
                  <td>{DAY_NAMES[d]}</td>
                  <td>
                    <input type="time" name={`open_${d}`} defaultValue={h?.open ?? "08:30"} />
                  </td>
                  <td>to</td>
                  <td>
                    <input type="time" name={`close_${d}`} defaultValue={h?.close ?? "17:30"} />
                  </td>
                  <td>
                    <label className="admin-check">
                      <input type="checkbox" name={`closed_${d}`} defaultChecked={!h} />
                      <span>Closed</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Submit mode={mode} />
    </form>
  );
}

export function ServicesForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  const questionLines = c.caseTypes
    .filter((x) => x.accepted && x.id !== "other")
    .flatMap((x) => (c.questions[x.id] ?? []).map((q) => `${x.name}: ${q}`))
    .join("\n");
  return (
    <form action={saveServicesAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>
          Case types, one per line: <code className="admin-code">name | take or refer | deadline years | typical fee $</code>. The deadline years are your firm's own table and drive when a lead is escalated; confirm them with your attorneys. The fee is never spoken; the board uses it.
        </span>
        <textarea name="case_types" rows={8} defaultValue={c.caseTypes.filter((x) => x.id !== "other").map((x) => `${x.name} | ${x.accepted ? "take" : "refer"} | ${x.deadlineYears} | ${x.typicalFee || ""}`).join("\n")} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>
          Qualifying questions, one per line: <code className="admin-code">case type: question</code>. Asked in order, one at a time. Nothing here may ask for a social security number, a date of birth, a card, or medical records.
        </span>
        <textarea name="questions" rows={10} defaultValue={questionLines} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>
          Intake team, one per line: <code className="admin-code">name | intake or attorney | title | on-call days</code>. On-call days are when that intake specialist carries the after-hours phone, for example Mon, Wed, Fri.
        </span>
        <textarea name="staff" rows={5} defaultValue={c.staff.map((s) => `${s.name} | ${s.role} | ${s.title} | ${s.onCallDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`).join("\n")} />
      </label>
      <label className="admin-field">
        <span>Referral partner for cases you do not take</span>
        <input name="referral_partner" defaultValue={c.referralPartner} placeholder="The firm you refer to, optional" />
      </label>
      <p className="admin-help admin-field-wide">
        Fixed rules: the assistant never gives legal advice, never estimates what a case is worth, never promises representation, and never sends a retainer before the conflict check is clear and the caller consents to the text or email.
      </p>
      <Submit mode={mode} />
    </form>
  );
}

export function BehaviourForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveBehaviourAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>
          Greeting for inbound calls. It must announce the recording and the assistant. Write {"{{firm_name}}"} where the firm name should be spoken. Web-form callbacks use a fixed opening that says why the assistant is calling.
        </span>
        <textarea name="greeting" rows={3} defaultValue={c.behaviour.greeting} required />
      </label>
      <label className="admin-field">
        <span>Tone</span>
        <select name="tone" defaultValue={c.behaviour.tone}>
          <option value="calm">Calm, steady and kind</option>
          <option value="friendly">Warm and human</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Intake desk number for "speak to a person"</span>
        <input name="transfer_number" defaultValue={c.behaviour.transferNumber} placeholder="The line your intake team answers" />
      </label>
      <label className="admin-check admin-field-wide">
        <input type="checkbox" name="take_message" defaultChecked={c.behaviour.takeMessageWhenUnanswered} />
        <span>If the transfer is not answered, take the details and open an intake task instead of dropping the caller into voicemail</span>
      </label>
      <Submit mode={mode} />
    </form>
  );
}

export function SoftwareForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveSoftwareAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>Case management</span>
        <select name="case_management" defaultValue={c.software.caseManagement}>
          <option value="none">None, use the built-in pipeline</option>
          <option value="lawmatics">Lawmatics (our team connects it with you)</option>
          <option value="clio">Clio Grow (on request)</option>
          <option value="filevine">Filevine (on request)</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="admin-field">
        <span>E-signature for the retainer</span>
        <select name="esign" defaultValue={c.software.esign}>
          <option value="none">None yet, keep the retainer as a preview</option>
          <option value="docusign">DocuSign</option>
          <option value="dropboxsign">Dropbox Sign</option>
          <option value="lawmatics">Lawmatics e-sign</option>
        </select>
      </label>
      <label className="admin-field admin-field-wide">
        <span>Anything we should know about your setup</span>
        <textarea name="note" rows={2} defaultValue={c.software.note} placeholder="Lawmatics for intake, Filevine once signed; retainer template is in DocuSign..." />
      </label>
      <p className="admin-help admin-field-wide">
        Everything works on the built-in pipeline from day one. Choosing a connection here tells our team to set it up with you; nothing changes until they do.
      </p>
      <Submit mode={mode} />
    </form>
  );
}

export function PhoneForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  const ready = readiness(c);
  const published = Boolean(c.agent.agentId);
  const stale = published && needsRepublish(tenant);
  return (
    <div className="setup-stack">
      <section className="admin-section">
        <h2 className="admin-title-sm">1. Publish the assistant</h2>
        {ready.ok ? (
          <p className="admin-help">
            {published
              ? stale
                ? "Your configuration changed since the assistant was last published. Publish again so the next call uses it."
                : `Published${c.agent.publishedAt ? ` ${new Date(c.agent.publishedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}. It answers with your greeting, case types, deadline table, questions and team.`
              : "This turns everything you entered into your assistant. It takes a few seconds."}
          </p>
        ) : (
          <p className="admin-warn">Still missing: {ready.missing.join(", ")}. Go back and fill those in first.</p>
        )}
        <form action={publishAgentAction}>
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="step" value="phone" />
          <div className="admin-actions">
            <button className={`btn ${published && !stale ? "btn-quiet" : "btn-cta"}`} type="submit" disabled={!ready.ok}>
              {published ? "Publish again" : "Publish the assistant"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">2. A number for it to answer</h2>
        {c.phone.number ? (
          <>
            <p className="admin-help">
              Your assistant answers on <strong>{c.phone.number}</strong>. Call it from your mobile to hear it. The same number is what web-form leads are dialled back from.
            </p>
            {mode === "settings" ? (
              <form action={releaseNumberAction}>
                <div className="admin-actions">
                  <button className="btn btn-quiet" type="submit">
                    Release this number
                  </button>
                </div>
              </form>
            ) : null}
          </>
        ) : (
          <>
            <p className="admin-help">
              We buy a local number in your area code and bind it to your assistant. About $2 a month, included in your plan. You can keep your existing number and forward it to this one; the carrier steps are below.
            </p>
            <form action={buyNumberAction} className="admin-form admin-form-inline">
              <label className="admin-field">
                <span>Area code</span>
                <input name="area_code" defaultValue={c.phone.areaCode || c.basics.callbackNumber.replace(/\D/g, "").replace(/^1/, "").slice(0, 3)} maxLength={3} placeholder="813" />
              </label>
              <div className="admin-actions">
                <button className="btn btn-cta" type="submit" disabled={!published}>
                  Buy the number
                </button>
              </div>
            </form>
            {!published ? <p className="admin-sub">Publish the assistant first.</p> : null}
          </>
        )}
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">3. Keeping your existing number</h2>
        <p className="admin-help">
          Most firms keep their advertised number and forward it: after hours, when nobody picks up, or always. Tell us the number and the carrier and we show the exact steps.
        </p>
        <form action={forwardNumberAction} className="admin-form admin-form-inline">
          <label className="admin-field">
            <span>Your current firm number</span>
            <input name="existing_number" defaultValue={c.phone.existingNumber} placeholder="(813) 555-0142" />
          </label>
          <label className="admin-field">
            <span>Carrier or phone system</span>
            <input name="carrier" defaultValue={c.phone.carrier} placeholder="AT&T, Verizon, RingCentral, Grasshopper..." />
          </label>
          <div className="admin-actions">
            <button className="btn btn-quiet" type="submit">
              Show the steps
            </button>
          </div>
        </form>
        {c.phone.mode === "forward" && c.phone.number ? (
          <ol className="setup-steps-list">
            {forwardingInstructions(c.phone.carrier, c.phone.number).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : c.phone.mode === "forward" ? (
          <p className="admin-sub">Buy the number above first; the forwarding steps need it.</p>
        ) : null}
        <p className="admin-sub">Texts with the file reference and the retainer link come from a separate number and are switched on by our team once carrier registration clears. Consent is already recorded on every call with the script version.</p>
      </section>

      {mode === "setup" ? (
        <div className="admin-actions">
          <a className={`btn ${c.phone.number || c.phone.mode === "forward" ? "btn-cta" : "btn-quiet"}`} href="/app/setup/test">
            Continue to the test call
          </a>
        </div>
      ) : null}
      <p className="admin-sub">{PRODUCT.name} numbers are provided through Retell.</p>
    </div>
  );
}

/** The go-live summary, one row per thing the assistant now knows. */
export function SummaryRows({ tenant, c }: { tenant: Tenant; c: ReturnType<typeof configOf> }) {
  return (
    <>
      <tr>
        <td>Firm</td>
        <td>
          {tenant.name}, {c.basics.city ? `${c.basics.city}, ` : ""}
          {stateNameFor(c)}
        </td>
      </tr>
      <tr>
        <td>Number it gives out</td>
        <td>{c.basics.callbackNumber}</td>
      </tr>
      <tr>
        <td>Takes</td>
        <td>{c.caseTypes.filter((x) => x.accepted && x.id !== "other").map((x) => x.name).join(", ")}</td>
      </tr>
      <tr>
        <td>Refers out</td>
        <td>{c.caseTypes.filter((x) => !x.accepted).map((x) => x.name).join(", ") || "nothing"}{c.referralPartner ? `, to ${c.referralPartner}` : ""}</td>
      </tr>
      <tr>
        <td>Team</td>
        <td>{c.staff.map((s) => `${s.name} (${s.role})`).join(", ")}</td>
      </tr>
      <tr>
        <td>Transfer to a person</td>
        <td>{c.behaviour.transferNumber || "not set; the assistant takes the details instead"}</td>
      </tr>
    </>
  );
}

export const STAFF_NOTES = [
  "Every lead the assistant takes is a matter on the pipeline with the caller's own words, the score and the stage.",
  "Qualified leads get the retainer texted after consent; the attorney callback task carries the time the caller was promised.",
  "Borderline leads go to attorney review with the write-up ready; nobody is declined by the assistant alone.",
  "The consent log records which disclosure ran on which call, with the script version, which is what a bar complaint answer needs.",
  "If it gets something wrong, open the call, find the step, and change the rule in Settings. It follows the new rule on the next call.",
];
