import { getDb } from '../client';
import type { Bundle, Company, Ping, Recruiter, RecruiterCall, Round } from '../../types/entities';

type N<T> = T | null;
interface CompanyRow {
  id: string; name: string; role: N<string>; status: 'active' | 'rejected';
  rejected_reason: N<'round' | 'not_moving_forward'>; rejected_after_round: N<number>;
  jd_preview: N<string>; jd_words: N<number>; jd_link: N<string>; notes: N<string>;
}
interface RecruiterRow { company_id: string; name: N<string>; phone: N<string>; email: N<string> }
export interface RoundRow {
  id: string; company_id: string; source: Round['source']; calendar_event_id: N<string>;
  type: Round['type']; label: string; starts_at: number; ends_at: N<number>; order_at: number; location_or_link: N<string>;
  result: Round['result']; change_flag: N<'moved' | 'cancelled'>; pending_starts_at: N<number>; auto_added_at: N<number>; notes: N<string>;
}
interface CallRow { id: string; company_id: string; call_at: number; recruiter_name: N<string>; said: N<string> }
interface PingRow {
  id: string; company_id: string; target_type: Ping['targetType']; target_id: string;
  pinged_at: number; channel: Ping['channel'];
}

const u = <T>(v: N<T>): T | undefined => v ?? undefined;

const toCompany = (r: CompanyRow): Company => ({
  id: r.id, name: r.name, role: u(r.role), status: r.status,
  rejectedReason: u(r.rejected_reason), rejectedAfterRound: u(r.rejected_after_round),
  jdPreview: u(r.jd_preview), jdWords: u(r.jd_words), jdLink: u(r.jd_link), notes: u(r.notes),
});
const toRecruiter = (r: RecruiterRow): Recruiter => ({
  companyId: r.company_id, name: u(r.name), phone: u(r.phone), email: u(r.email),
});
export const toRound = (r: RoundRow): Round => ({
  id: r.id, companyId: r.company_id, source: r.source, calendarEventId: u(r.calendar_event_id),
  type: r.type, label: r.label, startsAt: r.starts_at, endsAt: u(r.ends_at), orderAt: r.order_at, locationOrLink: u(r.location_or_link),
  result: r.result, changeFlag: u(r.change_flag), pendingStartsAt: u(r.pending_starts_at), autoAddedAt: u(r.auto_added_at), note: u(r.notes),
});
const toCall = (r: CallRow): RecruiterCall => ({
  id: r.id, companyId: r.company_id, callAt: r.call_at, recruiterName: u(r.recruiter_name), said: u(r.said),
});
const toPing = (r: PingRow): Ping => ({
  id: r.id, companyId: r.company_id, targetType: r.target_type, targetId: r.target_id,
  pingedAt: r.pinged_at, channel: r.channel,
});

function group<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r), a = m.get(k); a ? a.push(r) : m.set(k, [r]); }
  return m;
}

/** One company's bundle, or null when the id does not exist (deleted or merged away). */
export async function loadBundle(companyId: string): Promise<Bundle | null> {
  const db = await getDb();
  const [c, rec, rs, calls, ps] = await Promise.all([
    db.getFirstAsync<CompanyRow>(
      `SELECT id, name, role, status, rejected_reason, rejected_after_round, jd_words, jd_link, notes,
              substr(jd_text,1,300) AS jd_preview
       FROM company WHERE id=?`, [companyId]),
    db.getFirstAsync<RecruiterRow>('SELECT * FROM recruiter WHERE company_id=?', [companyId]),
    db.getAllAsync<RoundRow>('SELECT * FROM round WHERE company_id=?', [companyId]),
    db.getAllAsync<CallRow>('SELECT * FROM recruiter_call WHERE company_id=?', [companyId]),
    db.getAllAsync<PingRow>('SELECT * FROM ping WHERE company_id=?', [companyId]),
  ]);
  if (!c) return null;
  return {
    company: toCompany(c), recruiter: rec ? toRecruiter(rec) : undefined,
    rounds: rs.map(toRound), calls: calls.map(toCall), pings: ps.map(toPing),
  };
}

export async function loadBundles(): Promise<Bundle[]> {
  const db = await getDb();
  const [cs, rec, rs, calls, ps] = await Promise.all([
    db.getAllAsync<CompanyRow>(
      `SELECT id, name, role, status, rejected_reason, rejected_after_round, jd_words, jd_link, notes,
              substr(jd_text,1,300) AS jd_preview
       FROM company`),
    db.getAllAsync<RecruiterRow>('SELECT * FROM recruiter'),
    db.getAllAsync<RoundRow>('SELECT * FROM round'),
    db.getAllAsync<CallRow>('SELECT * FROM recruiter_call'),
    db.getAllAsync<PingRow>('SELECT * FROM ping'),
  ]);
  const R = group(rs, r => r.company_id), C = group(calls, r => r.company_id), P = group(ps, r => r.company_id);
  const rc = new Map(rec.map(r => [r.company_id, toRecruiter(r)]));
  return cs.map(c => ({
    company: toCompany(c), recruiter: rc.get(c.id),
    rounds: (R.get(c.id) ?? []).map(toRound), calls: (C.get(c.id) ?? []).map(toCall), pings: (P.get(c.id) ?? []).map(toPing),
  }));
}
