import { getDb } from '../client';
import { emitChange } from '../bus';
import { prepareJd } from '../../domain/jd';

export interface JdRecord { name: string; role?: string; text: string; link?: string; words: number }

interface Row { name: string; role: string | null; jd_text: string | null; jd_link: string | null; jd_words: number | null }

/** Full text. Only the two JD screens call this; everything else reads jd_preview (P1a). */
export async function loadJd(companyId: string): Promise<JdRecord | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>('SELECT name, role, jd_text, jd_link, jd_words FROM company WHERE id=?', [companyId]);
  if (!r) return null;
  return { name: r.name, role: r.role ?? undefined, text: r.jd_text ?? '', link: r.jd_link ?? undefined, words: r.jd_words ?? 0 };
}

/** Writes jd_text, jd_link and jd_words together; the word count is always recomputed from the text. */
export async function saveJd(companyId: string, text: string, link: string, now = Date.now()) {
  const { value, error } = prepareJd(text, link);
  if (error) throw new Error(error);
  const db = await getDb();
  await db.runAsync('UPDATE company SET jd_text=?, jd_link=?, jd_words=?, updated_at=? WHERE id=?',
    [value.text, value.link, value.words, now, companyId]);
  emitChange();
}
