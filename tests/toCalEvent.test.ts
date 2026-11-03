import { keywordMatcher } from '../src/domain/extract';
import { toCalEvent } from '../src/domain/toCalEvent';

jest.mock('expo-calendar', () => ({}));

const kw = keywordMatcher(['interview', 'HR']);
const base = { id: 'e1', calendarId: 'c1', startDate: '2026-11-05T10:00:00.000Z', endDate: '2026-11-05T11:00:00.000Z' };

describe('toCalEvent', () => {
  it('extracts a Meet link and phone from a real-looking event, and keeps no description', () => {
    const ev = toCalEvent({
      ...base, title: 'Acme - HR round', location: null, organizerEmail: 'Rec@Acme.com',
      notes: '<p>Join https://meet.google.com/abc-defg-hij</p> Call +91 90000 00000. Secret salary talk.',
    }, kw)!;
    expect(ev.meetingLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(ev.phone).toBe('+91 90000 00000');
    expect(ev.organizerEmail).toBe('rec@acme.com');
    expect(ev.startsAt).toBe(Date.parse(base.startDate));
    expect(JSON.stringify(ev)).not.toMatch(/Secret salary/);
  });
  it('drops events with no keyword', () => {
    expect(toCalEvent({ ...base, title: 'Dentist', notes: '' }, kw)).toBeNull();
  });
  it('keeps an event whose keyword is only in the description', () => {
    expect(toCalEvent({ ...base, title: 'Call', notes: 'interview prep' }, kw)).not.toBeNull();
  });
});

describe('organizer fallback', () => {
  const base = { id: 'e', calendarId: 'c', title: 'HR round', startDate: '2026-10-23T10:00:00Z', endDate: '2026-10-23T11:00:00Z' };
  const kw = () => true;
  it('uses the address in the description when the organizer is a system address', () => {
    const ev = toCalEvent({ ...base, organizerEmail: 'noreply@calendar.google.com', notes: 'Write to Priya at priya@acme.com' }, kw);
    expect(ev?.organizerEmail).toBe('priya@acme.com');
  });
  it('keeps a real organizer', () => {
    const ev = toCalEvent({ ...base, organizerEmail: 'Raj@Acme.com', notes: 'cc priya@acme.com' }, kw);
    expect(ev?.organizerEmail).toBe('raj@acme.com');
  });
});
