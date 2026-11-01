import type { CalEvent } from '../types/entities';

export type Change =
  | { kind: 'new'; ev: CalEvent } | { kind: 'moved'; ev: CalEvent }
  | { kind: 'link'; ev: CalEvent } | { kind: 'cancelled'; eventId: string };
export interface Ignored { startsAt: number; organizerEmail?: string }

export function diffEvents(
  fresh: CalEvent[], stored: Map<string, CalEvent>, ignored: Map<string, Ignored>,
  win: { from: number; to: number },
): Change[] {
  const out: Change[] = [], seen = new Set<string>();
  for (const ev of fresh) {
    seen.add(ev.eventId);
    const ig = ignored.get(ev.eventId);
    if (ig) {                                            // hidden unless time or organizer changed
      if (ig.startsAt !== ev.startsAt || ig.organizerEmail !== ev.organizerEmail) out.push({ kind: 'new', ev });
      continue;
    }
    const old = stored.get(ev.eventId);
    if (!old) out.push({ kind: 'new', ev });
    else if (old.startsAt !== ev.startsAt) out.push({ kind: 'moved', ev });
    else if (old.meetingLink !== ev.meetingLink) out.push({ kind: 'link', ev });
  }
  for (const [id, old] of stored)                        // missing inside the window = cancelled
    if (!seen.has(id) && !ignored.has(id) && old.startsAt >= win.from && old.startsAt <= win.to)
      out.push({ kind: 'cancelled', eventId: id });
  return out;
}
