import { getDb } from '../client';
import { emitChange } from '../bus';
import type { CalEvent } from '../../types/entities';

interface Row {
  event_id: string; calendar_id: string; title: string; starts_at: number; ends_at: number | null;
  organizer_email: string | null; meeting_link: string | null; phone: string | null;
}

/** D-E: there is no description column. Only the extracted link and phone are cached. */
export async function upsertEvent(ev: CalEvent, now: number) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO calendar_event (event_id, calendar_id, title, starts_at, ends_at, organizer_email, meeting_link, phone, last_seen_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(event_id) DO UPDATE SET calendar_id=excluded.calendar_id, title=excluded.title, starts_at=excluded.starts_at,
       ends_at=excluded.ends_at, organizer_email=excluded.organizer_email, meeting_link=excluded.meeting_link,
       phone=excluded.phone, last_seen_at=excluded.last_seen_at`,
    [ev.eventId, ev.calendarId, ev.title, ev.startsAt, ev.endsAt ?? null, ev.organizerEmail ?? null,
      ev.meetingLink ?? null, ev.phone ?? null, now],
  );
  emitChange();
}

/** Cached events of the given calendars only, so unticking a calendar never looks like mass cancellation. */
export async function storedEvents(calendarIds: string[]): Promise<Map<string, CalEvent>> {
  const out = new Map<string, CalEvent>();
  if (!calendarIds.length) return out;
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM calendar_event WHERE calendar_id IN (${calendarIds.map(() => '?').join(',')}) ORDER BY starts_at`,
    calendarIds,
  );
  for (const r of rows) {
    out.set(r.event_id, {
      eventId: r.event_id, calendarId: r.calendar_id, title: r.title, startsAt: r.starts_at,
      endsAt: r.ends_at ?? undefined, organizerEmail: r.organizer_email ?? undefined,
      meetingLink: r.meeting_link ?? undefined, phone: r.phone ?? undefined,
    });
  }
  return out;
}
