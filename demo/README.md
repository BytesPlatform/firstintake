# FirstIntake, the app

This folder is the FirstIntake product: the marketing site, the public demo,
the firm's workspace and our console. The repository README one level up
describes the product; this file is the operator's manual for the assistant
and the demo. The demo answers as Harbor Point Injury Law, a fictional Tampa
firm. Florida is chosen on purpose: two-party consent for recording and a
two-year negligence deadline, so both rules get exercised on every call.

## What the demo screen shows

One page fed by a single poll of `/api/state`: the Intake panel with a Call tab
and a Web form tab, the Matter panel showing the file being built while the
caller is on the line, the Follow-up panel (attorney tasks, texts, e-sign
envelope, consent trail with script versions), the Speed to lead stopwatch,
and the ten-step Pipeline with timings.

### The scenes

1. **Strong car accident lead, after hours.** Rear-ended, treated at the ER,
   police report, other driver at fault. Qualified, conflict check clear,
   retainer texted, attorney callback within the hour.
2. **Web form.** Submit the form; the assistant dials the lead back within
   seconds when `RETELL_FROM_NUMBER` is set, otherwise texts and opens an
   intake task, and the stopwatch says which happened.
3. **Deadline passed, represented, or shared fault.** Declined politely or sent
   to attorney review with the write-up ready.
4. **Conflict hit.** A name already on an open matter stops the intake and
   opens a conflict review task.
5. **Referral.** A case type the firm does not take gets a scripted referral.

The scripts for every scene are in `Demo_Call_Scripts.pdf` alongside the three
repositories.

## Running locally

```bash
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
npm test             # the whole pipeline on an embedded database, no accounts
```

Blank environment: the demo runs on an embedded Postgres with the mock
Lawmatics, texts and the retainer as previews on screen, email in preview
mode, and the product routes closed until Clerk keys exist (see
`docs/auth-setup.md`).

## Retell, about twenty minutes

1. Copy both keys from the Retell dashboard under API Keys. The API key signs
   the webhooks; the public key is for the browser call widget.
2. Deploy first, because the push script needs the hostname.
3. Push the flow and the agent. Existing ids in `retell/.demo-ids.json` are
   updated rather than duplicated, and the agent is published:

   ```
   RETELL_API_KEY=key_... DEMO_HOST=firstintake-zeta.vercel.app npm run push:retell
   ```

4. Add the site's domain to the public key's allowed domains in the Retell
   dashboard, or the browser call fails with "Public key is not allowed for
   this domain".
5. Set `RETELL_API_KEY`, `NEXT_PUBLIC_RETELL_PUBLIC_KEY` and
   `NEXT_PUBLIC_RETELL_AGENT_ID` on the deploy. For the web form callback buy a
   Retell number and set `RETELL_FROM_NUMBER`.

## Lawmatics, Twilio and e-sign

All optional. `LAWMATICS_TOKEN` switches the gateway from the mock to a real
firm (with `LAWMATICS_STAGE_MAP`, `LAWMATICS_INTAKE_USER_ID`,
`LAWMATICS_ATTORNEY_USER_ID` to map stages and assignees). `TWILIO_*` sends
real texts once toll-free verification clears. `ESIGN_API_KEY` sends a real
envelope instead of a preview. Each is a single adapter; the pipeline does
not change.

## Troubleshooting

- **Every tool call returns "invalid signature".** `RETELL_API_KEY` on the
  deploy is not the key that created the agent.
- **"Unknown agent" from the tool route.** The agent id is not the demo
  tenant's and no customer owns it. Paste it into the workspace in `/admin`,
  or check `NEXT_PUBLIC_RETELL_AGENT_ID`.
- **The board does not update after a call.** `DATABASE_URL` is missing on a
  serverless deploy, so every request gets its own embedded database.
- **Qualification stuck at attorney review.** The agent did not get the
  enumerated answers; the `qualify_lead` tool bounces twice for missing
  answers, then sends the lead to review by design.

## Files

- `lib/config.ts` firm, staff, case types, qualifying questions, scripts, thresholds
- `lib/tools.ts` the nine tools the agent can call
- `lib/lawmatics/` mock and live gateways behind one interface
- `lib/messages.ts` texts, emails and the retainer link, preview or real
- `lib/tenancy.ts`, `lib/auth.ts`, `lib/scope.ts` workspaces and sign-in
- `lib/leads.ts`, `lib/jobs.ts`, `lib/messaging/email.ts`, `emails/` demo requests, the worker, product email
- `lib/product.ts`, `lib/recordings.ts` the words on the site and in the emails
- `retell/` the conversation flow, the agent, the validator and the push script
- `tests/smoke.ts` the whole pipeline end to end
