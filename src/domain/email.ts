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

/** Settings default, copied from the screenshot's signature. */
export const DEFAULT_SIGNATURE = 'Thanks,\nYour Name\n+91 90000 00000\nlinkedin.com/in/yourname';

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

const greeting = (c: EmailContext) => `Hi ${c.recruiterFirstName ?? 'there'},`;
const forRole = (c: EmailContext) => (c.role ? `for the ${c.role} role at ${c.company}` : `at ${c.company}`);

export function buildEmail(t: Template, c: EmailContext): { subject: string; body: string } {
  const role = c.role ? `${c.role}, ` : '';
  const sig = c.signature;
  switch (t) {
    case 'follow_up': {
      // Text and subject are the screenshot, character for character. Without a round, falls back to the recruiter call.
      const name = c.round ? roundName(c.round.label) : 'recruiter call';
      const at = c.round?.at ?? c.callAt;
      return {
        subject: `Following up: ${role}${name}`,
        body: [
          greeting(c),
          `Thank you for the ${name}${at !== undefined ? ` on ${shortDate(at)}` : ''} ${forRole(c)}. I enjoyed the discussion and remain very interested.`,
          'Could you share an update on the next steps?',
          sig,
        ].join('\n\n'),
      };
    }
    case 'reschedule': {
      // ASSUMPTION: wording drafted from the spec prose (3.6). Subject is also an ASSUMPTION.
      const name = c.round ? roundName(c.round.label) : 'interview';
      const when = c.round ? ` on ${shortDate(c.round.at)}` : '';
      return {
        subject: `Rescheduling: ${role}${name}`,
        body: [
          greeting(c),
          `I joined the ${name}${when} ${forRole(c)} at the scheduled time, but the interview did not take place.`,
          'Could you please share a new slot?',
          sig,
        ].join('\n\n'),
      };
    }
    case 'check_fit': {
      // ASSUMPTION: wording drafted from the spec prose (3.6). Subject is also an ASSUMPTION.
      const when = c.callAt !== undefined ? ` on ${shortDate(c.callAt)}` : '';
      return {
        subject: `Following up: ${role}recruiter call`,
        body: [
          greeting(c),
          `Thank you for the call${when} about the ${c.role ? `${c.role} role at ${c.company}` : `opening at ${c.company}`}. You mentioned you would schedule the next step.`,
          'Could you share an update, and let me know whether my profile is a good fit for the role?',
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
