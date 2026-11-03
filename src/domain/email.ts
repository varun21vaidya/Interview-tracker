import type { Bundle } from '../types/entities';
import type { Target } from './rounds';
import { isEmail } from '../utils/links';
import { shortDate } from './status';

export type Template = 'follow_up' | 'reschedule' | 'check_fit';
export const TEMPLATES: { id: Template; label: string }[] = [
  { id: 'follow_up', label: 'Follow up' },
  { id: 'reschedule', label: 'Reschedule' },
  { id: 'check_fit', label: 'Check fit' },
];

/** Settings default signature, closing line included. */
export const DEFAULT_SIGNATURE = 'Best regards,\nYour Name\n+91 90000 00000\nlinkedin.com/in/yourname';

/** Check fit is the default for recruiter-call-only companies (C2). */
export const defaultTemplate = (target: Target | null): Template => (target?.type === 'recruiter_call' ? 'check_fit' : 'follow_up');

export interface EmailContext {
  company: string; role?: string; recruiterFirstName?: string;
  round?: { label: string; at: number };   // the round the email is about
  callAt?: number;                          // latest recruiter call
  signature: string;
}

/** "Technical" reads "Technical round" (screenshot). ASSUMPTION: labels already ending in round/screen/call/interview stay as typed. */
export const roundName = (label: string) => (/\b(round|screen|call|interview)$/i.test(label.trim()) ? label.trim() : `${label.trim()} round`);

/** Builds the context from the company bundle. The round is the waiting round, else the latest one. */
export function emailContext(b: Bundle, target: Target | null, signature: string, recruiterFirstName?: string): EmailContext {
  const byDate = [...b.rounds].sort((x, y) => y.orderAt - x.orderAt);
  const r = (target?.type === 'round' ? b.rounds.find(x => x.id === target.id) : undefined) ?? byDate[0];
  const call = [...b.calls].sort((x, y) => y.callAt - x.callAt)[0];
  return {
    company: b.company.name, role: b.company.role, recruiterFirstName,
    round: r ? { label: r.label, at: r.startsAt } : undefined,
    callAt: call?.callAt, signature,
  };
}

const greeting = (c: EmailContext) => (c.recruiterFirstName ? `Dear ${c.recruiterFirstName},` : 'Dear Hiring Team,');
const position = (c: EmailContext) => (c.role ? `the ${c.role} position at ${c.company}` : `a position at ${c.company}`);
const OPENER = 'I hope you are doing well.';
const CLOSER = 'Please let me know if you need anything further from my side.';

/** The sender's name from the signature: the line after a closing such as "Best regards,". The placeholder is skipped. */
export function signatureName(signature: string): string | undefined {
  const lines = signature.split('\n').map(l => l.trim()).filter(Boolean);
  const name = lines.length > 1 && /[,.]$/.test(lines[0]) ? lines[1] : lines.length === 1 ? undefined : lines[0];
  return name && name !== 'Your Name' ? name : undefined;
}

/** Subject with topic, role, company and sender, so the thread is easy to find: "Following up: Technical round | SDE II | Umbrella Labs | Your Name". */
const subject = (lead: string, topic: string, c: EmailContext) =>
  [`${lead}: ${topic}`, c.role, c.company, signatureName(c.signature)].filter(Boolean).join(' | ');

export function buildEmail(t: Template, c: EmailContext): { subject: string; body: string } {
    const sig = c.signature;
  switch (t) {
    case 'follow_up': {
      // Without a round, falls back to the recruiter call.
      const name = c.round ? roundName(c.round.label) : 'recruiter call';
      const at = c.round?.at ?? c.callAt;
      return {
        subject: subject('Following up', name, c),
        body: [
          greeting(c),
          OPENER,
          `Thank you for taking the time to speak with me during the ${name}${at !== undefined ? ` on ${shortDate(at)}` : ''} for ${position(c)}. I enjoyed the discussion and remain very enthusiastic about the opportunity.`,
          `I would be grateful if you could share an update on the next steps in the process. ${CLOSER}`,
          sig,
        ].join('\n\n'),
      };
    }
    case 'reschedule': {
      const name = c.round ? roundName(c.round.label) : 'interview';
      const when = c.round ? ` on ${shortDate(c.round.at)}` : '';
      return {
        subject: subject('Request to reschedule', name, c),
        body: [
          greeting(c),
          OPENER,
          `I joined the ${name}${when} for ${position(c)} at the scheduled time, but unfortunately the interview did not take place.`,
          'Could we please arrange a new time? I am happy to work around your availability and will confirm promptly.',
          'Thank you for your understanding.',
          sig,
        ].join('\n\n'),
      };
    }
    case 'check_fit': {
      const when = c.callAt !== undefined ? ` on ${shortDate(c.callAt)}` : '';
      return {
        subject: subject('Following up', 'recruiter call', c),
        body: [
          greeting(c),
          OPENER,
          `Thank you for speaking with me${when} about ${position(c)}. I appreciated the overview, and you mentioned you would be in touch about the next step.`,
          'Could you share an update on the process, and let me know whether my profile is a good fit for the role? I would welcome any feedback.',
          sig,
        ].join('\n\n'),
      };
    }
  }
}

/** To field. A missing or invalid recruiter email leaves it empty with a note. */
export function toField(email?: string): { to: string; note?: string } {
  const e = email?.trim();
  return e && isEmail(e)
    ? { to: e }
    : { to: '', note: 'No recruiter email saved. Add one to the recruiter, or enter the address in your mail app.' };
}
