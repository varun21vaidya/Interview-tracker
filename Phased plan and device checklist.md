# Part 3: Phased plan and device checklist

## Two corrections to Part 2
1. **Job description size (R42):** `loadBundles` must not read the full `jd_text` for every company. Select `substr(jd_text,1,300) AS jd_preview` and add a `jd_words INTEGER` column to the migration, set when you save. Load the full text only on the two JD screens.
2. **Build type:** use an EAS development build from Phase 0, not Expo Go. Calendar and notification behaviour differ in Expo Go. Check the current Expo docs for this.

## Pace
- **Estimate:** about 64 hours of work plus about 10 hours of buffer, so roughly 16 weeks at 4 to 5 hours a week.
- **Order:** the app is built on seed data first, so every phase ends with something you can open on your phone. The riskiest part, the device calendar, gets a one-hour spike in Phase 0 so surprises show up early.

## Phases

**P0 · Setup and calendar spike (4h)**
- **Build:**
  - Install Node, create an Expo app with the Router and TypeScript template, and make the first EAS build and install it on your phone.
  - Add the three tab placeholders, Jest, and strict TypeScript.
  - Add a temporary button that reads your Job search calendar and lists event titles on screen.
- **RN concepts to learn:** `View` and `Text`, flexbox (column by default), `StyleSheet`, `FlatList` vs `ScrollView`, safe-area insets, props and `useState`.
- **Done when:** the APK runs on your phone, `npm test` passes, and you can see your real events.

**P1 · Database, domain logic, seed data (5h)**
- **Build:**
  - Add `client.ts`, migration 001 with the fix above, and the `time`, `rounds`, `pings`, and `home` domain files from Part 2.
  - Add a dev-only "Load sample data" button that inserts the spec's companies: Umbrella, Wayne, Globex, Acme, Initech, Hooli.
- **Tests:** the `roundNumber`, `waitingTarget`, `pendingBubble`, `pingBubble`, and `buildHome` cases from Part 2, section 8.
- **Done when:** the tests pass, and after tapping the seed button the data is still there after a restart.

**P2 · UI kit and Companies tab (5h)**
- **Build:**
  - Add `tokens.ts` (one teal, 48px minimum touch size) and the `Bubble`, `Button`, `Card`, `Chip`, and `CompanyRow` components.
  - Build the Companies screen with search and the Active and Rejected sections.
- **Done when:** the screen matches the screenshot, search filters on name, role, and recruiter, and the layout holds at 360px and 430px width.

**P3 · Company detail (5h)**
- **Build:**
  - Rounds card with result bubbles and numbers, stat tiles, the three result buttons, and the Follow up card with Mark as pinged.
  - Recruiter card with Copy and Call, notes, the Reopen button, and the Wayne Tech timeline with Not moving forward.
- **Done when:**
  - Umbrella shows Round 1, Didn't happen with no number, and Round 2.
  - Mark approved removes the ping bubble.
  - Mark rejected shows "out after round 2".
  - Reopen restores the company to Active.

**P4 · Home (5h)**
- **Build:**
  - Next interview card with a countdown that refreshes each minute.
  - Join and Copy link, a recruiter row with Call, the upcoming list, and Waiting for result (Wayne included).
  - Previous section and the floating Add pill with enough bottom padding.
- **Done when:** the seed data reproduces the Home screenshot, with Globex under Waiting.

**P5 · Add interview (4h)**
- **Build:**
  - All five types, with Company and Date required.
  - An existing company is matched by case-insensitive exact name. A new name creates a new company.
  - Edit and delete manual rounds.
- **Done when:** a recruiter call creates "Awaiting schedule" and the other types create rounds. Typing "umbrella labs" reuses Umbrella.

**P6 · Follow-up email and signature (4h)**
- **Build:**
  - Three templates using the spec wording. The subjects are Follow up: `Following up: {role}, {round}`, Reschedule: `Rescheduling: {role}, {round}`, and Check fit: `Following up: {role}, recruiter call`. The last two are ASSUMPTION.
  - Signature setting.
  - Copy text and Open in Mail both write a ping, with channels `copy` and `mail`.
- **Tests:** each template output matches the Umbrella screenshot text, and a missing recruiter email leaves To empty with a note.
- **Done when:** the Umbrella email matches the screen and both buttons add a ping.

**P7 · Calendar read (5h)**
- **Build:**
  - Permission flow and the calendar picker with no default ticks and the employer warning.
  - Keyword chips, extraction, and the event cache. Show cached events on a temporary debug list.
- **Tests:** the `extract` and `keywordMatcher` cases.
- **Done when:** only the ticked calendar is read, a Meet link and phone are extracted from a real event, and denying permission shows the access card without crashing.

**P8a · Matching and review (5h)**
- **Build:**
  - `matchEvent`, the Which company? screen (nothing pre-selected, list sorted by `ranked`), the Needs review list, and the amber banner.
  - Alias saving, Decide later, and Not an interview.
- **Tests:** the `matchEvent` cases.
- **Done when:** a generic event goes to review and placing it creates a round with the chosen number.

**P8b · Sync, banners, changes (5h)**
- **Build:**
  - `diffEvents`, `syncCalendar`, and triggers on app focus (debounced 60 seconds), the Refresh buttons, and pull-to-refresh.
  - Blue auto-add banner with Change and Undo, moved and cancelled flags with Accept and Keep, and an invite adding Round 1 to Wayne Tech.
- **Tests:** the `diffEvents` cases.
- **Done when:** running refresh twice changes nothing, a moved invite shows a flag instead of changing silently, and "Not an interview" stays hidden until its time changes.

**P9 · Job description (4h)**
- **Build:**
  - Company card preview with Edit and Full screen icons.
  - Full screen with find and jump chips. Chips come from lines matching About, Responsibilities, Requirements, Nice to have, or Benefits (short line, no trailing period).
  - Edit screen with Paste new, Clear, a live word count, and an https-only link.
  - For very long text, render paragraphs in a `FlatList`.
- **Done when:** the Umbrella sample shows five chips, find highlights matches, and saving refreshes the preview.

**P10 · Rename, merge, move round, reminders (4h)**
- **Build:**
  - Company menu with Rename and Merge, and Move round.
  - Reminders: schedule at start minus the reminder setting using a date trigger. Store the notification id in `notification_map`. Cancel and reschedule on edit or delete. Skip if the time has passed. Show company and time only. Ask for notification permission when the first manual round is saved.
- **Done when:** merge moves rounds, pings, and notes and deletes the source, and a 2-minute test reminder fires on the phone.

**P11 · Backup (4h)**
- **Build:** `buildBackup`, the summary text file, the share sheet, `parseBackup`, and `restore` behind a confirm dialog that shows counts.
- **Tests:** the `parseBackup` cases and an export-then-import comparison of counts.
- **Done when:** a round trip on the phone keeps all data, a bad file is rejected, and nothing changes after a failed import.

**P12 · Hardening and real use (5h, then 1 week of use)**
- **Build:** empty and error states, the 360px and 430px checks, release build settings (`allowBackup` off), the README, and an APK for daily use.
- **Done when:** the device checklist below is complete and you've used it with real data for a week.

## Testing approach
- **Jest** covers only the pure logic and the backup validator. That is where the bugs would hide, and it needs no phone.
- **Database writes and screens** are checked on the device with the seed data and the checklist. I'm skipping repository unit tests to keep tooling simple.

## Device checklist

| # | Check |
|---|---|
| 1 | Fresh install shows the Home empty state with Add and Settings actions |
| 2 | Calendar permission denied shows the access card, and manual entries still work |
| 3 | Only the ticked calendar is read, and ticking shows the warning |
| 4 | Generic event goes to Needs review with nothing pre-selected |
| 5 | An unknown company name stays in review and no company is created until confirmed |
| 6 | Organizer and domain match plus an alias attaches automatically with Undo |
| 7 | Not an interview stays hidden after refresh and reappears when its time changes |
| 8 | Didn't happen round has no number and no bubble |
| 9 | Pending counts across midnight correctly, and a round today reads "today" |
| 10 | Copy text, Open in Mail, and Mark as pinged each add one ping |
| 11 | Approving the latest round removes the ping bubble |
| 12 | Reopen keeps results and rounds renumber correctly |
| 13 | Merge moves rounds, pings, and notes and removes the source |
| 14 | Recruiter-call-only company: awaiting bubble, then an invite becomes Round 1 |
| 15 | Refresh twice makes no duplicates and keeps notes and results |
| 16 | Manual reminder fires, with battery saver on and off |
| 17 | Export then import keeps everything, and a corrupt file is rejected cleanly |
| 18 | Layout is usable at 360px and 430px (use the phone's display-size setting) |
| 19 | Floating Add pill never hides a button when scrolled to the end |

## Main risks

| Risk | Mitigation |
|---|---|
| First React Native project runs slower than planned | Phase 0 basics and the buffer hours. Don't skip the seed-data approach. |
| Calendar fields differ on your phone | Phase 0 spike. Log raw events in dev builds. |
| Wrong company match | Two signals required, plus Undo and the review flow. |
| Expo version changes break the build | Pin versions after Phase 0 and upgrade only between phases. |
| Data loss on phone reset | Export reminder each month (ASSUMPTION) and the README restore steps. |
| Scope creep | Anything outside spec section 7 goes on a "Later" list. |

## Definition of done for v1
- All ten screens match the design.
- The spec rules hold, as changed by our decisions.
- The Jest suite and the device checklist pass.
- You've used it for a week with real data.
- One export and import has been tested.