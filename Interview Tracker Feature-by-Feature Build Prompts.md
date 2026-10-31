# Interview Tracker: Feature-by-Feature Build Prompts

One short prompt per phase, built so Claude only sees what it needs and can't fill gaps with guesses.

## Read this first

I have now read Part 2 and the spec (spec\_plan\_1.md). I have not opened initial\_plan.md. The prompts below now use Part 2’s real file names and tell Claude to copy and test its code, not rewrite it. Pasting the real code and spec text is what stops invented behaviour.

## Problems found in Part 2 and the spec

Fifteen mismatches. The prompts already handle all of them, and the decisions on rows 5, 6, 7 and 11 are made.

| # | Where | Problem | What the prompts now do |
| --- | --- | --- | --- |
| 1 | Part 2 `getDb()` | Two screens calling it at startup can both open the database and run migrations twice. | P1a caches the opening promise. |
| 2 | Part 3 fix vs Part 2 | `jd_words` is missing from migration 001, and `loadBundles` still runs `SELECT * FROM company`, loading every full job description. | P1a applies the fix. |
| 3 | `parseBackup` | Only company, round and ping have validators; recruiter, recruiter\_call and alias are left as “same pattern”, so a restore would silently drop them. | P11 requires them. |
| 4 | `restore` | Scheduled reminders keep pointing at rounds that were just deleted. | P11 cancels all and clears notification\_map. |
| 5 | Backup scope | Signature, keywords and reminder setting are neither excluded nor restored. | P11 includes them (decided). |
| 6 | `counted()` | A cancelled future round later looks like a done, pending round. | P1b excludes cancelled rounds from counted(); P8b adds a Reopen button (decided). |
| 7 | `attachRound` | Spec 3.3 prefills recruiter name and email from the organizer; the code does not. | P8b prefills email and phone (decided). |
| 8 | Companies rows | Nothing produces “Round 3 approved · round 4 today” or the Interview today bubble. Architecture lists `status.ts`; Part 2 never writes it. | P2 has Claude write `status.ts` with tests. |
| 9 | Email templates | The spec describes Reschedule and Check fit only in prose. | P6 drafts them as ASSUMPTION for your approval. |
| 10 | Spec vs decisions | Screens show Umbrella pre-selected on Which company? and Globex under Previous. | Decisions 7 and 3 win; P4 and P8a say so. |
| 11 | Add screen | No round-name field, so manual rounds get the label “Interview”, while screenshots show “Technical round”. | P5 adds an optional Round name field (decided). |
| 12 | Rule ids | R1 to R44 are not defined in the files I could open; they appear only in Part 2 code comments. | Prompts use D#, C# and D-A to D-F. |
| 13 | `useData.ts` | Missing React imports. | P1a adds them. |
| 14 | First sync window | Your brief says 60 days back; Part 2 D-D reads 14 on the first sync. | P7 follows D-D. |
| 15 | Seed data | The spec has no seed table. | P1c carries values taken from the screenshots. |

The prompts below replace the earlier versions for P1a to P11.

## The workflow (one loop per phase)

1. **One chat per phase.** Split any phase over about 2.5 hours into two chats (I split P1 for you).
2. **Start with the Master Context block below.** Keep it identical every time and never edit it mid-chat; this keeps prompt caching working. Change it only between chats.
3. **Then paste the phase prompt**, then only the inputs it lists (signatures and the relevant spec rules, not whole files).
4. **Run it on your phone, run `npm test`, commit.**
5. **Ask for the Handoff note** (template at the end), save it, and close the chat.
6. **Paste the Handoff note** into the next chat under INPUTS. It replaces re-pasting code.

## Master Context block (paste at the top of every chat)

```
ROLE
You are helping me build 'Interview Tracker', an Android-only personal app. I know TypeScript and am new to React Native/Expo. NO PREAMBLE/EXPLANATIONS: Do not explain logic, do not write greetings, and do not summarize changes. Output only code or direct technical answers.

STACK (locked; add nothing)
Expo SDK <PASTE VERSION FROM package.json>, React Native, TypeScript strict, Expo Router, expo-sqlite, expo-calendar (read-only), expo-notifications (local), expo-clipboard, expo-linking, expo-document-picker, expo-sharing, expo-file-system, Jest (jest-expo).
No backend, login, network calls, AI, dark mode, animations, Redux or Zustand. Android 12+, EAS development build (not Expo Go).

ARCHITECTURE
- src/domain: pure functions, no React or DB imports, each file under ~120 lines.
- db/client.ts, db/bus.ts and db/repos (bundles.ts, actions.ts): the only code that touches SQLite. Parameterized SQL only.
- src/services: thin platform glue (calendar, notifications, backup, mail, permissions).
- hooks call repos; screens call one hook each; components are dumb (props in, UI out).
- State = SQLite + a tiny emitter (db/bus.ts: onChange, emitChange). Hooks re-query on it.
- Derived values (round number, pending days, ping bubble, awaiting days, Home sections) are computed on read, never stored. Only exception: rejected_after_round.
- Time: epoch ms UTC. 'Days' = difference between LOCAL calendar dates.
- Links: https: only. tel: digits and + only. mailto: only after email validation.

DECISIONS (final)
D1 'Didn't happen' rounds get no number; numbers count only counted rounds, by date.
D2 Recruiter call with no interview is a timeline entry, not a round; becomes Round 1 when the invite arrives.
D3 Home 'Waiting for result' = any company whose latest done round is pending.
D4 Home Next card = soonest upcoming interview; others listed below it.
D5 Round today with no result: no ping bubble; company stays Active.
D6 New company from calendar goes to Needs review; not created until confirmed. Blue banner only for auto-attached events to existing companies.
D7 Which company? screen: nothing pre-selected.
D8 'Mark as pinged', 'Copy text', 'Open in Mail' each record a ping on the latest done pending round.
D9 Reopen: rounds renumber; old results kept.
D10 Multiple roles at one company = separate companies.
D11 'Not an interview' stays hidden unless its time or organizer changes.
D12 Merge moves all rounds, pings, notes into target; deletes source.
D13 Rejected with no rounds: label 'Recruiter call only, not moving forward'.
D14 Backup = one JSON file with schemaVersion plus a readable text summary; import replaces data after confirmation.
D15 Pending on the day of a round: 'Pending · today'.
C1 Wayne Tech-style (recruiter-call-only) companies show under Waiting for result with 'Awaiting schedule · N days'.
C2 A ping targets a round or a recruiter call: target_type ('round' | 'recruiter_call') + target_id.
C3 When the invite becomes Round 1, recruiter-call pings do not carry over.
C4 ASSUMPTION: reminders use a date trigger; no exact-alarm permission.
D-A round.order_at defaults to starts_at; round numbers sort by it; 'Place it as Round N' sets it to a midpoint. D-B Pending and ping state follow the latest done counted round, even if a newer round is Didn't happen. D-C Match points: alias 2, recruiter domain 2, title 2; attach needs 3+ and no second company at 3+. D-D First sync reads 14 days back, later syncs 60; always 120 ahead. D-E Calendar descriptions are never stored, only the extracted link and phone. D-F Backup excludes the calendar cache, review and ignored items, selected calendar ids and last_sync. Other ASSUMPTIONs: one recruiter per company; reminders 15 min / 1 hour (default) / 1 day before; none for recruiter calls.

RULES FOR YOU (strict)
1. Pasted Part 2 code and spec text are the source of truth: verify and test them, never redesign them; if you think one has a bug, say so and wait. Use only rules, columns, types and function names given in this chat. If something you need is not given, reply 'MISSING: <what>' and stop. Do not invent it.
2. Never guess an Expo/RN API name, option or signature. If unsure for my SDK version, write 'UNVERIFIED: <api>' and tell me which docs page to paste.
3. Add no dependencies.
4. Label every assumption 'ASSUMPTION'.
5. Touch only the files listed under FILES. Never rewrite a whole existing file: give a unified diff or exact old/new blocks.
6. New files: path as a heading, then the full file. Maximum 3 new files per reply; if more are needed, state the order and do the first batch.
7. Put the decision id (D#, C#, D-A to D-F) in a short comment where it is implemented. Use an R-number only if it appears in text I pasted.
8. Do not recap my input. Keep replies short.
9. End every reply with: (a) acceptance checklist ticked or unticked, (b) the exact command or action I should run, (c) all UNVERIFIED items.
```

## Phase prompts

Each block goes after the Master Context. Fill the `<...>` placeholders. The line above each block says what to paste with it.

### P0: Setup and calendar spike (4h)

Paste with it: your `package.json` `dependencies` object only (after the first create).

```
TASK: Phase 0.
1. Commands to create an Expo app with Router + TypeScript, set tsconfig strict, add jest-expo with one passing test.
2. Configure an EAS development build for Android and the steps to install it on my phone.
3. Three tab placeholders: Home, Companies, Settings.
4. A temporary Spike screen: a button that requests calendar permission, then lists event titles from the calendar named 'Job search' only, window past 60 days to next 120 days. Log raw event objects only when __DEV__.
FILES: package.json (scripts), tsconfig.json, app/_layout.tsx, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx, app/(tabs)/companies.tsx, app/(tabs)/settings.tsx, app/spike.tsx, tests/smoke.test.ts
OUT OF SCOPE: database, theme, any real UI.
DONE WHEN: APK runs on my phone; npm test passes; Spike shows my real events; denying permission does not crash.
```

### P1a: Database client and migration (2h)

Paste with it: **Part 2 sections 1, 2 and 4** (schema, types, `client.ts`, `bus.ts`, `useData.ts`, `bundles.ts`).

```
TASK: Phase 1a. Implement the SQLite layer from the pasted Part 2 code. Copy it; do not redesign it. Apply ONLY these four changes:
(1) getDb() race: concurrent first calls must share one opening promise (cache the promise, not the db), so migrations never run twice.
(2) Add jd_words INTEGER to company in migration 001. loadBundles must not select jd_text: use substr(jd_text,1,300) AS jd_preview. Add jdPreview and jdWords to the Company type and keep jdText out of Bundle.
(3) MIGRATIONS is an array of SQL strings exported from src/db/migrations/index.ts; 001_init.ts holds the DDL.
(4) Add the missing React and bus imports in useData.ts.
FILES: src/db/client.ts, src/db/migrations/index.ts, src/db/migrations/001_init.ts, src/db/bus.ts, src/hooks/useData.ts, src/types/entities.ts, src/db/repos/bundles.ts, app/_layout.tsx (init DB, then render the stack)
RULES: foreign_keys ON at every open (Part 2 client.ts). Keep order_at as in the schema (D-A).
OUT OF SCOPE: actions.ts (added in P3), domain files, UI, seed data.
DONE WHEN: app starts; tables exist; restart keeps them; opening the DB twice in parallel runs migrations once.
```

### P1b: Domain logic, tests first (3h)

Paste with it: **Part 2 section 3** (`time.ts`, `rounds.ts`, `pings.ts`, `home.ts`), **section 7** (`links.ts`) and **section 8** test cases.

```
TASK: Phase 1b. Part 2 already contains these files. Do not redesign them. For each file: (a) confirm it compiles under strict TypeScript and list anything you changed, (b) write its Jest tests from the pasted section 8 cases, (c) report any case where the code and a decision disagree, and wait.
FILES (one at a time, in this order): src/domain/time.ts, rounds.ts, pings.ts, home.ts, src/utils/links.ts and tests/time.test.ts, rounds.test.ts, pings.test.ts, home.test.ts, links.test.ts
CASES: roundNumber, orderAtFor, waitingTarget, pendingBubble (include 23:30 checked at 00:30 next day = 1 day), pingBubble, buildHome; safeHttps, telUri, mailUri.
RULES: pure functions only. Decisions in play: D1, D2, D3, D4, D5, D8, D13, D15, C1, C2, C3, D-A, D-B. Part 2 names the file rounds.ts; there is no numbering.ts or status.ts yet.
DECIDED: counted() excludes rounds with changeFlag 'cancelled', so a cancelled round has no number, never counts as done or pending, and never appears as upcoming. Add tests for it.
OUT OF SCOPE: repositories, screens, matching, diff, extract.
DONE WHEN: npm test passes.
```

### P1c: Seed data (1h)

Paste with it: nothing. The spec has no seed table, so the values below come from the screenshots; dates are offsets from today so the screens always look like the design.

```
TASK: Phase 1c. Add a dev-only 'Load sample data' button (rendered only if __DEV__) that clears all tables and inserts the data below through parameterized inserts. Dates are offsets from the start of today.
- Umbrella Labs, role SDE II, notes 'Discussed scaling the job queue. Ask about team structure.', recruiter Raj Mehta +91 90000 00001 raj@umbrella.example. Rounds (manual, online unless stated): Recruiter screen today-15d phone approved; Technical today-11d didnt_happen, label note 'interviewer didn't join'; Technical today-8d pending. Pings on the 8-day round: today-2d and today-5d, channel mark. JD text of about 1,850 words (generate filler with the five headings About, Responsibilities, Requirements, Nice to have, Benefits).
- Wayne Tech, role Backend Engineer, recruiter Sanjay Rao +91 90000 00002 sanjay@wayne.example, one recruiter_call today-4d phone, said 'will schedule the next step'. No rounds, no pings.
- Globex, role Platform Engineer: one walk_in round 'HR round' today-1d, pending, no pings.
- Acme Corp, role Senior Backend Engineer, recruiter Priya Sharma +91 90000 00000: rounds 1 to 3 approved on today-30d, today-23d, today-16d; round 4 starts now+2h15m, ends one hour later, online, link https://meet.google.com/abc-defg-hij (ASSUMPTION), pending.
- Initech, role Backend Developer: status rejected, reason round, rejected_after_round 1, one rejected round.
- Hooli, role Staff Engineer: status rejected, reason round, rejected_after_round 4, four rounds, the last rejected.
Use the schema in the pasted Part 2 (order_at = starts_at, D-A).
FILES: src/db/seed.ts, app/(tabs)/settings.tsx (diff, dev button only)
DONE WHEN: after tapping, the data survives an app restart; Umbrella has Round 1, a Didn't-happen round with no number, and Round 2 (D1).
```

### P2: UI kit and Companies tab (5h)

Paste with it: spec section 3.2, the Companies screenshot text, and the signatures from Part 2 `pings.ts` and `rounds.ts`.

```
TASK: Phase 2. Build tokens, components, the Companies screen and its row logic.
FILES: src/theme/tokens.ts, src/domain/status.ts (+ tests/status.test.ts), src/components/Bubble.tsx, Button.tsx, Card.tsx, Chip.tsx, CompanyRow.tsx, src/hooks/useCompanies.ts, app/(tabs)/companies.tsx
RULES: Part 2 has no status.ts, so you write it: companyRow(bundle, now) returns { statusLine, bubbles }. Formats from the screenshot: 'Last round 23 Oct · Technical', 'Recruiter call 27 Oct · not scheduled', 'Round 3 approved · round 4 today' with an 'Interview today' bubble, and for rejected rows rejectedLabel from pings.ts (D13). Label every format you infer ASSUMPTION. Use pendingBubble and pingBubble from pings.ts; a company whose latest round already has a result shows no ping bubble. Bubble tones are only blue, green, grey, red, amber (the Part 2 Bubble type). One teal accent; min touch size 48; no animation. Sections Active and Rejected with counts. Search is a JS filter over loadBundles() on name, role, recruiter name and email, not SQL (Part 2 section 4).
OUT OF SCOPE: navigation to detail (stub it), Home.
DONE WHEN: matches the screenshot with seed data; holds at 360px and 430px.
```

### P3: Company detail (5h)

Paste with it: spec sections 3.3 and 3.7, the Company detail and Wayne Tech screenshot text, and Part 2 `actions.ts`.

```
TASK: Phase 3. Company detail screen, including the recruiter-call-only view.
FILES: app/company/[id]/index.tsx, src/hooks/useCompany.ts, src/components/StatTile.tsx, RoundRow.tsx, src/db/repos/actions.ts
RULES: Copy markPinged, setResult, notMovingForward and reopenCompany from the pasted actions.ts unchanged. Rounds card oldest first with numbers from roundNumber (D1). Under the latest pending round: Mark approved, Mark rejected, Interview didn't happen. Rejecting stores rejected_after_round (R23); Reopen keeps results and rounds (D9). Follow up card uses waitingTarget, pingBubble and pingDates; Mark as pinged calls markPinged with channel 'mark' (D8). A company with no counted rounds shows the timeline view (spec 3.7, D2, C1): Recruiter call done, Interview not scheduled yet, red Not moving forward, and Check fit as the email template. Recruiter card: Copy number, Copy email, Call (telUri). Notes card is editable text saved on blur. Calendar rounds are read-only; the JD card is a placeholder.
OUT OF SCOPE: email screen, JD card, rename, merge, move round, edit and delete round.
DONE WHEN: Umbrella shows Round 1, Didn't happen (no number), Round 2; Mark approved removes the ping bubble; Mark rejected shows 'out after round 2'; Reopen restores Active; Wayne shows Awaiting schedule and the timeline.
```

### P4: Home (5h)

Paste with it: spec section 3.1, the Home screenshot text, and Part 2 `home.ts` (`buildHome` and its return shape).

```
TASK: Phase 4. Home screen, driven only by buildHome output (Part 2 home.ts). No per-card queries.
FILES: src/hooks/useHome.ts, app/(tabs)/index.tsx, src/components/NextCard.tsx, WaitingCard.tsx, FloatingAdd.tsx
RULES: buildHome returns { next, upcoming, waiting, previous, openReviews, changed }. Next card: countdown refreshed every minute, Join (safeHttps only) and Copy link, recruiter row with Call (D4). Waiting for result lists every waiting item, recruiter-call-only companies included (D3, C1). Previous shows the last result, max 5 (ASSUMPTION already in home.ts). Banners: amber for openReviews; a placeholder for the blue one. 'Updated just now' reads the last_sync setting. Floating '+ Add interview' pill with scroll padding of at least the pill height plus the tab bar. Where the screenshot disagrees with a decision (Globex shown under Previous), the decision wins.
OUT OF SCOPE: calendar, review flow, Add screen (stub route).
DONE WHEN: seed data reproduces the screenshot with Globex under Waiting; the empty state shows Add and Settings actions.
```

### P5: Add interview (4h)

Paste with it: spec section 3.4, the Add interview screenshot text, and the Part 2 `round`, `recruiter_call`, `recruiter` and `ping` tables.

```
TASK: Phase 5. Add interview screen.
FILES: app/add.tsx, src/domain/validation.ts (+ tests), src/db/repos/actions.ts (add addRound, addRecruiterCall, updateRound, deleteRound)
RULES: Walk-in, Offline, Phone and Online map to round.type. 'Recruiter call (no interview yet)' creates a recruiter_call row, not a round (D2). Company and date are required; time is optional. A new manual round has source 'manual' and order_at = starts_at (D-A). Add an optional 'Round name' field (e.g. Technical round) saved to round.label; empty means the default 'Interview'. Company match: case-insensitive exact name reuses the company, otherwise create one. ASSUMPTION: a second role at the same company needs a different company name (D10). Recruiter name and phone save to the recruiter row. Edit and delete manual rounds only; deleting a round also removes its pings (schema trigger).
OUT OF SCOPE: reminders (P10), calendar.
DONE WHEN: 'umbrella labs' reuses Umbrella; a recruiter call shows Awaiting schedule; the other types create rounds; deleting a round leaves no ping behind.
```

### P6: Follow-up email and signature (4h)

Paste with it: spec section 3.6, the Follow-up email screenshot text, and Part 2 section 7 (`mailUri`).

```
TASK: Phase 6. Email screen plus signature setting.
FILES: src/domain/email.ts (+ tests), app/company/[id]/follow-up.tsx, src/services/mail.ts, src/db/repos/settings.ts, app/(tabs)/settings.tsx (diff, signature card only)
RULES: The Follow up body is exactly the screenshot text: 'Hi {firstName},' then 'Thank you for the {round} on {date} for the {role} role at {company}. I enjoyed the discussion and remain very interested.' then 'Could you share an update on the next steps?' then the signature. The spec describes Reschedule (I joined at the scheduled time, the interview did not take place, please share a new slot) and Check fit (thanks for the first call, they said they would schedule the next step, asks for an update and whether my profile fits) only in prose: draft both bodies from that prose, label them ASSUMPTION, and show them to me before finalising. Subjects: 'Following up: {role}, {round}' (screenshot); 'Rescheduling: {role}, {round}' and 'Following up: {role}, recruiter call' (both ASSUMPTION). Check fit is the default for recruiter-call-only companies, and the ping targets the recruiter call (C2). A missing recruiter email leaves To empty with a note. Copy text and Open in Mail each write a ping through markPinged with channel 'copy' or 'mail' (D8); mailUri validates the address. The text stays editable.
DONE WHEN: the Umbrella output matches the screenshot character for character; both buttons add exactly one ping.
```

### P7: Calendar read (5h)

Paste with it: Part 2 `extract.ts`, `toCalEvent`, the section 8 `extract` and `keywordMatcher` cases, spec section 3.9, **and** the current expo-calendar docs page for your SDK.

```
TASK: Phase 7. Calendar permission, calendar picker, keyword chips, extraction, event cache.
FILES: src/services/permissions.ts, src/services/calendarSync.ts (toCalEvent and the read only; no sync yet), src/domain/extract.ts (+ tests), src/db/repos/calendarEvents.ts, src/db/repos/settings.ts (diff), app/(tabs)/settings.tsx (diff, Calendars and Keywords cards), app/debug-events.tsx (temporary)
RULES: Copy extract.ts and keywordMatcher from the pasted Part 2; write the tests from the section 8 cases (Meet, Zoom, Teams; '+91 90000 00000'; a Zoom meeting ID is not a phone; HTML stripped; 'HR round' matches; 'three' does not match 'HR'). No calendar ticked by default; ticking shows a one-line employer-calendar warning. Request permission on first use, not at launch. Window: first read 14 days back, later reads 60 days back, always 120 ahead (D-D). Never store event descriptions, only the extracted link and phone (D-E). Use only the pasted expo-calendar docs for API calls and flag anything else UNVERIFIED (organizerEmail is Android-only).
OUT OF SCOPE: matching, diff, banners.
DONE WHEN: only the ticked calendar is read; a Meet link and phone are extracted from a real event; denying permission shows the access card and does not crash.
```

### P8a: Matching and review (5h)

Paste with it: Part 2 `matching.ts` and the `matchEvent` cases, spec section 3.5, and the Which company? screenshot text.

```
TASK: Phase 8a. Event matching and the review flow.
FILES: src/domain/matching.ts (+ tests), app/review/index.tsx, app/review/[eventId].tsx, src/db/repos/review.ts, src/components/Banner.tsx
RULES: Copy matching.ts from the pasted Part 2 and write the tests from the section 8 matchEvent cases (D-C); do not tune ATTACH_AT. Which company?: no company pre-selected (D7), even though the screenshot shows one. List every active company, those in `ranked` first in that order, the rest alphabetical. The 'Place it as' chips appear after a company is chosen and default to defaultPosition; save the round with order_at from orderAtFor (D-A). 'Create new company' only on confirm, name prefilled from suggestedName and editable (D6). Save aliases lowercased, because matching compares lowercase. Decide later keeps the item open; Not an interview writes ignored_event (D11). The amber banner shows the open count.
OUT OF SCOPE: sync, diff, blue banner.
DONE WHEN: a generic event goes to review with nothing pre-selected; placing it creates a round with the chosen number and later rounds renumber.
```

### P8b: Sync, banners, changes (5h)

Paste with it: Part 2 `diff.ts`, `syncCalendar` with its helper rules, the `diffEvents` cases, spec section 2.8, and the P8a handoff note.

```
TASK: Phase 8b. Idempotent sync.
FILES: src/domain/diff.ts (+ tests), src/services/calendarSync.ts (add syncCalendar and its helpers), src/hooks/useSync.ts, app/(tabs)/index.tsx (diff), app/(tabs)/settings.tsx (diff, Refresh now)
RULES: Copy diff.ts and syncCalendar from the pasted Part 2, then implement its helper rules exactly: attachRound links to an existing round within one minute instead of inserting; type is online when a link exists, otherwise offline; flagMoved and flagCancelled act on a round only if one exists; a refresh never writes notes, result or ping. Triggers: app focus debounced 60 s, both Refresh buttons, pull-to-refresh. Blue banner with Change and Undo for rounds with auto_added_at (existing companies only, D6). Moved or cancelled rounds show a flag with Accept and Keep, never a silent change. A cancelled round also shows a Reopen button that clears change_flag so it counts again. When an invite attaches to a recruiter-call-only company it becomes Round 1 and recruiter-call pings stop applying (D2, C3). DECIDED: attachRound prefills the recruiter row from the event: email from organizerEmail and phone from the extracted phone, only into empty fields, never overwriting what I typed. Name stays empty because CalEvent has no organizer name. Add a test.
DONE WHEN: refreshing twice changes nothing; notes and results survive; a moved invite shows a flag; 'Not an interview' stays hidden until its time or organizer changes.
```

### P9: Job description (4h)

Paste with it: spec sections 3.3 (JD card), 3.8 and 3.10, and the two JD screenshot texts.

```
TASK: Phase 9. Job description card, full screen, edit screen.
FILES: src/domain/jd.ts (+ tests), app/company/[id]/jd.tsx, app/company/[id]/jd-edit.tsx, src/components/JdCard.tsx, src/db/repos/companies.ts (read and save JD)
RULES: Card: a 2 to 3 line preview from jd_preview, the word count in the header, and small Edit and View full screen icon buttons (spec 3.3; the old chevron is replaced). Full text loads only on the two JD screens. Full screen (3.8): Find in description searches the pasted text only and highlights matches; jump chips are built from lines matching About, Responsibilities, Requirements, Nice to have, Benefits (short line, no trailing period) and are hidden when none are found; buttons Copy text, Edit, Open posting (safeHttps only). Edit (3.10): Paste new replaces the text with the clipboard, Clear, live word count, https-only posting link, Save description pinned at the bottom, Cancel discards. Save writes jd_text, jd_link and jd_words. Very long text renders by paragraph in a FlatList.
DONE WHEN: the Umbrella sample shows five chips; find highlights matches; saving refreshes the preview and word count.
```

### P10: Rename, merge, move round, reminders (4h)

Paste with it: Part 2 `moveRound` and `mergeCompanies`, spec section 3.3 (company menu), **and** the current expo-notifications scheduling docs for your SDK.

```
TASK: Phase 10. Company menu actions and reminders.
FILES: src/db/repos/actions.ts (add moveRound, mergeCompanies, renameCompany), app/company/[id]/index.tsx (diff, menu only), src/services/notifications.ts, src/db/repos/notificationMap.ts
RULES: Copy moveRound and mergeCompanies from the pasted Part 2 unchanged (D12); add renameCompany. Company menu: Rename, Merge with another company, Reopen, Not moving forward. Every round has Move to another company (its result, pings and notes go with it). Reminder = start minus the setting (15 min / 1 hour default / 1 day) using a date trigger (C4); store the notification id in notification_map; cancel and reschedule on edit or delete; skip if the time has passed; manual rounds only, never recruiter calls; the text shows company and time only. Ask for notification permission when the first manual round is saved. Use only the pasted expo-notifications docs and flag anything else UNVERIFIED.
DONE WHEN: merge moves rounds, pings and notes and removes the source; a 2-minute test reminder fires on the phone.
```

### P11: Backup (4h)

Paste with it: Part 2 section 6 in full (backup export, validation, restore) and the `parseBackup` cases from section 8.

```
TASK: Phase 11. Export and import.
FILES: src/services/backup.ts, src/domain/backup.ts (+ tests for parseBackup), app/(tabs)/settings.tsx (diff, Backup card)
RULES: Copy parseBackup and restore from the pasted Part 2, then finish what it leaves out: validators for recruiter, recruiter_call and alias (same pattern; without them a restore silently drops that data), and jd_words, recomputed from jd_text on restore. Export dumps each table with SELECT *, skips calendar_event, review_item, ignored_event and the settings keys in D-F (D14). Also write the readable text summary and say in it that the file is unencrypted. Check the file size on disk before reading it into memory. Restore runs in one transaction behind a confirm dialog that shows counts. After a successful restore, cancel all scheduled notifications and clear notification_map, because they point at deleted rounds. DECIDED: the backup includes the settings for signature, keywords and reminder minutes (use the key names from settings.ts), validated by type and length: keywords an array of short strings, reminder one of 15, 60, 1440. Add a settings validator and tests.
DONE WHEN: export then import keeps all data; wrong version, http link, bad enum, wrong type and oversized file are each rejected; a failed import changes nothing.
```

### P12: Hardening (5h)

Paste with it: the device checklist from the phased plan.

```
TASK: Phase 12. Walk the 19-item device checklist I paste. For each item that fails or has no code path, name the file and give a diff. Add empty/error states, set android.allowBackup false, strip logs from release, write a README with export/restore steps.
RULES: no new features. Anything outside the spec goes on a 'Later' list.
```

## Helper prompts

**Handoff note (ask at the end of every phase):**

```
Write a Handoff note, max 150 words: files created or changed this phase; exported function and type signatures only (no bodies); decisions or ASSUMPTIONs I made; known gaps. Nothing else.
```

**Bug prompt:**

```
TASK: Fix this bug only. Change the fewest lines.
EXPECTED: <one line>
ACTUAL: <one line>
<error>
[raw stack trace from Metro]
</error>
<current_code file='src/...'>
[only the failing function or component]
</current_code>
RULES: give a diff; if the cause isn't visible in what I pasted, reply 'MISSING: <file or symbol>' instead of guessing.
```

**When Claude drifts:**

- Invented a rule: reply `Which pasted line says that? If none, remove it and reply MISSING.`
- Unsure API call: reply `Mark this UNVERIFIED and tell me the docs page to paste.`
- Rewrote a whole file: reply `Redo as a diff against the file I pasted.`
- Chat getting long (about 15 turns): ask for the Handoff note and start a fresh chat.

## Tip.md alignment

This follows your split-identity tip: architecture stays in the Architect chat, and each Builder chat gets only the Master Context, one phase prompt, and a handoff note. Keep the Master Context at the very top of every thread so caching works, and never edit it mid-chat.
