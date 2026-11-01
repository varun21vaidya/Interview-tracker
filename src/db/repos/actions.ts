import { getDb } from '../client';
import { emitChange } from '../bus';
import { roundNumber, type Target } from '../../domain/rounds';
import type { Channel, Result, Round } from '../../types/entities';
import { toRound, type RoundRow } from './bundles';
import { cancelReminder, ensureNotificationPermission, syncCompanyReminders, syncReminder } from '../../services/notifications';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8); // local-only ids

/** Mark as pinged, Copy text, Open in Mail (decision 8). `target` comes from waitingTarget(). */
export async function markPinged(companyId: string, target: Target, channel: Channel, now = Date.now()) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO ping (id, company_id, target_type, target_id, pinged_at, channel) VALUES (?,?,?,?,?,?)',
    [uid(), companyId, target.type, target.id, now, channel]);
  emitChange();
}

export async function setResult(roundId: string, result: Result, now = Date.now()) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE round SET result=?, result_set_at=?, updated_at=? WHERE id=?', [result, now, now, roundId]);
    if (result !== 'rejected') return;
    const { company_id } = (await db.getFirstAsync<{ company_id: string }>('SELECT company_id FROM round WHERE id=?', [roundId]))!;
    const rs = (await db.getAllAsync<RoundRow>('SELECT * FROM round WHERE company_id=?', [company_id])).map(toRound);
    const n = roundNumber(rs.find(r => r.id === roundId)!, rs);          // stored so the label stays stable (R23)
    await db.runAsync(
      "UPDATE company SET status='rejected', rejected_reason='round', rejected_at=?, rejected_after_round=?, updated_at=? WHERE id=?",
      [now, n, now, company_id]);
  });
  emitChange();
}

export async function notMovingForward(companyId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync("UPDATE company SET status='rejected', rejected_reason='not_moving_forward', rejected_at=?, updated_at=? WHERE id=?", [now, now, companyId]);
  emitChange();
}

/** Reopen (decision 9): rounds and results stay; numbers are derived, so they renumber on their own. */
export async function reopenCompany(companyId: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync("UPDATE company SET status='active', rejected_reason=NULL, rejected_after_round=NULL, rejected_at=NULL, updated_at=? WHERE id=?", [now, companyId]);
  emitChange();
}

/** Move one round: its result and pings go with it; notes are on the round row already. */
export async function moveRound(roundId: string, toCompanyId: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE round SET company_id=? WHERE id=?', [toCompanyId, roundId]);
    await db.runAsync("UPDATE ping SET company_id=? WHERE target_type='round' AND target_id=?", [toCompanyId, roundId]);
  });
  emitChange();
}

/** Merge (decision 12): everything moves to the target, the source is deleted. */
export async function mergeCompanies(sourceId: string, targetId: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of ['round', 'recruiter_call', 'ping'])
      await db.runAsync(`UPDATE ${t} SET company_id=? WHERE company_id=?`, [targetId, sourceId]);  // t is a constant
    await db.runAsync('UPDATE OR IGNORE alias SET company_id=? WHERE company_id=?', [targetId, sourceId]);
    await db.runAsync('UPDATE OR IGNORE recruiter SET company_id=? WHERE company_id=?', [targetId, sourceId]); // target's own wins
    await db.runAsync(
      `UPDATE company SET
         notes = NULLIF(trim(COALESCE(notes,'') || char(10) || COALESCE((SELECT notes FROM company WHERE id=?),'')), ''),
         jd_text = COALESCE(jd_text, (SELECT jd_text FROM company WHERE id=?))
       WHERE id=?`, [sourceId, sourceId, targetId]);
    await db.runAsync('DELETE FROM company WHERE id=?', [sourceId]);   // cascades leftover alias/recruiter rows
  });
  emitChange();
}

/** Rename. Names are unique case-insensitively (D10), so a clash must be a merge instead. */
export async function renameCompany(companyId: string, name: string, now = Date.now()) {
  const n = name.trim();
  if (n.length < 1 || n.length > 200) throw new Error('Enter a name of 1 to 200 characters.');
  const db = await getDb();
  const clash = await db.getFirstAsync<{ id: string }>('SELECT id FROM company WHERE lower(name)=lower(?) AND id<>? LIMIT 1', [n, companyId]);
  if (clash) throw new Error('Another company already has this name. Use Merge instead.');
  await db.runAsync('UPDATE company SET name=?, updated_at=? WHERE id=?', [n, now, companyId]);
  emitChange();
  await syncCompanyReminders(companyId);   // notification text carries the company name; never throws on its own
}

/** Notes card: saved on blur. Empty text is stored as NULL. */
export async function saveNotes(companyId: string, text: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync('UPDATE company SET notes=?, updated_at=? WHERE id=?', [text.trim() === '' ? null : text, now, companyId]);
  emitChange();
}

// ---- Add interview (Phase 5) ----

export interface NewCompanyFields { company: string; role?: string; recruiterName?: string; recruiterPhone?: string }
export interface RoundFields {
  type: Round['type']; label: string; startsAt: number;
  locationOrLink?: string; contactName?: string; contactPhone?: string; notes?: string;
}
const nul = (s?: string) => (s && s.trim() !== '' ? s.trim() : null);

type Db = Awaited<ReturnType<typeof getDb>>;

/** Case-insensitive exact name reuses the company, otherwise create one (D10: a second role needs a different name). */
async function findOrCreateCompany(db: Db, f: NewCompanyFields, now: number): Promise<string> {
  const name = f.company.trim();
  const hit = await db.getFirstAsync<{ id: string }>('SELECT id FROM company WHERE lower(name)=lower(?) LIMIT 1', [name]);
  let id: string;
  if (hit) {
    id = hit.id;
    if (nul(f.role)) await db.runAsync('UPDATE company SET role=COALESCE(role,?), updated_at=? WHERE id=?', [nul(f.role), now, id]);
  } else {
    id = uid();
    await db.runAsync("INSERT INTO company (id, name, role, status, created_at, updated_at) VALUES (?,?,?,'active',?,?)", [id, name, nul(f.role), now, now]);
  }
  if (nul(f.recruiterName) || nul(f.recruiterPhone)) {   // blank fields never wipe saved values
    await db.runAsync(
      `INSERT INTO recruiter (company_id, name, phone) VALUES (?,?,?)
       ON CONFLICT(company_id) DO UPDATE SET name=COALESCE(excluded.name, name), phone=COALESCE(excluded.phone, phone)`,
      [id, nul(f.recruiterName), nul(f.recruiterPhone)]);
  }
  return id;
}

/** New manual round: source 'manual', order_at = starts_at (D-A). Returns the company id. */
export async function addRound(c: NewCompanyFields, r: RoundFields, now = Date.now()): Promise<string> {
  const db = await getDb();
  let companyId = '';
  const roundId = uid();
  await db.withTransactionAsync(async () => {
    companyId = await findOrCreateCompany(db, c, now);
    await db.runAsync(
      `INSERT INTO round (id, company_id, source, type, label, starts_at, order_at, location_or_link, contact_name, contact_phone, notes, created_at, updated_at)
       VALUES (?,?,'manual',?,?,?,?,?,?,?,?,?,?)`,
      [roundId, companyId, r.type, r.label, r.startsAt, r.startsAt, nul(r.locationOrLink), nul(r.contactName), nul(r.contactPhone), nul(r.notes), now, now]);
  });
  emitChange();
  // First manual round asks for notification permission (the OS only prompts while undecided). Failures never block the save.
  try { await ensureNotificationPermission(true); } catch (e) { console.warn('notification permission', e); }
  await syncReminder(roundId, now);
  return companyId;
}

/** Recruiter call is a timeline entry, not a round (D2). */
export async function addRecruiterCall(c: NewCompanyFields, call: { callAt: number; said?: string }, now = Date.now()): Promise<string> {
  const db = await getDb();
  let companyId = '';
  await db.withTransactionAsync(async () => {
    companyId = await findOrCreateCompany(db, c, now);
    await db.runAsync(
      'INSERT INTO recruiter_call (id, company_id, call_at, mode, recruiter_name, recruiter_phone, said) VALUES (?,?,?,?,?,?,?)',
      [uid(), companyId, call.callAt, 'phone', nul(c.recruiterName), nul(c.recruiterPhone), nul(call.said)]);
  });
  emitChange();
  return companyId;
}

/** Manual rounds only. Keeps order_at in step unless the user had placed it by hand. */
export async function updateRound(roundId: string, r: RoundFields, now = Date.now()) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE round SET type=?, label=?, order_at = CASE WHEN order_at = starts_at THEN ? ELSE order_at END, starts_at=?,
       location_or_link=?, contact_name=?, contact_phone=?, notes=?, updated_at=?
     WHERE id=? AND source='manual'`,
    [r.type, r.label, r.startsAt, r.startsAt, nul(r.locationOrLink), nul(r.contactName), nul(r.contactPhone), nul(r.notes), now, roundId]);
  emitChange();
  await syncReminder(roundId, now);
}

/** Manual rounds only. The ping_del_round trigger removes the round's pings. */
export async function deleteRound(roundId: string) {
  const db = await getDb();
  // Cancel first: deleting the round cascades the notification_map row away.
  try { await cancelReminder(roundId); } catch (e) { console.warn('reminder not cancelled', e); }
  await db.runAsync("DELETE FROM round WHERE id=? AND source='manual'", [roundId]);
  emitChange();
}

export interface RoundEdit extends RoundFields { companyName: string; role?: string }
/** Loads a manual round plus its company for the edit form. Null for calendar rounds or missing ids. */
export async function loadRoundForEdit(roundId: string): Promise<RoundEdit | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{
    type: Round['type']; label: string; starts_at: number; location_or_link: string | null;
    contact_name: string | null; contact_phone: string | null; notes: string | null; name: string; role: string | null;
  }>(`SELECT r.type, r.label, r.starts_at, r.location_or_link, r.contact_name, r.contact_phone, r.notes, c.name, c.role
      FROM round r JOIN company c ON c.id = r.company_id WHERE r.id=? AND r.source='manual'`, [roundId]);
  if (!r) return null;
  return {
    type: r.type, label: r.label, startsAt: r.starts_at, locationOrLink: r.location_or_link ?? undefined,
    contactName: r.contact_name ?? undefined, contactPhone: r.contact_phone ?? undefined, notes: r.notes ?? undefined,
    companyName: r.name, role: r.role ?? undefined,
  };
}
