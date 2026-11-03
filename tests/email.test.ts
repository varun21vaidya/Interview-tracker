import { buildEmail, DEFAULT_SIGNATURE, defaultTemplate, emailContext, roundName, signatureName, toField } from '../src/domain/email';
import { mailUri } from '../src/utils/links';
import type { Bundle } from '../src/types/entities';

const at = (mo: number, d: number) => new Date(2026, mo - 1, d, 10).getTime();
const umbrella: Bundle = {
  company: { id: 'c', name: 'Umbrella Labs', role: 'SDE II', status: 'active' },
  recruiter: { companyId: 'c', name: 'Raj Mehta', email: 'raj@umbrella.example' },
  calls: [], pings: [],
  rounds: [
    { id: 'r1', companyId: 'c', source: 'manual', type: 'phone', label: 'Recruiter screen', startsAt: at(10, 16), orderAt: at(10, 16), result: 'approved' },
    { id: 'r3', companyId: 'c', source: 'manual', type: 'online', label: 'Technical', startsAt: at(10, 23), orderAt: at(10, 23), result: 'pending' },
  ],
};
const target = { type: 'round' as const, id: 'r3', at: at(10, 23) };
const ctx = emailContext(umbrella, target, DEFAULT_SIGNATURE, 'Raj');

describe('Umbrella follow up', () => {
  const e = buildEmail('follow_up', ctx);
  it('subject', () => expect(e.subject).toBe('Following up: Technical round | SDE II | Umbrella Labs'));
  it('body, paragraph by paragraph', () => {
    expect(e.body.split('\n\n')).toEqual([
      'Dear Raj,',
      'I hope you are doing well.',
      'Thank you for taking the time to speak with me during the Technical round on 23 Oct for the SDE II position at Umbrella Labs. I enjoyed the discussion and remain very enthusiastic about the opportunity.',
      'I would be grateful if you could share an update on the next steps in the process. Please let me know if you need anything further from my side.',
      'Best regards,\nYour Name\n+91 90000 00000\nlinkedin.com/in/yourname',
    ]);
  });
});

describe('ASSUMPTION templates', () => {
  it('reschedule', () => {
    const e = buildEmail('reschedule', ctx);
    expect(e.subject).toBe('Request to reschedule: Technical round | SDE II | Umbrella Labs');
    expect(e.body).toContain('I joined the Technical round on 23 Oct for the SDE II position at Umbrella Labs at the scheduled time, but unfortunately the interview did not take place.');
    expect(e.body).toContain('Could we please arrange a new time?');
  });
  it('check fit', () => {
    const c = emailContext({ ...umbrella, rounds: [], calls: [{ id: 'k', companyId: 'c', callAt: at(10, 27) }] }, { type: 'recruiter_call', id: 'k', at: at(10, 27) }, 'Thanks', 'Raj');
    const e = buildEmail('check_fit', c);
    expect(e.subject).toBe('Following up: recruiter call | SDE II | Umbrella Labs');
    expect(e.body).toContain('whether my profile is a good fit');
    expect(e.body.endsWith('\n\nThanks')).toBe(true);
  });
});

describe('subject carries the sender name', () => {
  it('uses the name from the signature, not the placeholder or the closing', () => {
    const c = { ...ctx, signature: 'Best regards,'+String.fromCharCode(10)+'Varun Vaidya'+String.fromCharCode(10)+'+91 98765 43210' };
    expect(buildEmail('follow_up', c).subject).toBe('Following up: Technical round | SDE II | Umbrella Labs | Varun Vaidya');
    expect(signatureName('Thanks')).toBeUndefined();
    expect(signatureName(DEFAULT_SIGNATURE)).toBeUndefined();
  });
});

describe('details', () => {
  it('check fit is the default only for recruiter-call targets', () => {
    expect(defaultTemplate({ type: 'recruiter_call', id: 'k', at: 0 })).toBe('check_fit');
    expect(defaultTemplate(target)).toBe('follow_up');
    expect(defaultTemplate(null)).toBe('follow_up');
  });
  it('round names', () => {
    expect(roundName('Technical')).toBe('Technical round');
    expect(roundName('HR round')).toBe('HR round');
    expect(roundName('Recruiter screen')).toBe('Recruiter screen');
  });
  it('missing greeting name and role degrade cleanly', () => {
    const e = buildEmail('follow_up', { ...ctx, recruiterFirstName: undefined, role: undefined });
    expect(e.subject).toBe('Following up: Technical round | Umbrella Labs');
    expect(e.body.startsWith('Dear Hiring Team,')).toBe(true);
    expect(e.body).toContain('Technical round on 23 Oct for a position at Umbrella Labs.');
  });
  it('missing or invalid recruiter email leaves To empty with a note', () => {
    expect(toField('raj@umbrella.example')).toEqual({ to: 'raj@umbrella.example' });
    for (const bad of [undefined, '', 'not-an-email']) {
      const f = toField(bad);
      expect(f.to).toBe('');
      expect(f.note).toBeTruthy();
    }
  });
  it('mailUri validates the address and encodes the text', () => {
    expect(mailUri('raj@umbrella.example', 'A & B', 'Hi\nthere')).toBe('mailto:raj@umbrella.example?subject=A%20%26%20B&body=Hi%0Athere');
    expect(mailUri('bad address', 's', 'b')).toBe('mailto:?subject=s&body=b');
  });
  it('rejects addresses that would inject mail parameters or recipients', () => {
    for (const bad of ['a@b.co?bcc=x@evil.com', 'a@b.co&cc=x@evil.com', 'a@b.co,x@evil.com', 'a@b.co;x@evil.com', '<a@b.co>']) {
      expect(mailUri(bad, 's', 'b')).toBe('mailto:?subject=s&body=b');
      expect(toField(bad).to).toBe('');
    }
  });
});
