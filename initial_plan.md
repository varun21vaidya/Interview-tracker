# Interview Tracker: Final Plan

This plan uses your answers. Items marked **ASSUMPTION** are my choices where the spec and your answers left a gap. Review those first.

---

## 0. Decision log

| Topic | Decision | Source |
|---|---|---|
| Didn't happen rounds | Get no round number. Numbering skips them. | Your answer |
| Recruiter call | Timeline entry on the company, not a round. Becomes Round 1 when the invite arrives. | Your answer |
| Pending on Home | Always under "Waiting for result". Globex moves there. | Your answer |
| Stark / new companies | New company from a calendar event goes to Needs review until you confirm. | Your answer |
| Which company? pre-selection | Nothing pre-selected. | Your answer |
| Ping sources | "Copy text" and "Open in Mail" both count. | Your answer |
| Today's round with no result | No ping bubble. Company stays Active. | Your answer |
| Next card | Shows the soonest interview. Other upcoming ones are listed below it. | Your answer |
| Reopen | Rounds renumber. Old results are kept. | Your answer |
| Backup | One JSON file with a version field, plus a readable text summary. | Your answer |
| "Not an interview" | Event stays hidden unless its time or organizer changes. | Your answer |
| Merge | Moves all rounds, pings, and notes into the target. Deletes the source. | Your answer |
| Rejected with no rounds | Row says "Recruiter call only, not moving forward". | Your answer |
| Multiple roles, same company | Separate companies. | Your answer |
| Install | Personal use first (EAS preview build), Play Store later. | Your answer |
| Your level | Knows TypeScript, new to React Native. Plan explains RN concepts as they come up. | Your answer |
| Your time | Under 5 hours a week. Timeline is calculated for that. | Your answer |
| Your device | Android 12 or newer. Can test on real phone. | Your answer |

---

## 1. High-level design (HLD)

### 1.1 System context

```
          ┌──────────────────────── Android phone ────────────────────────┐
          │                                                                │
          │   Interview Tracker (Expo / React Native / TypeScript)          │
          │   ├── UI (screens, components)                                 │
          │   ├── Domain (pure logic: numbering, ping, matching, diff)     │
          │   ├── Repositories ──► SQLite (expo-sqlite, on device)         │
          │   ├── Calendar reader ◄── device calendars (expo-calendar,    │
          │   │                       READ only, Job search calendar)     │
          │   ├── Notifications ──► local alerts (expo-notifications)     │
          │   ├── Links ──► tel:, mailto:, maps, meeting links (expo-linking)│
          │   ├── Clipboard (expo-clipboard)                               │
          │   └── Backup ──► file export/import (expo-file-system,         │
          │                   expo-sharing, expo-document-picker)          │
          │                                                                │
          └────────────────────────────────────────────────────────────────┘
                 No server. No login. No network calls for app data.
```

### 1.2 Modules

| Module | Responsibility | Depends on |
|---|---|---|
| **Calendar ingestion** | Reads events from selected calendars in a date window, filters by keywords, returns normalised events | expo-calendar |
| **Extraction** | Regex and rule-based extraction: meeting links, phone numbers, emails, company guess | none (pure) |
| **Matching engine** | Scores an event against companies using aliases, recruiter domain, organizer, title pattern. Decides attach vs Needs review | Extraction, repositories |
| **Calendar diff** | Compares a fresh read with stored events. Outputs new, moved, cancelled, and changed-link | repositories |
| **Round numbering** | Derives round numbers by date, skipping didn't-happen | pure |
| **Result and ping state** | Derives Pending, Ping, Awaiting schedule, Rejected, Waiting, Previous from stored data | pure |
| **Companies** | CRUD, Rejected/Active status, reopen, merge, rename | repositories |
| **Rounds** | Manual CRUD, calendar round acknowledgement, move to another company | repositories |
| **Notifications** | Schedules 1 hour before manual rounds. Reschedules on edit, cancels on delete | expo-notifications |
| **Follow-up email** | Builds three templates from tracker data plus signature. Hands off to clipboard or mail app | pure + expo-linking |
| **Job description store** | Saves text and link. Builds preview, word count, and section chips | pure |
| **Backup** | Export JSON + text summary. Import with validation | repositories, file APIs |
| **Settings** | Calendar selection, keywords, signature, reminder minutes | repositories |

### 1.3 Navigation

**Tabs (bottom bar):** Home, Companies, Settings.

**Stack screens (pushed):**

| Route | Screen | Opened from |
|---|---|---|
| `/add` | Add interview | + Add interview pill |
| `/company/[id]` | Company detail | Companies row, Home card, banner |
| `/company/[id]/follow-up?template=` | Follow-up email | Email follow-up button |
| `/company/[id]/jd` | Full job description | Full-screen icon |
| `/company/[id]/jd/edit` | Edit job description | Edit icon |
| `/review/[eventId]` | Which company? | Amber banner, Needs review list |
| `/review` | Needs review list | Settings or banner (list view) |

**Deep links:** Home banners and Needs review items open their screens. Notifications open the round's company detail.

### 1.4 Key data flows

**A. Calendar refresh**
1. Trigger: app focus, Home Refresh, Settings Refresh now, pull-to-refresh.
2. Read selected calendars for the window (past 60 days to next 120 days).
3. Keep events whose title or description matches a keyword.
4. For each event:
   - Already known and unchanged → skip.
   - Known, time or organizer changed → set `pending_change`, flag on Home. Round is not updated until acknowledged.
   - Known, missing or status cancelled → set `cancelled` flag. Round stays until acknowledged.
   - Ignored (Not an interview) and unchanged → skip.
   - New → run matching.
5. Matching outcome:
   - Auto-attach (score rule met) → create round, show blue banner with Change and Undo.
   - Otherwise → create review item, show amber banner.
6. Recompute Home and Companies.

**B. Placing an event (Which company?)**
1. User chooses existing company or types a new name.
2. Choose round position (default = next number).
3. Create round with `calendar_event_id`.
4. Save alias from organizer email and title pattern.
5. Mark review item decided.

**C. Marking a result**
1. User taps Approved, Rejected, or Didn't happen on latest done round.
2. Save result and timestamp.
3. Approved: stays Active. Rejected: company becomes Rejected with "out after round N". Didn't happen: round excluded from numbering, no pending or ping.
4. Recompute.

**D. Marking pinged**
- Triggered by Mark as pinged, Copy text, or Open in Mail.
- Writes a ping row linked to the latest done round with pending result.

**E. Export and import**
- Export: write `interview-tracker-backup-YYYY-MM-DD.json` and `...summary.txt`, then open the share sheet.
- Import: pick a JSON file, validate `schemaVersion`, show counts, confirm, then apply.

### 1.5 Cross-cutting concerns

- **Errors:** every repository call returns a result object. UI shows a short message and a Retry button. Nothing crashes on a failed read.
- **Permissions:** calendar permission denied shows a Settings-style card with a button to open system settings. App still works for manual entries.
- **Time zones:** store epoch milliseconds plus the IANA zone string at creation. Display in device zone. Round dates are compared in the device zone.
- **Idempotent refresh:** keyed by calendar event ID. Running refresh twice gives the same result.
- **Offline:** everything is local. Calendar refresh needs only the device calendar, not the network.
- **Logging:** local only, in dev builds. Nothing leaves the phone.
- **Privacy:** backup files contain personal data. ASSUMPTION: no encryption in v1, and the summary notes that the backup is unencrypted.

### 1.6 Non-functional targets (ASSUMPTION, adjust if needed)

| Metric | Target |
|---|---|
| Cold start to Home | under 2 seconds on a mid-range phone |
| Calendar refresh (about 200 events in window) | under 3 seconds |
| Companies list (100 companies) | scrolls at 60 fps |
| Database size after 2 years of use | under 20 MB |
| Layout | works from 360px to 430px width |

---

## 2. Low-level design (LLD)

### 2.1 SQLite schema (migration 001)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE company (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT,
  status        TEXT NOT NULL CHECK (status IN ('active','rejected')),
  rejected_at   INTEGER,                       -- epoch ms
  rejected_reason TEXT CHECK (rejected_reason IN ('round','not_moving_forward')),
  rejected_after_round INTEGER,                -- set when reason='round', derived number at time of rejection
  jd_text       TEXT,
  jd_link       TEXT,
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE recruiter (                        -- one per company (ASSUMPTION)
  company_id    TEXT PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
  name          TEXT,
  phone         TEXT,
  email         TEXT
);

CREATE TABLE recruiter_call (                   -- timeline entry, NOT a round
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  call_at       INTEGER NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'phone',
  recruiter_name TEXT,
  recruiter_phone TEXT,
  said          TEXT,                            -- "What did the recruiter say?"
  done          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE round (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('manual','calendar')),
  calendar_event_id TEXT UNIQUE,               -- NULL for manual
  type            TEXT NOT NULL CHECK (type IN ('walk_in','offline','phone','online')),
  round_label     TEXT,                        -- e.g. "Technical round", "HR round", "Recruiter screen"
  starts_at       INTEGER NOT NULL,
  ends_at         INTEGER,
  location_or_link TEXT,
  contact_name    TEXT,
  contact_phone   TEXT,
  notes           TEXT,
  result          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (result IN ('pending','approved','rejected','didnt_happen')),
  result_set_at   INTEGER,
  change_flag     TEXT CHECK (change_flag IN ('moved','cancelled')),   -- NULL if none
  pending_starts_at INTEGER,                   -- proposed new time, applied on acknowledge
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_round_company_start ON round(company_id, starts_at);

CREATE TABLE calendar_event (                   -- cache of what we read, keyed by event id
  event_id        TEXT PRIMARY KEY,
  calendar_id     TEXT NOT NULL,
  title           TEXT,
  starts_at       INTEGER NOT NULL,
  ends_at         INTEGER,
  organizer_email TEXT,
  description     TEXT,
  meeting_link    TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  last_seen_at    INTEGER NOT NULL
);

CREATE TABLE review_item (
  event_id        TEXT PRIMARY KEY REFERENCES calendar_event(event_id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('open','decided','dismissed')),
  suggested_company_id TEXT,
  suggested_name  TEXT,                        -- e.g. "Stark Industries"
  created_at      INTEGER NOT NULL
);

CREATE TABLE ignored_event (                    -- "Not an interview"
  event_id        TEXT PRIMARY KEY,
  starts_at_snapshot INTEGER NOT NULL,
  organizer_snapshot TEXT
);

CREATE TABLE ping (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  round_id        TEXT NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  pinged_at       INTEGER NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('mark','copy','mail'))
);
CREATE INDEX idx_ping_round ON ping(round_id, pinged_at);

CREATE TABLE alias (
  id              TEXT PRIMARY KEY,
  pattern_type    TEXT NOT NULL CHECK (pattern_type IN ('organizer','domain','title')),
  pattern         TEXT NOT NULL,
  company_id      TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  UNIQUE (pattern_type, pattern)
);

CREATE TABLE settings (
  key             TEXT PRIMARY KEY,            -- selected_calendar_ids, keywords, signature, reminder_minutes
  value           TEXT NOT NULL                -- JSON
);

CREATE TABLE notification_map (                 -- manual round -> scheduled notification id
  round_id        TEXT PRIMARY KEY REFERENCES round(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL
);

CREATE TABLE schema_version (version INTEGER NOT NULL);
```

**Fields added to the spec's model, and why**
- `recruiter_call` table: recruiter calls are timeline only (your answer).
- `round.round_label`: the screens show "Technical round", "HR round", "Recruiter screen" as names.
- `round.change_flag` and `pending_starts_at`: needed for moved or cancelled flags that are never applied silently.
- `calendar_event.status` and `last_seen_at`: needed to detect cancelled events.
- `ignored_event` snapshot fields: needed for "hidden unless time or organizer changes".
- `ping.channel`: records whether a ping came from a button, copy, or mail. Useful for the Pings list.
- `company.rejected_after_round`: stored at rejection time so the label does not change if numbering shifts later.

### 2.2 TypeScript entities

```ts
export type Status = 'active' | 'rejected';
export type RoundType = 'walk_in' | 'offline' | 'phone' | 'online';
export type Result = 'pending' | 'approved' | 'rejected' | 'didnt_happen';

export interface Company {
  id: string; name: string; role?: string;
  status: Status; rejectedAt?: number;
  rejectedReason?: 'round' | 'not_moving_forward';
  rejectedAfterRound?: number;
  jdText?: string; jdLink?: string; notes?: string;
  createdAt: number; updatedAt: number;
}

export interface Round {
  id: string; companyId: string;
  source: 'manual' | 'calendar'; calendarEventId?: string;
  type: RoundType; label: string;
  startsAt: number; endsAt?: number;
  locationOrLink?: string; contactName?: string; contactPhone?: string; notes?: string;
  result: Result; resultSetAt?: number;
  changeFlag?: 'moved' | 'cancelled'; pendingStartsAt?: number;
}

export interface RecruiterCall {
  id: string; companyId: string; callAt: number; mode: string;
  recruiterName?: string; recruiterPhone?: string; said?: string; done: boolean;
}

export interface Ping { id: string; companyId: string; roundId: string; pingedAt: number; channel: 'mark'|'copy'|'mail'; }

export interface CalendarEvent {
  eventId: string; calendarId: string; title: string; startsAt: number; endsAt?: number;
  organizerEmail?: string; description?: string; meetingLink?: string; phone?: string;
  status: 'active' | 'cancelled'; lastSeenAt: number;
}

export interface MatchResult {
  decision: 'attach' | 'review' | 'ignore';
  companyId?: string;
  suggestedName?: string;
  score: number;
  reasons: string[];
}
```

### 2.3 Pure domain functions (signatures and rules)

**2.3.1 Counted rounds and numbering (R3, your answer)**

```ts
// Counted = not didnt_happen. Sorted by startsAt ascending.
function countedRounds(rounds: Round[]): Round[];
// Round number = 1-based index in countedRounds. Didn't-happen rounds get null.
function roundNumber(round: Round, rounds: Round[]): number | null;
```

Example (Umbrella): 16 Oct approved → #1. 20 Oct didnt_happen → null. 23 Oct pending → #2. Next placed event → #3.

**2.3.2 Done, latest, and waiting (R4, R9, R10)**

```ts
const isDone = (r: Round, now: number) => (r.endsAt ?? r.startsAt) <= now;
// Latest done counted round for a company.
function latestDoneRound(rounds: Round[], now: number): Round | null;
```

**2.3.3 Pending bubble (R10)**

```ts
// Shows only when latest done round has result 'pending'.
// days = calendar-day difference in device zone between round date and today.
// 0 days -> "Pending · today"  (ASSUMPTION)
// 1 day -> "Pending · 1 day", N -> "Pending · N days"
function pendingLabel(round: Round, now: number): string | null;
```

**2.3.4 Ping bubble (R11–R17, your answers)**

```ts
// Only for latest done round with result 'pending'.
// No pings on this round -> { text: "Haven't pinged yet", tone: 'grey' }
// Else last ping on this round:
//   same day -> "Pinged today"; 1 day -> "Pinged 1 day ago"; N -> "Pinged N days ago"
//   tone: 'green'
// Result set on latest round -> null (bubble disappears).
// Today's round not yet done -> null (no bubble, your answer).
// Pings are stored per round, so earlier rounds' pings never carry over.
function pingBubble(latest: Round | null, pings: Ping[], now: number): Bubble | null;
// "Pinged" lists dates for the company page, newest first: "Pinged: 29 Oct, 26 Oct".
function pingDates(latest: Round | null, pings: Ping[]): number[];
```

**2.3.5 Ping sources (your answer)**
- Mark as pinged → channel `mark`
- Copy text → channel `copy`
- Open in Mail → channel `mail`
All three insert a ping row for the latest done pending round. Only one ping per tap.

**2.3.6 Company status and lists**

```ts
// Company is Active unless:
//  - any counted round has result 'rejected' (status -> rejected, reason 'round', rejectedAfterRound = that round number), or
//  - recruiter-call "Not moving forward" tapped (status -> rejected, reason 'not_moving_forward').
// Reopen: status -> active, clears rejected fields. Rounds and results stay.
function rejectedRowLabel(c: Company): string {
  // reason 'round'           -> `out after round ${c.rejectedAfterRound}`
  // reason 'not_moving_forward' (no rounds) -> "Recruiter call only, not moving forward"
}
```

**2.3.7 Awaiting schedule (R19)**
- Company with recruiter calls, no counted rounds yet, status active → "Awaiting schedule · N days", N from latest recruiter call date.
- When a round arrives via calendar, it becomes Round 1 automatically (R22). The awaiting state ends.

**2.3.8 Home sections**
- **Next interview card:** soonest round where `startsAt > now` and not done, across all active companies. Other upcoming rounds listed below.
- **Waiting for result:** companies whose latest done round has result pending. One card each.
- **Previous:** ASSUMPTION: the most recent done round with a non-pending result, per company, up to 5 cards, newest first.
- **Banners:** amber if review items are open. Blue if auto-attached events were added since last view. Flag banners if any change flags exist.

**2.3.9 Next interview card label (R?)**
- Source chip: `Calendar` or `Manual`.
- Round chip: `Round N` (numbered counted rounds). If the round is not counted yet (a future round not placed), chip shows `Round ?`.
- Countdown: `in 2h 15m` from now to start. If under 1 minute: `starting now`. Once started: `in progress` until end.

**2.3.10 Matching (R25–R30)**

```ts
function matchEvent(ev: CalendarEvent, ctx: {
  aliases: Alias[]; companies: Company[]; recruiters: Recruiter[]; ignored: IgnoredEvent[];
}): MatchResult;
```

Scoring:

| Signal | Points |
|---|---|
| Organizer email matches an alias | +3 |
| Organizer or attendee domain matches a recruiter's domain (not gmail.com, outlook.com, or other public domains) | +2 |
| Title pattern "Interview with X" or "X – Round" where X matches a company name (case-insensitive, punctuation stripped, generic words removed) | +2 |
| Title is generic ("Technical round", "HR round", "Interview") and no other signal | 0 |

Rules:
- Attach if top score ≥ 3 and no other company scores ≥ 3.
- Otherwise `review`.
- If the title names a company that does not exist yet → `review` with `suggestedName`. **Blue banner is not used for this case** (your Stark answer). The amber banner shows it.
- Ignored event with unchanged time and organizer → `ignore`.

Generic words stripped: interview, round, call, screen, screening, technical, hr, recruiter, meet, meeting, online, final, call, with, and, the, for, pm, am.

**2.3.11 Calendar diff (R32–R34)**

```ts
type DiffAction =
  | { kind: 'new'; event: CalendarEvent }
  | { kind: 'moved'; eventId: string; newStartsAt: number }
  | { kind: 'cancelled'; eventId: string }
  | { kind: 'link_changed'; eventId: string; newLink: string }
  | { kind: 'none'; eventId: string };

function diffEvents(fresh: CalendarEvent[], stored: CalendarEvent[], ignored: IgnoredEvent[]): DiffAction[];
```

- Stored events missing from the fresh read (inside the window) → `cancelled`.
- Start time changed → `moved` (sets `pending_starts_at`, `change_flag='moved'`).
- Meeting link changed → updates the round's link directly (not a time change, no flag).
- Notes, results, and pings are never touched by refresh (R34).

**2.3.12 Extraction (section 5 of spec)**

```ts
const MEET = /https:\/\/meet\.google\.com\/[a-z0-9-]+/i;
const ZOOM = /https:\/\/[\w.-]*zoom\.us\/j\/\d+[^\s]*/i;
const TEAMS = /https:\/\/teams\.microsoft\.com\/[^\s]+/i;
const PHONE = /\+?\d[\d\s-]{8,}\d/;   // includes +91 90000 00000
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
```

Phone regex matches the placeholder numbers in your screens. Test with `+91 90000 00000`.

**2.3.13 Follow-up email templates (R39–R40)**

```ts
function buildEmail(template: 'follow_up'|'reschedule'|'check_fit', ctx: {
  company: Company; round?: Round; recruiter: Recruiter; signature: string; callDate?: number;
}): { to: string; subject: string; body: string };
```

Subjects:
- Follow up: `Following up: {role}, {round label}`
- Reschedule: `Rescheduling: {role}, {round label}` (ASSUMPTION)
- Check fit: `Following up: {role}, recruiter call` (ASSUMPTION)

Body per template follows the spec text. Signature appended from settings, editable before sending.

**2.3.14 Job description preview and chips (R42–R44)**
- Preview = first 3 lines, word count in header.
- Chips: built from heading lines matching About, Responsibilities, Requirements, Nice to have, Benefits (case-insensitive). Hidden when none found.
- Find in description: case-insensitive substring, highlights matches.

### 2.4 State machines

**Round result**

```
pending ──Approved──► approved        (stays Active)
pending ──Rejected──► rejected        (company -> Rejected, reason 'round')
pending ──Didn't happen──► didnt_happen (excluded from numbering, no pending/ping)
approved ──Change──► pending or rejected (allowed, with confirm)
didnt_happen ──Change──► pending      (allowed, e.g. rescheduled and held)
```

**Company status**

```
active ──round rejected / Not moving forward──► rejected
rejected ──Reopen──► active  (rounds renumber, results kept)
active/rejected ──merge──► target company; source deleted
```

**Review item**

```
open ──Place event──► decided (round created)
open ──Decide later──► open (stays in list)
open ──Not an interview──► dismissed (+ ignored_event row)
```

**Calendar event lifecycle**

```
new ──auto-attach──► round (calendar)
new ──review──► review_item(open)
round ──time changed──► round.change_flag='moved' (until acknowledged)
round ──missing or cancelled──► round.change_flag='cancelled' (until acknowledged)
```

### 2.5 Screen component tree

**Home (`/(tabs)/index`)**
```
HomeScreen
├── Header (date line, Refresh button)
├── BannerStack
│   ├── ReviewBanner (amber, open review count)
│   ├── AutoAddedBanner (blue, with Change and Undo)
│   └── ChangeBanner (flagged moved or cancelled)
├── NextInterviewCard
│   ├── Chips (source, round)
│   ├── Countdown
│   ├── CompanyTitle + Subtitle + TimeRange
│   ├── Buttons (Join Meet / Open link, Copy link)
│   └── RecruiterRow (name, phone, Call)
├── UpcomingList (other upcoming rounds)
├── Section "Waiting for result"
│   └── WaitingCard[] (company, round, PendingBubble, PingBubble, Email follow-up, Call, Mark as pinged)
├── Section "Previous"
│   └── PreviousCard[]
└── AddInterviewPill (floating)
```

**Companies (`/(tabs)/companies`)**
```
CompaniesScreen
├── SearchBar
├── Section Active (count)
│   └── CompanyRow[] (name, role, status line, bubbles)
└── Section Rejected (count)
    └── RejectedRow[] (name, role, rejectedRowLabel, Rejected bubble)
```

**Company detail (`/company/[id]`)**
```
CompanyDetailScreen
├── BackLink, Name, Role, StatusBubbles (+ Reopen if rejected)
├── StatTiles (Rounds approved, Awaiting result)
├── RoundsCard
│   ├── RoundRow[] (label, date · mode, note, ResultBubble)
│   ├── ResultButtons (Mark approved, Mark rejected) under latest pending
│   ├── Interview didn't happen (full width)
│   └── MoveToAnotherCompany (per round)
├── FollowUpCard (latest round, pings, Email follow-up, Call, Mark as pinged)
├── RecruiterCard (name, phone, email, Copy number, Copy email)
├── JobDescriptionCard (preview, Edit icon, Full screen icon)
├── NotesCard (free text)
└── Menu (Rename, Merge, Reopen, Not moving forward)
```

**Add interview (`/add`)**
```
AddInterviewScreen
├── Cancel
├── TypeChips (walk_in, offline, phone, online)
├── RecruiterCallChip (full width)
├── Form (Company*, Role, Date*, Time, Recruiter name, Recruiter phone, What did the recruiter say?)
├── HelpText
└── SaveButton (pinned)
```
Form fields change depending on type. For recruiter call, Company and Date are required and the recruiter fields show. For other types, Time, Role, Location or link, Contact, and Notes are shown.

**Which company? (`/review/[eventId]`)**
```
ReviewScreen
├── Back (Home)
├── EventCard (title, time, organizer, reason text)
├── ExistingCompanyRadio[] (no preselection, your answer)
├── PlaceAsChips (1 to 4, default next number when a company is selected)
├── NewCompanyField (suggested name prefilled, editable)
├── CreateButton (dynamic label)
├── DecideLaterButton
└── NotAnInterviewButton
```

**Follow-up email (`/company/[id]/follow-up`)**
```
FollowUpScreen
├── Cancel
├── TemplateChips (follow_up, reschedule, check_fit)
├── MailCard (To, Subject, Body, editable)
├── HelpText
└── Buttons (Copy text, Open in Mail) pinned
```

**Full job description (`/company/[id]/jd`)**
```
JDScreen
├── Back, Title, Subtitle (role · pasted date · word count)
├── FindInput
├── JumpChips (horizontal scroll)
├── BodyCard (formatted text, bullets)
├── FooterNote
└── Buttons (Copy text, Edit, Open posting)
```

**Edit job description (`/company/[id]/jd/edit`)**
```
JDEditScreen
├── Cancel
├── DescriptionTextArea (live word count)
├── PasteNew, Clear
├── PostingLinkField (placeholder https://)
├── HelpText
└── SaveButton (pinned)
```

**Settings (`/(tabs)/settings`)**
```
SettingsScreen
├── CalendarsCard (last updated, Refresh now, checkbox list)
├── KeywordsCard (chips, + Add)
├── ReminderRow (1 hour before, picker)
├── SignatureCard (textarea)
└── BackupCard (Export, Import)
```

### 2.6 Notifications (manual rounds only)

- Channel: `interview-reminders` (created at app start).
- On save of manual round: schedule local notification at `startsAt − reminder_minutes`. Store id in `notification_map`.
- On edit: cancel old, schedule new.
- On delete: cancel.
- If the scheduled time is in the past: skip and do not show an error.
- Calendar events: no app reminders (Google handles them, per spec).
- Recruiter calls: no reminders (ASSUMPTION, not in spec).

### 2.7 Backup format

**File 1: `interview-tracker-backup-YYYY-MM-DD.json`**
```json
{
  "schemaVersion": 1,
  "exportedAt": 1761926400000,
  "companies": [],
  "recruiters": [],
  "recruiterCalls": [],
  "rounds": [],
  "pings": [],
  "aliases": [],
  "reviewItems": [],
  "ignoredEvents": [],
  "settings": {}
}
```

**File 2: `...summary.txt`** (readable)
```
Interview Tracker backup, 31 Oct 2026
Companies: 6 (4 active, 2 rejected)
Rounds: 9 · Pings: 4 · Notes: 3

Umbrella Labs (SDE II), Active
  Round 1: Recruiter screen, 16 Oct, Phone, Approved
  (Didn't happen) Technical round, 20 Oct, Online
  Round 2: Technical round, 23 Oct, Online, Pending
  Pinged: 29 Oct, 26 Oct
  Notes: Discussed scaling the job queue. Ask about team structure.
...
Contains personal data. Not encrypted.
```

**Import rules (ASSUMPTION):**
1. Read JSON. Reject if `schemaVersion` missing or greater than supported.
2. Validate required fields per table. Show a summary: counts of companies, rounds, pings, notes.
3. Confirm: "Replace all data with this backup?" Replace is the default because merge conflicts are hard to explain.
4. Write in a single transaction. Roll back on any error.

### 2.8 Permissions flow

- **Calendar (READ_CALENDAR):** asked on first Settings → calendars step, or when user taps Refresh. Denied → Home shows a card "Calendar access is off. Manual entries still work." with Open settings.
- **Notifications:** asked the first time a manual round is saved. Denied → app still saves rounds, shows a note in Settings that reminders are off.

### 2.9 Empty and error states

| Screen | Empty / error | Content |
|---|---|---|
| Home | No upcoming interviews | "No upcoming interviews. Add one, or check your calendar selection in Settings." Buttons: Add interview, Settings |
| Home | No companies at all | Same as above, plus "Start by adding an interview or a recruiter call." |
| Companies | No companies | "No companies yet." Add interview button |
| Companies | Search no match | "No match for '…'" |
| Company detail | No rounds (recruiter call only) | Timeline shows the recruiter call and "Interview: Not scheduled yet" |
| Needs review | Nothing to review | "Nothing to review." |
| JD | No JD text | "No job description saved." Add button → edit screen |
| Settings | No calendars found | "No calendars on this phone. Add a Google account in phone settings." |
| Import | Bad file | "This file isn't an Interview Tracker backup." |
| Any | DB read error | Message and Retry. No crash. |

---

## 3. Project structure

```
interview-tracker/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── app/                                  # expo-router file-based routes (ASSUMPTION)
│   ├── _layout.tsx                       # root stack, DB init, theme
│   ├── (tabs)/
│   │   ├── _layout.tsx                   # bottom tab bar
│   │   ├── index.tsx                     # Home
│   │   ├── companies.tsx                 # Companies
│   │   └── settings.tsx                  # Settings
│   ├── add.tsx                           # Add interview
│   ├── review/
│   │   ├── index.tsx                     # Needs review list
│   │   └── [eventId].tsx                 # Which company?
│   └── company/
│       ├── [id].tsx                      # Company detail
│       └── [id]/
│           ├── follow-up.tsx             # Follow-up email
│           └── jd/
│               ├── index.tsx             # Full JD
│               └── edit.tsx              # Edit JD
├── src/
│   ├── theme/
│   │   └── tokens.ts                     # colours, spacing, radius, type scale
│   ├── types/
│   │   └── entities.ts                   # TS interfaces from 2.2
│   ├── db/
│   │   ├── client.ts                     # open DB, PRAGMA foreign_keys
│   │   ├── migrations/
│   │   │   ├── index.ts                  # run in order, track schema_version
│   │   │   └── 001_init.ts               # DDL from 2.1
│   │   └── repositories/
│   │       ├── companies.ts
│   │       ├── rounds.ts
│   │       ├── recruiterCalls.ts
│   │       ├── pings.ts
│   │       ├── calendarEvents.ts
│   │       ├── reviewItems.ts
│   │       ├── aliases.ts
│   │       ├── ignored.ts
│   │       ├── settings.ts
│   │       └── notifications.ts
│   ├── domain/                           # pure functions, no React, no DB
│   │   ├── numbering.ts                  # 2.3.1
│   │   ├── status.ts                     # latest, done, pending, rejected label, awaiting
│   │   ├── pingBubble.ts                 # 2.3.4
│   │   ├── homeSections.ts              # 2.3.8
│   │   ├── matching.ts                   # 2.3.10
│   │   ├── diff.ts                       # 2.3.11
│   │   ├── extraction.ts                 # 2.3.12 regexes and parsers
│   │   ├── templates.ts                  # 2.3.13
│   │   ├── jd.ts                         # 2.3.14
│   │   ├── countdown.ts                  # 2.3.9
│   │   └── time.ts                       # day diffs, formatting, device zone
│   ├── services/
│   │   ├── calendarSync.ts               # read, filter, diff, apply
│   │   ├── notifications.ts              # schedule, cancel, channel
│   │   ├── backup.ts                     # export, import, summary text
│   │   ├── mail.ts                       # open in mail, copy
│   │   └── permissions.ts
│   ├── hooks/
│   │   ├── useQuery.ts                   # run repository query, refresh on bus event
│   │   ├── useRefreshBus.ts              # emit/listen for data changes
│   │   ├── useHome.ts
│   │   ├── useCompanies.ts
│   │   └── useCompany.ts
│   ├── components/
│   │   ├── Bubble.tsx                    # status bubble, tone prop
│   │   ├── Button.tsx                    # primary, outlined, danger, icon
│   │   ├── Card.tsx
│   │   ├── Banner.tsx
│   │   ├── Chip.tsx
│   │   ├── TabBar.tsx
│   │   ├── RoundRow.tsx
│   │   ├── CompanyRow.tsx
│   │   ├── NextInterviewCard.tsx
│   │   ├── WaitingCard.tsx
│   │   ├── ResultButtons.tsx
│   │   ├── RecruiterCard.tsx
│   │   ├── JobDescriptionCard.tsx
│   │   └── EmptyState.tsx
│   └── utils/
│       ├── id.ts                         # uuid
│       └── errors.ts                     # Result<T> helpers
├── tests/
│   ├── domain/
│   │   ├── numbering.test.ts
│   │   ├── pingBubble.test.ts
│   │   ├── status.test.ts
│   │   ├── matching.test.ts
│   │   ├── diff.test.ts
│   │   ├── extraction.test.ts
│   │   └── templates.test.ts
│   ├── db/
│   │   └── repositories.test.ts
│   └── components/
│       └── bubbles.test.tsx
└── docs/
    ├── spec.md                           # the MVP spec
    ├── decisions.md                      # section 0 of this plan
    └── test-device-checklist.md
```

**Naming:** files for components are PascalCase. Everything else is camelCase. Domain functions are named by what they return (`pingBubble`, `roundNumber`), not by screen.

---

## 4. Detailed plan

### 4.1 Time estimate (your pace: under 5 hours a week)

| Phase | Work | Hours | Weeks at 5h/wk |
|---|---|---|---|
| P0 | Setup, RN basics for a TS developer, first build on your phone | 10 | 2 |
| P1 | Database, models, manual entry create, edit, delete | 14 | 3 |
| P2 | Calendar read, permission, picker, keywords, extraction | 12 | 2–3 |
| P3 | Matching, aliases, Needs review, Which company?, merge | 14 | 3 |
| P4 | Company detail, results, ping logic, reopen, move round | 16 | 3–4 |
| P5 | Home, Companies, search, refresh behaviour, banners | 12 | 3 |
| P6 | Follow-up email templates and signature | 6 | 1–2 |
| P7 | Job description: preview, edit, full screen, chips | 6 | 1–2 |
| P8 | Reminders, backup export and import | 10 | 2 |
| P9 | Test builds, device checks, fixes, polish | 10 | 2 |
| Buffer | Unplanned issues, learning time | 12 | 2–3 |
| **Total** | | **≈ 122 h** | **≈ 24–28 weeks** |

This is an estimate for a steady pace. If you do an extra hour or two in some weeks, it gets faster.

### 4.2 Phase 0: Setup and React Native basics (10 h)

**Goal:** a blank app runs on your Android phone through an EAS preview build.

Tasks:
1. Install Node LTS, Git, VS Code. Create an Expo account (free). Install EAS CLI.
2. Create project with the current Expo template (use `create-expo-app`, choose the TypeScript template with expo-router). Check the SDK version at setup, not from memory.
3. Learn the four ideas you need: components and props, `useState`/`useEffect`, `StyleSheet`, and file-based routing (expo-router).
4. Enable developer options and USB debugging on your phone. Install Expo Go to see the basics quickly.
5. Run `eas build -p android --profile preview` and install the APK on your phone.
6. Add the folder structure from section 3 (empty files).
7. Set up `eslint` and `prettier`, and enable TypeScript `strict`.
8. Add Jest and React Native Testing Library. Write one test that passes.

**Acceptance:**
- App opens on your phone from an installed APK.
- Three tabs visible (placeholders).
- `npm test` passes.

**Learning checkpoint:** be able to explain why a component re-renders and how a route param gets into a screen.

### 4.3 Phase 1: Database and manual entries (14 h)

Tasks:
1. Create `db/client.ts`: open database, set `PRAGMA foreign_keys = ON`.
2. Write migration `001_init.ts` from section 2.1. Track version in `schema_version`.
3. Write repositories for companies, rounds, recruiter calls, recruiter, and settings with typed inputs and outputs.
4. Build `Add interview` screen for all five types. Save creates company if new (matched by exact name for now).
5. Build company detail skeleton that lists rounds and recruiter call.
6. Edit and delete manual rounds. Delete cascades pings.
7. Unit tests: repository CRUD, cascades, unique constraints.

**Acceptance:**
- Create a manual Walk-in round for a new company. It appears in the company detail.
- Edit the time. Delete the round. Company remains.
- Restart the app. Data persists.

### 4.4 Phase 2: Calendar read and parsing (12 h)

Tasks:
1. Add `expo-calendar`. Request READ_CALENDAR. Handle denied state.
2. Build Settings calendars card: list calendars with account address, tick selection, save to settings.
3. Read events for the window (past 60 days, next 120 days) from selected calendars.
4. Keyword filter (`interview`, `round`, `screening`, `technical`, `HR`, `recruiter`). Case-insensitive, matches title or description.
5. Extraction: meeting links, phone numbers, emails (regexes in 2.3.12).
6. Store results in `calendar_event` (no round yet).
7. Unit tests for extraction with examples: Meet link, Zoom link, Teams link, `+91 90000 00000`, emails, no matches.

**Acceptance:**
- Only the Job search calendar is read (Personal and Employer unticked).
- Keyword events appear in the cache with parsed link and phone.
- Denied permission shows the Calendar access card on Settings.

### 4.5 Phase 3: Matching, aliases, Needs review, Which company? (14 h)

Tasks:
1. Implement `matching.ts` scoring from 2.3.10. Unit tests for each signal and the tie rule.
2. Implement `diff.ts` for new, moved, cancelled, link-changed. Unit tests.
3. `calendarSync.ts` applies: attach (creates round, source `calendar`, saves alias), review (creates `review_item`), ignore.
4. Auto-attach shows blue banner with Change and Undo. Undo deletes the round and restores the review state. Change opens Which company?.
5. Build Needs review list and Which company? screen (no preselection, your answer).
6. Placing an event: create round with computed label and position, save aliases from organizer email and title pattern.
7. Not an interview: insert `ignored_event`, mark review dismissed.
8. Merge companies: move rounds, pings, notes, aliases, recruiter (target keeps its own recruiter, source recruiter deleted). Delete source. Renumber.
9. Move one round to another company (from company detail).

**Acceptance:**
- An event with a matching recruiter domain attaches automatically, with banner and Undo.
- A generic "Technical round" with hr@gmail.example goes to Needs review. Nothing preselected.
- Stark-style event (new company name) goes to review with suggested name. No company created until confirmed.
- "Not an interview" stays hidden after refresh. Changing the event's time makes it reappear.
- Merge leaves one company with all rounds and pings.

### 4.6 Phase 4: Company detail, results, ping logic, reopen (16 h)

Tasks:
1. Implement `numbering.ts`, `status.ts`, `pingBubble.ts` with the rules in section 2.3. Write tests for every rule in R9–R17 and your answers (today's round, didn't happen, numbering skip).
2. Build RoundRow with result bubble and number.
3. Result buttons: Mark approved, Mark rejected (confirm), Interview didn't happen (confirm). Each updates `round.result`.
4. FollowUpCard: latest round, ping dates, Mark as pinged, Email follow-up, Call.
5. Ping writes with channel `mark`.
6. Reopen: clears rejected fields, status active. Test renumbering.
7. Rejected row label variants (round vs recruiter-call-only, your answer).
8. Recruiter call entries: awaiting schedule days, Not moving forward button.
9. Change flags: show banner on the round row, Accept change and Keep current buttons.

**Acceptance (use the Umbrella Labs sample from section 8 of the spec):**
- Rounds show: Recruiter screen Approved, Technical 20 Oct Didn't happen (no number), Technical 23 Oct Round 2 Pending · 8 days.
- Pings 26 Oct and 29 Oct show as "Pinged: 29 Oct, 26 Oct" and bubble "Pinged 2 days ago".
- Mark approved on 23 Oct → ping bubble disappears, company stays Active.
- Mark rejected on 23 Oct → company Rejected, "out after round 2".
- Reopen → Active, numbers and results kept.

### 4.7 Phase 5: Home, Companies, refresh (12 h)

Tasks:
1. `homeSections.ts`: next interview (soonest upcoming), upcoming list, waiting list (pending latest done round), previous list (ASSUMPTION rule from 2.3.8).
2. `countdown.ts`: "in 2h 15m", "starting now", "in progress".
3. NextInterviewCard with Join Meet, Copy link, recruiter row with Call. If no meeting link, show "No meeting link" and Copy text.
4. WaitingCard with Pending bubble, Ping bubble, Email follow-up, Call, Mark as pinged.
5. Banners: amber review count, blue auto-added (dismiss after view), change flags.
6. Companies list: Active, Rejected sections, counts, search across company name, role, recruiter name and email.
7. Refresh triggers: app focus (`AppState`), Home button, pull-to-refresh, Settings refresh now. Debounce 60 seconds for focus-triggered refresh.
8. Bottom padding so the floating pill does not hide buttons.

**Acceptance:**
- Home matches the screen: Acme as next card, Umbrella and Globex under Waiting, Companies counts 4 and 2.
- Stark does not appear in Companies until confirmed.
- Pull-to-refresh and returning from another app both refresh.

### 4.8 Phase 6: Follow-up email (6 h)

Tasks:
1. `templates.ts` with three templates and signature from settings. Unit tests on subject and body text.
2. FollowUpScreen with template chips, editable body, Copy text, Open in Mail.
3. Copy text → channel `copy` ping. Open in Mail → channel `mail` ping (your answer).
4. Recruiter has no email → To field empty and a note: "No recruiter email saved."

**Acceptance:**
- Umbrella follow-up matches the screen text exactly.
- Signature edits in Settings change the next email.
- Both copy and mail actions mark pinged.

### 4.9 Phase 7: Job description (6 h)

Tasks:
1. `jd.ts`: preview, word count, chip detection, find-in-description.
2. Company card preview with Edit and Full screen icons.
3. Full JD screen with chips and find.
4. Edit screen: live word count, Paste new (clipboard), Clear, posting link (https:// placeholder), Save.
5. Saving refreshes preview everywhere (it reads from the store, so this is automatic).

**Acceptance:**
- Umbrella JD shows 1,850 words, chips About through Benefits.
- Find highlights text.
- Saving a new paste updates company detail, full screen, and word count.

### 4.10 Phase 8: Reminders, backup (10 h)

Tasks:
1. `notifications.ts`: channel creation, schedule at start minus reminder minutes, reschedule on edit, cancel on delete.
2. Reminder setting in Settings (choices: 15 min, 1 hour, 1 day before ... ASSUMPTION list).
3. `backup.ts`: build JSON from repositories, build summary text, write files, open share sheet.
4. Import: pick file, validate schemaVersion and shape, show counts, confirm, replace in one transaction.
5. Tests: round-trip export → import yields identical data (compare counts and key fields).

**Acceptance:**
- Manual round 1 hour before shows a notification on device (test with a 2-minute reminder first).
- Export creates both files. Summary matches counts.
- Import of a bad file shows an error and changes nothing.

### 4.11 Phase 9: Test builds and polish (10 h)

Tasks:
1. Device test checklist (below). Run on your Android 12+ phone.
2. Check layout at 360px and 430px width (use Android emulator sizes if needed, or your phone's display settings).
3. Fix button sizes (48px minimum), wrap rows, tap targets.
4. Empty and error states from 2.9.
5. Build a preview APK with EAS. Install and run the full checklist on the APK.
6. Write a short README: how to build, how to back up, how to restore.

**Device test checklist (starter)**

| # | Check | Pass |
|---|---|---|
| 1 | Fresh install: Home empty state shows | |
| 2 | Calendar permission denied: card shows, manual still works | |
| 3 | Select Job search only: Personal and Employer not read | |
| 4 | Keyword event auto-attaches when recruiter domain matches | |
| 5 | Generic event goes to Needs review, nothing preselected | |
| 6 | Stark-style new company goes to review, not Companies | |
| 7 | Not an interview hides event after refresh | |
| 8 | Didn't happen round has no number | |
| 9 | Pending bubble counts days correctly across midnight | |
| 10 | Copy text marks pinged. Open in Mail marks pinged | |
| 11 | Reopen renumbers, keeps results | |
| 12 | Merge moves rounds, pings, notes | |
| 13 | Manual round reminder fires | |
| 14 | Export and import round-trip | |
| 15 | Bad import file rejected | |
| 16 | 360px and 430px layouts usable | |
| 17 | App restart keeps all data | |
| 18 | Refresh on app return and pull-to-refresh | |

### 4.12 Test strategy

| Layer | What | Tool |
|---|---|---|
| Domain (pure) | numbering, ping, status, matching, diff, extraction, templates, JD | Jest |
| Repositories | CRUD, cascades, unique constraints, transactions | Jest with in-memory or test SQLite |
| Components | bubble text and tone, button visibility rules, Next card states | React Native Testing Library |
| Integration | calendar sync → round created → Home shows it | Jest with mocked expo-calendar |
| Device | checklist above | Manual on phone |

### 4.13 Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Company name guessing wrong | Wrong attach | Attach only with score rule. Undo and Change on every auto-add. Needs review for doubt. |
| Calendar API differences across phones | Events missing | Test on your phone early (Phase 2). Log raw counts in dev builds. |
| Time zone or day-boundary bugs | Wrong pending days | Use device zone consistently. Tests for midnight. |
| Data loss on phone reset | Lost history | Export reminder in Settings (ASSUMPTION: a monthly reminder). |
| Notifications not firing (battery saver) | Missed reminders | Test on device. Document that battery optimisation may need turning off for the app. |
| Learning curve in React Native | Slower progress | Phase 0 covers basics. Buffer hours included. |
| Expo SDK updates break build | Time lost | Pin dependencies after Phase 0. Upgrade only between phases. |
| Scope creep | Delays | Anything not in section 7 of spec goes to "Later" list. |

### 4.14 Definition of done (v1)

- All 10 screens built and match the design for layout and text.
- All rules R1–R44 from the spec implemented or explicitly changed by your decisions in section 0.
- Every test in section 4.12 passes. Device checklist complete on your Android 12+ phone.
- Preview APK installed on your phone and used for at least one week with real data.
- Export and import tested once with real data.
- Known limitations written in README.

---

## 5. Assumptions to confirm

These are my choices where the spec or your answers did not cover a case. Tell me any you want changed.

1. **Stark / blue banner:** the blue "New interview found" banner is used only for events auto-attached to an existing company. New-company events show the amber banner.
2. **Pending on the day of a round:** shows "Pending · today" (0 days).
3. **Previous section on Home:** the most recent done round per company with a non-pending result, up to 5 cards.
4. **Recruiter table:** one recruiter per company. Recruiter call phone and name are stored on the call, not the company.
5. **Reminder choices:** 15 min, 1 hour (default), 1 day before.
6. **Import:** replaces all data after confirmation.
7. **Backup reminder:** a monthly prompt to export.
8. **Recruiter call reminders:** none.
9. **Rejected row with rounds:** "out after round N", where N is the number at the time of rejection.
10. **Alias source for placed events:** saved from organizer email and title pattern. Same organizer later suggests the same company, but never preselects it on Which company?.
11. **Dropped fields:** the "reminder state" on company (section 2.1) is not stored. Reminders are per manual round.
12. **Expo Router** is used for navigation. The spec did not name a navigation library.

---

## 6. First steps for you (this week)

1. Install Node LTS, VS Code, and Git.
2. Create an Expo account and install EAS CLI.
3. Run Phase 0 tasks 1 to 5.
4. Share your build result, or any error message, and I will help you through the next step.