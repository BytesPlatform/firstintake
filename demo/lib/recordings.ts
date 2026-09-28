/**
 * The "Hear it" recordings on the landing site. Synthetic for now (two neural
 * voices, caller side band-limited like a phone line); replaced with real
 * calls to the product's own agent once phone numbers exist.
 */

export interface RecordingLine {
  who: "agent" | "caller";
  text: string;
}

export interface Recording {
  id: string;
  title: string;
  scene: string;
  file: string;
  seconds: number;
  transcript: RecordingLine[];
}

export const RECORDINGS: Recording[] = [
  {
    id: "car-accident",
    title: "A rear-end collision, Saturday night",
    scene: "A new lead calls after hours. Qualified, conflict checked, retainer texted and the attorney callback set in forty-four seconds.",
    file: "/audio/legal-intake-car-accident.mp3",
    seconds: 44,
    transcript: [
      { who: "agent", text: "Harbor Point Injury Law. Are you calling about a new injury?" },
      { who: "caller", text: "Yes. I was rear-ended on I-275 last Tuesday, and my neck's been bad since." },
      { who: "agent", text: "I'm sorry to hear that. Have you seen a doctor, and was a police report filed?" },
      { who: "caller", text: "I went to the ER that night, and yes, the other driver got the ticket." },
      { who: "agent", text: "Thank you. This is a case we can take, and the conflict check is clear. I'll text you the retainer now, and attorney Maya Castellano will call you within the hour." },
      { who: "caller", text: "That sounds great." },
      { who: "agent", text: "Done. The link is on its way to your phone. Feel better soon." },
    ],
  },
];
