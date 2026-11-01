jest.mock('expo-calendar', () => ({ listEvents: jest.fn() }));
jest.mock('../src/db/client', () => ({ getDb: jest.fn() }));
jest.mock('../src/db/repos/settings', () => ({
  getCalendarIds: jest.fn().mockResolvedValue([]), getKeywords: jest.fn(), getLastSync: jest.fn(), writeSetting: jest.fn(),
}));
jest.mock('../src/services/permissions', () => ({ getCalendarAccess: jest.fn() }));

import { requestSync, withSyncPaused } from '../src/services/calendarSync';

describe('withSyncPaused', () => {
  it('skips syncs requested while the job runs, then allows them again', async () => {
    let during: unknown;
    await withSyncPaused(async () => { during = await requestSync({ force: true }); });
    expect(during).toEqual({ status: 'skipped', reason: 'paused' });
    const after = await requestSync({ force: true });
    expect(after).toEqual({ status: 'skipped', reason: 'no-calendars' });
  });

  it('resumes even when the job throws', async () => {
    await expect(withSyncPaused(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await requestSync({ force: true })).toEqual({ status: 'skipped', reason: 'no-calendars' });
  });
});
