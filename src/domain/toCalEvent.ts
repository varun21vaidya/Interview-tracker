import type { CalEvent } from '../types/entities';
import { safeHttps } from '../utils/links';
import { extract, isPersonEmail, stripHtml } from './extract';

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
  // The calendar's organizer, unless it is missing or a system address (a group, a no-reply): then the first person's address in the text.
  const fromCalendar = e.organizerEmail?.toLowerCase();
  const organizer = fromCalendar && isPersonEmail(fromCalendar) ? fromCalendar : x.contactEmail ?? fromCalendar;
  return {
    eventId: e.id, calendarId: e.calendarId, title: e.title ?? '',
    startsAt: +new Date(e.startDate), endsAt: +new Date(e.endDate),
    organizerEmail: organizer,
    meetingLink: safeHttps(x.link) ?? undefined, phone: x.phone,
  };
}

/**
 * Reads only the given (ticked) calendars. Returns [] without touching the calendar when nothing is ticked
 * or permission is missing (the UI shows the access card; this never prompts).
 */
