import { getDb } from '../client';
import { emitChange } from '../bus';
import { roundNumber, type Target } from '../../domain/rounds';
import type { Channel, Result } from '../../types/entities';
import { toRound, type RoundRow } from './bundles';

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

/** Notes card: saved on blur. Empty text is stored as NULL. */
export async function saveNotes(companyId: string, text: string, now = Date.now()) {
  const db = await getDb();
  await db.runAsync('UPDATE company SET notes=?, updated_at=? WHERE id=?', [text.trim() === '' ? null : text, now, companyId]);
  emitChange();
}
