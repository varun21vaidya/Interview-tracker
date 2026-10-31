import { buildHome, countdown, dateLine, nextModel, previousModels, updatedText, waitingModels } from '../src/domain/home';
import type { Bundle, Company, Round } from '../src/types/entities';

const at = (mo: number, d: number, h = 0, mi = 0) => new Date(2026, mo - 1, d, h, mi).getTime();
const NOW = at(10, 31, 10, 42);
const MEET = 'https://meet.google.com/abc-defg-hij';

let n = 0;
const company = (name: string, o: Partial<Company> = {}): Company => ({ id: `c-${name}`, name, status: 'active', ...o });
const round = (c: Company, startsAt: number, o: Partial<Round> = {}): Round => ({
  id: `r${++n}`, companyId: c.id, source: 'manual', type: 'online', label: 'Technical', startsAt, orderAt: startsAt, result: 'pending', ...o,
});

function seed(): Bundle[] {
  const umb = company('Umbrella Labs', { role: 'SDE II' });
  const wayne = company('Wayne Tech');
  const globex = company('Globex');
  const acme = company('Acme Corp', { role: 'Senior Backend Engineer' });
  const initech = company('Initech', { status: 'rejected' });
  const umbPending = round(umb, at(10, 23));
  return [
    { company: umb, rounds: [round(umb, at(10, 16), { result: 'approved' }), umbPending], calls: [], pings: [] },
    { company: wayne, rounds: [], calls: [{ id: 'k', companyId: wayne.id, callAt: at(10, 27, 11) }], pings: [] },
    { company: globex, rounds: [round(globex, at(10, 30), { type: 'walk_in', label: 'HR round' })], calls: [], pings: [] },
    {
      company: acme, recruiter: { companyId: acme.id, name: 'Priya Sharma', phone: '+91 90000 00000' },
      rounds: [
        round(acme, at(10, 15), { result: 'approved' }),
        round(acme, NOW + 135 * 60_000, { label: 'Final round', endsAt: NOW + 195 * 60_000, locationOrLink: MEET }),
      ],
      calls: [], pings: [],
    },
    { company: initech, rounds: [round(initech, at(10, 11), { result: 'rejected' })], calls: [], pings: [] },
  ];
}

describe('buildHome', () => {
  const home = buildHome(seed(), 1, NOW);

  it('Acme is next and not waiting; Globex and Wayne wait; rejected appears nowhere', () => {
    expect(home.next?.b.company.name).toBe('Acme Corp');
    const waiting = home.waiting.map(w => w.b.company.name);
    expect(waiting).toEqual(['Umbrella Labs', 'Wayne Tech', 'Globex']);
    expect(waiting).not.toContain('Acme Corp');
    const all = JSON.stringify([home.next?.b.company.name, home.upcoming, waiting, home.previous.map(p => p.b.company.name)]);
    expect(all).not.toContain('Initech');
  });

  it('Globex is under Waiting, never Previous (the decision beats the screenshot)', () => {
    expect(home.previous.map(p => p.b.company.name)).not.toContain('Globex');
  });
});

describe('home view models', () => {
  const home = buildHome(seed(), 0, NOW);

  it('next card: chips, countdown, https-only link, recruiter row', () => {
    const m = nextModel(home.next, NOW)!;
    expect(m.chips).toEqual(['Manual', 'Round 2']);
    expect(m.countdown).toBe('in 2h 15m');
    expect(m.link).toBe(MEET);
    expect(m.phone).toBe('+91 90000 00000');
  });

  it('next card drops a non-https link', () => {
    const b = seed();
    b[3].rounds[1].locationOrLink = 'http://meet.example/x';
    expect(nextModel(buildHome(b, 0, NOW).next, NOW)!.link).toBeNull();
  });

  it('waiting lists recruiter-call-only with the Awaiting bubble and Check fit template', () => {
    const w = waitingModels(home.waiting, NOW).find(x => x.name === 'Wayne Tech')!;
    expect(w.pending.text).toBe('Awaiting schedule · 4 days');
    expect(w.ping?.text).toBe('Haven’t pinged yet');
    expect(w.template).toBe('check_fit');
    expect(w.line).toBe('Recruiter call · 27 Oct');
  });

  it('previous caps at 5 and a walk-in reads Walk-in', () => {
    const many: Bundle[] = Array.from({ length: 7 }, (_, i) => {
      const c = company(`Co${i}`);
      return { company: c, rounds: [round(c, at(10, 20 - i), { result: 'approved', type: 'walk_in', label: 'HR round' })], calls: [], pings: [] };
    });
    const prev = previousModels(buildHome(many, 0, NOW).previous, NOW);
    expect(prev).toHaveLength(5);
    expect(prev[0].line).toBe('HR round · 20 Oct · Walk-in');
  });
});

describe('formatting', () => {
  it('countdown', () => {
    expect(countdown(NOW + 135 * 60_000, NOW)).toBe('in 2h 15m');
    expect(countdown(NOW + 45 * 60_000, NOW)).toBe('in 45m');
    expect(countdown(NOW + 120 * 60_000, NOW)).toBe('in 2h');
    expect(countdown(NOW + 27 * 3_600_000, NOW)).toBe('in 1d 3h');
    expect(countdown(NOW - 1, NOW)).toBe('now');
  });

  it('date line reads last_sync', () => {
    expect(dateLine(NOW, NOW - 10_000)).toBe('Saturday, 31 Oct · Updated just now');
    expect(dateLine(NOW, null)).toBe('Saturday, 31 Oct');
    expect(updatedText(NOW - 5 * 60_000, NOW)).toBe('Updated 5 min ago');
  });
});
