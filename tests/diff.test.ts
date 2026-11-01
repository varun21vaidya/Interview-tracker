import { diffEvents, type Ignored } from '../src/domain/diff';
import type { CalEvent } from '../src/types/entities';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 1, 12).getTime();
const win = { from: NOW - 60 * DAY, to: NOW + 120 * DAY };
const ev = (id: string, startsAt: number, o: Partial<CalEvent> = {}): CalEvent =>
  ({ eventId: id, calendarId: 'cal', title: 'Interview', startsAt, ...o });
const map = (...es: CalEvent[]) => new Map(es.map(e => [e.eventId, e]));
const none = new Map<string, Ignored>();

describe('diffEvents', () => {
  it('reports an event we have not seen as new', () => {
    const e = ev('a', NOW + DAY);
    expect(diffEvents([e], map(), none, win)).toEqual([{ kind: 'new', ev: e }]);
  });

  it('reports nothing when nothing changed (refreshing twice is a no-op)', () => {
    const e = ev('a', NOW + DAY, { meetingLink: 'https://meet.google.com/x' });
    expect(diffEvents([e], map(e), none, win)).toEqual([]);
  });

  it('reports a moved start', () => {
    const old = ev('a', NOW + DAY), moved = ev('a', NOW + 2 * DAY);
    expect(diffEvents([moved], map(old), none, win)).toEqual([{ kind: 'moved', ev: moved }]);
  });

  it('reports a changed link, and a removed link', () => {
    const old = ev('a', NOW + DAY), withLink = ev('a', NOW + DAY, { meetingLink: 'https://meet.google.com/x' });
    expect(diffEvents([withLink], map(old), none, win)).toEqual([{ kind: 'link', ev: withLink }]);
    expect(diffEvents([old], map(withLink), none, win)).toEqual([{ kind: 'link', ev: old }]);
  });

  it('reports a stored event missing inside the window as cancelled', () => {
    expect(diffEvents([], map(ev('a', NOW + DAY)), none, win)).toEqual([{ kind: 'cancelled', eventId: 'a' }]);
  });

  it('does not call an event outside the window cancelled', () => {
    const old = ev('old', win.from - DAY), far = ev('far', win.to + DAY);
    expect(diffEvents([], map(old, far), none, win)).toEqual([]);
  });

  it('skips an ignored event that did not change', () => {
    const e = ev('a', NOW + DAY, { organizerEmail: 'hr@x.com' });
    expect(diffEvents([e], map(e), new Map([['a', { startsAt: e.startsAt, organizerEmail: 'hr@x.com' }]]), win)).toEqual([]);
  });

  it('gives new for an ignored event whose time changed', () => {
    const e = ev('a', NOW + 2 * DAY);
    expect(diffEvents([e], map(), new Map([['a', { startsAt: NOW + DAY }]]), win)).toEqual([{ kind: 'new', ev: e }]);
  });

  it('gives new for an ignored event whose organizer changed', () => {
    const e = ev('a', NOW + DAY, { organizerEmail: 'new@x.com' });
    expect(diffEvents([e], map(), new Map([['a', { startsAt: NOW + DAY, organizerEmail: 'old@x.com' }]]), win))
      .toEqual([{ kind: 'new', ev: e }]);
  });

  it('never calls an ignored event cancelled', () => {
    expect(diffEvents([], map(ev('a', NOW + DAY)), new Map([['a', { startsAt: NOW + DAY }]]), win)).toEqual([]);
  });

  it('only sees events from the stored map it is given (an unticked calendar is not cancelled)', () => {
    const tickedOnly = map(ev('a', NOW + DAY));            // the caller filtered by calendar id
    expect(diffEvents([ev('a', NOW + DAY)], tickedOnly, none, win)).toEqual([]);
  });
});
