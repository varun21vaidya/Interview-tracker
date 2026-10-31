// Migration 001. PRAGMA foreign_keys = ON is set in client.ts on every open.
export const M001 = `
CREATE TABLE company (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  role TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rejected')),
  rejected_reason TEXT CHECK (rejected_reason IN ('round','not_moving_forward')),
  rejected_after_round INTEGER,
  rejected_at INTEGER,
  jd_text TEXT, jd_words INTEGER, jd_link TEXT, notes TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE recruiter (
  company_id TEXT PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
  name TEXT, phone TEXT, email TEXT
);

CREATE TABLE recruiter_call (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  call_at INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'phone',
  recruiter_name TEXT, recruiter_phone TEXT, said TEXT
);

CREATE TABLE calendar_event (
  event_id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL, ends_at INTEGER,
  organizer_email TEXT, meeting_link TEXT, phone TEXT,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE round (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual','calendar')),
  calendar_event_id TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('walk_in','offline','phone','online')),
  label TEXT NOT NULL DEFAULT 'Interview',
  starts_at INTEGER NOT NULL, ends_at INTEGER,
  order_at REAL NOT NULL,
  location_or_link TEXT, contact_name TEXT, contact_phone TEXT, notes TEXT,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending','approved','rejected','didnt_happen')),
  result_set_at INTEGER,
  change_flag TEXT CHECK (change_flag IN ('moved','cancelled')),
  pending_starts_at INTEGER,
  auto_added_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_round_company ON round(company_id, order_at);

CREATE TABLE review_item (
  event_id TEXT PRIMARY KEY REFERENCES calendar_event(event_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open','decided','dismissed')),
  ranked_company_ids TEXT NOT NULL DEFAULT '[]',
  suggested_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE ignored_event (
  event_id TEXT PRIMARY KEY,
  starts_at INTEGER NOT NULL,
  organizer_email TEXT
);

CREATE TABLE ping (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('round','recruiter_call')),
  target_id TEXT NOT NULL,
  pinged_at INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('mark','copy','mail'))
);
CREATE INDEX idx_ping_target ON ping(target_type, target_id);
CREATE TRIGGER ping_del_round AFTER DELETE ON round
  BEGIN DELETE FROM ping WHERE target_type='round' AND target_id=OLD.id; END;
CREATE TRIGGER ping_del_call AFTER DELETE ON recruiter_call
  BEGIN DELETE FROM ping WHERE target_type='recruiter_call' AND target_id=OLD.id; END;

CREATE TABLE alias (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('organizer','title')),
  pattern TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  UNIQUE (type, pattern)
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE notification_map (
  round_id TEXT PRIMARY KEY REFERENCES round(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL
);
`;
