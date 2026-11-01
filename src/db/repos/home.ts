import { getDb } from '../client';
import type { Bundle } from '../../types/entities';
import { loadBundles } from './bundles';
import { getSetting } from './settings';
import { loadAutoAdded } from './sync';
import type { AutoAdded } from '../../domain/syncRules';

export interface HomeData { bundles: Bundle[]; openReviews: number; lastSync: number | null; autoAdded: AutoAdded[] }

/** Everything Home needs in one load; the cards never query on their own. */
export async function loadHomeData(): Promise<HomeData> {
  const db = await getDb();
  const [bundles, reviews, sync, autoAdded] = await Promise.all([
    loadBundles(),
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM review_item WHERE status='open'"),
    getSetting('last_sync'),
    loadAutoAdded(),
  ]);
  const lastSync = sync === null ? NaN : Number(sync);
  return { bundles, openReviews: reviews?.n ?? 0, lastSync: Number.isFinite(lastSync) ? lastSync : null, autoAdded };
}
