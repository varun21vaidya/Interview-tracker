I'll deliver in three parts and keep each one short. This is Part 1: architecture, key decisions, security, and structure. Part 2 has the schema and the core code. Part 3 has the phased plan and test checklist.

## Part 1: Architecture, decisions, security, structure

### Changes from my earlier plan

| # | Change | Why |
|---|---|---|
| C1 | Wayne Tech shows on Home under "Waiting for result" with the "Awaiting schedule · N days" bubble. Buttons: Email follow-up (Check fit template), Call, Mark as pinged. | Your answer |
| C2 | `ping` points at either a round or a recruiter call: `target_type` ('round' or 'recruiter_call') plus `target_id`. | My earlier schema required `round_id`, which a recruiter-call-only company doesn't have. |
| C3 | When the invite arrives and becomes Round 1, recruiter-call pings do not carry over. | Same "latest target only" rule as R14. |
| C4 | `ASSUMPTION`: schedule reminders with the notification library's date trigger and avoid the exact-alarm permission. Verify against current Expo docs when you reach that phase. | Android 12+ restricts exact alarms. A reminder a few minutes late is fine here. |

### Architecture (kept simple)

**Functional core, imperative shell**
- `domain/` holds pure functions with no React or database imports. This is where the bugs would hide, so it is the easiest part to unit test.
- `db/repositories/` is the only code that touches SQLite (Repository pattern).
- `services/` covers calendar, notifications, backup, and mail. It is thin glue between the repositories and the platform.
- Screens call hooks, hooks call repositories, and domain functions turn rows into bubbles and sections.

**State.** No Redux or Zustand.
- Data lives in SQLite.
- A tiny event emitter (`dataChanged`) fires after any write.
- Hooks re-query when it fires.
- This replaces a global store with about 20 lines of code.

**Derived values are never stored.**
- Round number, pending days, ping bubble, awaiting days, and Home sections are all computed on read.
- The only exception is `rejected_after_round`, which is stored at rejection time so the label stays stable (R23).

**Time.**
- Store epoch milliseconds (UTC).
- "Days" means the difference between local calendar dates, not 24-hour blocks. This avoids midnight bugs.

**Single Home query.**
- One function returns `{ next, upcoming, waiting, previous, banners }`.
- It runs in one pass over the companies, rounds, and pings.
- Home needs no per-card queries.

### Security and privacy decisions

| Area | Decision |
|---|---|
| Network | The app makes no network calls. Don't add the INTERNET permission, though Expo dev builds may add it, so check the final manifest. |
| Permissions | Only calendar read and notifications. Request each one when the feature is first used, not at launch. |
| Employer calendar | No calendars are ticked by default. Ticking a calendar shows a one-line warning about colleagues or admins seeing events, per spec 3.9. |
| SQL | Parameterized queries only. Never build SQL by string concatenation, even for search. |
| Import | The backup file is untrusted input. Apply a file size cap, parse with try/catch, check `schemaVersion`, validate every field's type and enum, and cap string lengths. Write in one transaction and roll back on any failure. |
| Links | `jd_link` and meeting links accept only `https:`. Phone numbers are stripped to digits and `+` before building `tel:`. Email is validated before `mailto:`. |
| Android auto-backup | `ASSUMPTION`: set `android.allowBackup` to false so the database isn't copied to Google Drive. Your own Export file is the backup. The trade-off is that a phone migration needs Export and Import. |
| Backup file | It is plain text and contains personal data. The share sheet is the only exit, and the summary file says it is unencrypted. Encryption is later scope. |
| Logging | No personal data in logs. Strip logs from release builds. |
| Notifications | The text shows company and time only, with no recruiter phone or email, so nothing sensitive appears on the lock screen. |
| Dependencies | Pin versions after Phase 0. Upgrade only between phases. |

### Folder structure (Expo Router)

```
app/
  _layout.tsx                 # DB init + migrations, then render stack
  (tabs)/{_layout,index,companies,settings}.tsx
  add.tsx
  review/{index,[eventId]}.tsx
  company/[id]/{index,follow-up,jd,jd-edit}.tsx
src/
  theme/tokens.ts             # teal accent, spacing, radii, 48px min touch
  types/entities.ts
  db/{client.ts, migrations/001_init.ts, repos/*.ts}
  domain/                     # pure, no imports from db or react
    numbering.ts status.ts pings.ts home.ts
    matching.ts diff.ts extract.ts email.ts jd.ts time.ts
  services/{calendarSync,notifications,backup,mail,permissions}.ts
  hooks/{useData,useHome,useCompany}.ts
  components/{Bubble,Button,Card,Banner,Chip,...}.tsx
tests/                        # mirrors src/domain and src/db
```

Rules for keeping it simple:
- Domain files stay under about 120 lines each.
- Components are dumb: they take props and render.
- Every screen gets its data from one hook.
