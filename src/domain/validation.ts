/** Add interview form validation. Pure; no I/O. */
export type AddKind = 'walk_in' | 'offline' | 'phone' | 'online' | 'recruiter_call';

export interface AddForm {
  kind: AddKind;
  company: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM, optional
}
export type FormErrors = Partial<Record<'company' | 'date' | 'time', string>>;

/** Assumption: a round saved without a time starts at 09:00 local. */
export const DEFAULT_HOUR = 9;

/** Parses real calendar dates only (rejects 2026-02-30). Returns local ms or null. */
export function parseStart(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!d) return null;
  const [y, mo, da] = [+d[1], +d[2], +d[3]];
  let h = DEFAULT_HOUR, mi = 0;
  if (time.trim() !== '') {
    const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!t) return null;
    h = +t[1]; mi = +t[2];
    if (h > 23 || mi > 59) return null;
  }
  const dt = new Date(y, mo - 1, da, h, mi);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null;
  return dt.getTime();
}

/** Company and date are required; time is optional but must be valid when given. */
export function validateAdd(f: AddForm): FormErrors {
  const e: FormErrors = {};
  const name = f.company.trim();
  if (!name) e.company = 'Company is required';
  else if (name.length > 200) e.company = 'Company name is too long';
  if (!f.date.trim()) e.date = 'Date is required';
  else if (/^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date.trim()) === null || parseStart(f.date, '') === null) e.date = 'Use YYYY-MM-DD';
  if (f.time.trim() !== '' && !e.date && parseStart(f.date, f.time) === null) e.time = 'Use HH:MM (24-hour)';
  return e;
}

/** Empty round name means the default 'Interview'. */
export const roundLabel = (s: string) => s.trim() || 'Interview';
