// Phase 7: read only. No diffing, matching or writes here; sync arrives in a later phase.
import { listEvents } from 'expo-calendar';
import { extract, keywordMatcher, stripHtml } from '../domain/extract';
import { readWindow } from '../domain/syncWindow';
import type { CalEvent } from '../types/entities';
import { safeHttps } from '../utils/links';
import { getCalendarAccess } from './permissions';

/** The fields of an expo-calendar event this app reads. Structural, so tests need no native module. */
export interface RawEvent {
  id: string; calendarId: string; title?: string | null; notes?: string | null; location?: string | null;
  startDate: string | Date; endDate: string | Date;
  organizerEmail?: string; // Android-only (UNVERIFIED on iOS); undefined there, so organizer matching just never fires
}

/**
 * Keyword on title or description, then pull out link and phone.
 * D-E: the description (notes) is read here and thrown away. Only the extracted link and phone are kept.
 */
export function toCalEvent(e: RawEvent, kw: (t: string) => boolean): CalEvent | null {
  const text = `${e.title ?? ''} ${e.notes ?? ''}`;
  if (!kw(stripHtml(text))) return null;
  const x = extract(`${text} ${e.location ?? ''}`);
  return {
    eventId: e.id, calendarId: e.calendarId, title: e.title ?? '',
    startsAt: +new Date(e.startDate), endsAt: +new Date(e.endDate),
    organizerEmail: e.organizerEmail?.toLowerCase(),
    meetingLink: safeHttps(x.link) ?? undefined, phone: x.phone,
  };
}

/**
 * Reads only the given (ticked) calendars. Returns [] without touching the calendar when nothing is ticked
 * or permission is missing (the UI shows the access card; this never prompts).
 */
export async function readEvents(
  calendarIds: string[], keywords: string[], lastSync: number | null, now = Date.now(),
): Promise<CalEvent[]> {
  if (!calendarIds.length) return [];
  if ((await getCalendarAccess()) !== 'granted') return [];
  const { from, to } = readWindow(now, lastSync);
  const kw = keywordMatcher(keywords);
  const raw = await listEvents(calendarIds, new Date(from), new Date(to));
  return raw.map(e => toCalEvent(e, kw)).filter((e): e is CalEvent => e !== null);
}
