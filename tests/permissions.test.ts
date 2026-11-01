import { PermissionsAndroid, Platform } from 'react-native';
import { getCalendarAccess, requestCalendarAccess } from '../src/services/permissions';

const mockExpoGet = jest.fn();
const mockExpoRequest = jest.fn();
jest.mock('expo-calendar', () => ({
  getCalendarPermissions: (...a: unknown[]) => mockExpoGet(...a),
  requestCalendarPermissions: (...a: unknown[]) => mockExpoRequest(...a),
}));

describe('calendar access on Android (WRITE_CALENDAR is blocked, so only READ counts)', () => {
  const original = Platform.OS;
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' }); });
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original }); });
  afterEach(() => { jest.restoreAllMocks(); mockExpoGet.mockReset(); mockExpoRequest.mockReset(); });

  it('reports granted from READ_CALENDAR alone, without the combined expo check', async () => {
    const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    expect(await getCalendarAccess()).toBe('granted');
    expect(check).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.READ_CALENDAR);
    expect(mockExpoGet).not.toHaveBeenCalled();
  });

  it('reports ask when READ_CALENDAR is not granted', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    expect(await getCalendarAccess()).toBe('ask');
  });

  it.each([
    [PermissionsAndroid.RESULTS.GRANTED, 'granted'],
    [PermissionsAndroid.RESULTS.DENIED, 'ask'],
    [PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN, 'blocked'],
  ])('maps a prompt result of %s to %s, asking only for READ', async (result, expected) => {
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(result);
    expect(await requestCalendarAccess()).toBe(expected);
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.READ_CALENDAR);
    expect(mockExpoRequest).not.toHaveBeenCalled();
  });
});
