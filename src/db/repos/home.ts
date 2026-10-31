import { getDb } from '../client';
import type { Bundle } from '../../types/entities';
import { loadBundles } from './bundles';
import { getSetting } from './settings';

export interface HomeData { bundles: Bundle[]; openReviews: number; lastSync: number | null }

/** Everything Home needs in one load; the cards never query on their own. */
export async function loadHomeData(): Promise<HomeData> {
  const db = await getDb();
  const [bundles, reviews, sync] = await Promise.all([
    loadBundles(),
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM review_item WHERE status='open'"),
    getSetting('last_sync'),
  ]);
  const lastSync = sync === null ? NaN : Number(sync);
  return { bundles, openReviews: reviews?.n ?? 0, lastSync: Number.isFinite(lastSync) ? lastSync : null };
}
