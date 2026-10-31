import { getDb } from './client';
import { emitChange } from './bus';

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const MEET = 'https://meet.google.com/abc-defg-hij'; // ASSUMPTION

const TABLES = [
  'notification_map', 'ping', 'review_item', 'ignored_event', 'calendar_event',
  'alias', 'round', 'recruiter_call', 'recruiter', 'company', 'settings',
];

const SECTIONS = ['About', 'Responsibilities', 'Requirements', 'Nice to have', 'Benefits'];
const FILLER = ('We build reliable distributed systems that process millions of jobs every day and our engineers own '
  + 'services from design through production with careful attention to scaling testing and observability').split(' ');

/** Exactly `total` words across the five headings (headings count as words). */
function makeJd(total: number) {
  const per = Math.floor(total / SECTIONS.length);
  const out: string[] = [];
  let used = 0;
  SECTIONS.forEach((h, i) => {
    const heading = h.split(' ').length;
    const body = i === SECTIONS.length - 1 ? total - used - heading : per - heading;
    const words = Array.from({ length: body }, (_, k) => FILLER[k % FILLER.length]);
    out.push(`${h}\n${words.join(' ')}`);
    used += heading + body;
  });
  return { text: out.join('\n\n'), words: total };
}

export async function loadSampleData(now = Date.now()) {
  const db = await getDb();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const t0 = today.getTime();
  const ago = (days: number) => t0 - days * DAY;
  let n = 0;
  const id = (p: string) => `seed-${p}-${++n}`;

  await db.withTransactionAsync(async () => {
    for (const t of TABLES) await db.runAsync(`DELETE FROM ${t}`); // t is a constant

    const company = async (
      name: string, role: string,
      o: { notes?: string; jd?: { text: string; words: number }; status?: 'active' | 'rejected'; afterRound?: number; rejectedAt?: number } = {},
    ) => {
      const cid = id('co');
      const rejected = o.status === 'rejected';
      await db.runAsync(
        `INSERT INTO company (id, name, role, status, rejected_reason, rejected_after_round, rejected_at,
           jd_text, jd_words, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [cid, name, role, rejected ? 'rejected' : 'active', rejected ? 'round' : null,
          rejected ? o.afterRound ?? null : null, rejected ? o.rejectedAt ?? null : null,
          o.jd?.text ?? null, o.jd?.words ?? null, o.notes ?? null, now, now]);
      return cid;
    };
    const recruiter = (cid: string, name: string, phone: string, email?: string) =>
      db.runAsync('INSERT INTO recruiter (company_id, name, phone, email) VALUES (?,?,?,?)', [cid, name, phone, email ?? null]);
    const round = async (
      cid: string, startsAt: number,
      o: { type?: 'walk_in' | 'offline' | 'phone' | 'online'; label: string; result: string; endsAt?: number; link?: string; notes?: string },
    ) => {
      const rid = id('rd');
      await db.runAsync(
        `INSERT INTO round (id, company_id, source, type, label, starts_at, ends_at, order_at, location_or_link,
           notes, result, result_set_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [rid, cid, 'manual', o.type ?? 'online', o.label, startsAt, o.endsAt ?? null, startsAt, o.link ?? null,
          o.notes ?? null, o.result, o.result === 'pending' ? null : startsAt + HOUR, now, now]);
      return rid;
    };
    const ping = (cid: string, targetType: 'round' | 'recruiter_call', targetId: string, at: number) =>
      db.runAsync(
        'INSERT INTO ping (id, company_id, target_type, target_id, pinged_at, channel) VALUES (?,?,?,?,?,?)',
        [id('pg'), cid, targetType, targetId, at, 'mark']);

    // Umbrella Labs
    const jd = makeJd(1850);
    const umb = await company('Umbrella Labs', 'SDE II', { notes: 'Discussed scaling the job queue. Ask about team structure.', jd });
    await recruiter(umb, 'Raj Mehta', '+91 90000 00001', 'raj@umbrella.example');
    await round(umb, ago(15), { type: 'phone', label: 'Recruiter screen', result: 'approved' });
    await round(umb, ago(11), { label: 'Technical', result: 'didnt_happen', notes: "interviewer didn't join" });
    const umbPending = await round(umb, ago(8), { label: 'Technical', result: 'pending' });
    await ping(umb, 'round', umbPending, ago(2));
    await ping(umb, 'round', umbPending, ago(5));

    // Wayne Tech
    const wayne = await company('Wayne Tech', 'Backend Engineer');
    await recruiter(wayne, 'Sanjay Rao', '+91 90000 00002', 'sanjay@wayne.example');
    await db.runAsync(
      'INSERT INTO recruiter_call (id, company_id, call_at, mode, recruiter_name, said) VALUES (?,?,?,?,?,?)',
      [id('rc'), wayne, ago(4), 'phone', 'Sanjay Rao', 'will schedule the next step']);

    // Globex
    const globex = await company('Globex', 'Platform Engineer');
    await round(globex, ago(1), { type: 'walk_in', label: 'HR round', result: 'pending' });

    // Acme Corp
    const acme = await company('Acme Corp', 'Senior Backend Engineer');
    await recruiter(acme, 'Priya Sharma', '+91 90000 00000');
    await round(acme, ago(30), { type: 'phone', label: 'Recruiter screen', result: 'approved' });
    await round(acme, ago(23), { label: 'Technical', result: 'approved' });
    await round(acme, ago(16), { label: 'Managerial', result: 'approved' });
    const next = now + 2 * HOUR + 15 * MIN;
    await round(acme, next, { label: 'Final round', result: 'pending', endsAt: next + HOUR, link: MEET });

    // Initech (rejected after round 1)
    const initech = await company('Initech', 'Backend Developer', { status: 'rejected', afterRound: 1, rejectedAt: ago(20) + HOUR });
    await round(initech, ago(20), { label: 'Technical', result: 'rejected' });

    // Hooli (rejected after round 4)
    const hooli = await company('Hooli', 'Staff Engineer', { status: 'rejected', afterRound: 4, rejectedAt: ago(19) + HOUR });
    await round(hooli, ago(40), { type: 'phone', label: 'Recruiter screen', result: 'approved' });
    await round(hooli, ago(33), { label: 'Technical', result: 'approved' });
    await round(hooli, ago(26), { label: 'System design', result: 'approved' });
    await round(hooli, ago(19), { label: 'Final round', result: 'rejected' });
  });
  emitChange();
}
