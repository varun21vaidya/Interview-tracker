import {
  assertSize, buildSummary, countsText, MAX_BYTES, parseBackup, parseSettings, SCHEMA_VERSION, UNENCRYPTED_NOTE,
} from '../src/domain/backup';

const company = { id: 'c1', name: 'Umbrella', role: 'SRE', status: 'active', rejected_reason: null, rejected_after_round: null, rejected_at: null,
  jd_text: 'one two three', jd_words: 999, jd_link: 'https://x.test/job', notes: null, created_at: 1, updated_at: 2 };
const round = { id: 'r1', company_id: 'c1', source: 'calendar', calendar_event_id: 'evt', type: 'online', label: 'Technical', starts_at: 1000, ends_at: null,
  order_at: 1000, location_or_link: null, contact_name: null, contact_phone: null, notes: null, result: 'pending', result_set_at: null,
  change_flag: 'moved', pending_starts_at: 5, auto_added_at: 7, created_at: 1, updated_at: 2 };
const valid = (): any => ({
  schemaVersion: 1,
  company: [{ ...company }], round: [{ ...round }],
  ping: [{ id: 'p1', company_id: 'c1', target_type: 'round', target_id: 'r1', pinged_at: 3, channel: 'copy' }],
  recruiter: [{ company_id: 'c1', name: 'Asha', phone: '+91 1', email: 'a@b.co' }],
  recruiter_call: [{ id: 'k1', company_id: 'c1', call_at: 9, mode: 'phone', recruiter_name: 'Asha', recruiter_phone: null, said: 'hi' }],
  alias: [{ id: 'a1', type: 'organizer', pattern: 'hr@umbrella.test', company_id: 'c1' }],
});
const parse = (o: unknown) => parseBackup(JSON.stringify(o));
const mutate = (f: (b: any) => void) => { const b = valid(); f(b); return b; };

describe('parseBackup accepts a good file', () => {
  it('keeps recruiter, recruiter_call and alias (not silently dropped)', () => {
    const b = parse(valid());
    expect(b.recruiter).toHaveLength(1);
    expect(b.recruiter_call[0]).toMatchObject({ id: 'k1', said: 'hi', mode: 'phone' });
    expect(b.alias[0]).toMatchObject({ type: 'organizer', pattern: 'hr@umbrella.test' });
    expect(b.ping).toHaveLength(1);
  });
  it('recomputes jd_words from jd_text, ignoring the file', () => {
    expect(parse(valid()).company[0].jd_words).toBe(3);
    expect(parse(mutate(b => { b.company[0].jd_text = '   '; })).company[0].jd_words).toBeNull();
    expect(parse(mutate(b => { b.company[0].jd_text = null; })).company[0].jd_words).toBeNull();
  });
  it('turns calendar rounds into manual ones and drops device-specific fields (D-F)', () => {
    expect(parse(valid()).round[0]).toMatchObject({ source: 'manual', calendar_event_id: null, change_flag: null, pending_starts_at: null, auto_added_at: null });
  });
  it('drops unknown keys', () => {
    const b = mutate(x => { x.company[0].evil = 'x'; });
    expect(Object.keys(parse(b).company[0])).not.toContain('evil');
  });
});

describe('parseBackup rejects', () => {
  it('a wrong or missing version', () => {
    expect(() => parse({ ...valid(), schemaVersion: 2 })).toThrow('unsupported version');
    expect(() => parse({ ...valid(), schemaVersion: '1' })).toThrow('unsupported version');
    const { schemaVersion, ...rest } = valid();
    expect(() => parse(rest)).toThrow('unsupported version');
  });
  it('a string where a number is expected', () => {
    expect(() => parse(mutate(b => { b.company[0].created_at = '1'; }))).toThrow('whole number');
    expect(() => parse(mutate(b => { b.round[0].order_at = '1000'; }))).toThrow('number expected');
    expect(() => parse(mutate(b => { b.recruiter_call[0].call_at = '9'; }))).toThrow('whole number');
  });
  it('an http:// link (and other schemes)', () => {
    expect(() => parse(mutate(b => { b.company[0].jd_link = 'http://x.test/job'; }))).toThrow('https');
    expect(() => parse(mutate(b => { b.company[0].jd_link = 'javascript:alert(1)'; }))).toThrow('https');
  });
  it('an unknown enum value, in every table that has one', () => {
    expect(() => parse(mutate(b => { b.company[0].status = 'archived'; }))).toThrow('unknown value');
    expect(() => parse(mutate(b => { b.round[0].type = 'zoom'; }))).toThrow('unknown value');
    expect(() => parse(mutate(b => { b.round[0].result = 'maybe'; }))).toThrow('unknown value');
    expect(() => parse(mutate(b => { b.ping[0].channel = 'sms'; }))).toThrow('unknown value');
    expect(() => parse(mutate(b => { b.alias[0].type = 'domain'; }))).toThrow('unknown value');
  });
  it('an oversized file', () => {
    expect(() => parseBackup(' '.repeat(MAX_BYTES + 1))).toThrow('file too large');
    expect(() => assertSize(MAX_BYTES + 1)).toThrow('file too large');
    expect(() => assertSize(MAX_BYTES)).not.toThrow();
    expect(() => assertSize(null)).toThrow('file size');
  });
  it('text that is not JSON, or not an object', () => {
    expect(() => parseBackup('not json')).toThrow('Invalid backup: not a JSON file');
    expect(() => parseBackup('[]')).toThrow('Invalid backup');
    expect(() => parseBackup('null')).toThrow('Invalid backup');
  });
  it('a missing table, an empty name, an oversized field', () => {
    const { alias, ...rest } = valid();
    expect(() => parse(rest)).toThrow('alias list');
    expect(() => parse(mutate(b => { b.company[0].name = ''; }))).toThrow('text expected');
    expect(() => parse(mutate(b => { b.company[0].name = 'x'.repeat(201); }))).toThrow('text expected');
    expect(() => parse(mutate(b => { b.alias[0].pattern = ''; }))).toThrow('text expected');
  });
});

describe('parseSettings', () => {
  it('accepts valid settings and an absent block', () => {
    expect(parseSettings(undefined)).toEqual({});
    expect(parseSettings({ signature: 'Thanks', keywords: ['HR', 'round'], reminder_minutes: 1440 }))
      .toEqual({ signature: 'Thanks', keywords: ['HR', 'round'], reminder_minutes: 1440 });
    expect(parse({ ...valid(), settings: { reminder_minutes: 15 } }).settings).toEqual({ reminder_minutes: 15 });
  });
  it('rejects a reminder that is not 15, 60 or 1440', () => {
    for (const bad of [30, 0, '60', -15, 1e9]) expect(() => parseSettings({ reminder_minutes: bad })).toThrow('reminder');
  });
  it('rejects keywords that are not an array of short strings', () => {
    expect(() => parseSettings({ keywords: 'HR' })).toThrow('keywords');
    expect(() => parseSettings({ keywords: ['ok', 5] })).toThrow('text expected');
    expect(() => parseSettings({ keywords: [''] })).toThrow('text expected');
    expect(() => parseSettings({ keywords: ['x'.repeat(41)] })).toThrow('text expected');
    expect(() => parseSettings({ keywords: Array(101).fill('a') })).toThrow('keywords');
  });
  it('rejects a signature of the wrong type or length', () => {
    expect(() => parseSettings({ signature: 5 })).toThrow('text expected');
    expect(() => parseSettings({ signature: 'x'.repeat(5001) })).toThrow('text expected');
    expect(() => parseSettings('nope')).toThrow('settings');
  });
});

describe('summary and round trip', () => {
  it('says the file is unencrypted and lists counts and rounds', () => {
    const b = parse(valid());
    const text = buildSummary(b, Date.UTC(2026, 10, 1));
    expect(text).toContain(UNENCRYPTED_NOTE);
    expect(text).toContain('NOT encrypted');
    expect(text).toContain('Umbrella (SRE) - active');
    expect(text).toContain('Technical');
    expect(countsText(b)).toBe('1 company, 1 round, 1 recruiter call, 1 follow-up');
  });
  it('export then import keeps all data (canonical form is stable)', () => {
    const first = parse(valid());
    const again = parseBackup(JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: 1, ...first }));
    expect(again).toEqual(first);
  });
});
