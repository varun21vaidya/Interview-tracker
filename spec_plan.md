# Interview Tracker: Final MVP Spec and Screens

Personal Android app that tracks every interview process by company. Built from the scoping chat and the 10-screen design. Where the two disagreed, the latest instruction wins.

Every screen section below holds the screenshot from the 10-screen design PDF and the full spec for that screen: layout, every button, every rule.

## 1. Product summary

**What it is:** an Android-only personal app that reads interview events from Google Calendar, lets you add walk-ins, offline rounds, phone calls and recruiter calls by hand, groups everything by company, and tracks results, follow-ups and notes.

**Why not just Google Calendar:** Calendar shows events by date. This app adds company grouping, per-round results, recruiter details, job description, notes, follow-up (ping) tracking, search, and entries that never had an invite.

**Locked decisions**

- Android only. Expo, React Native, TypeScript.
- Local storage in SQLite on the phone. No backend, no hosting, no login.
- No Claude API and no AI. Parsing is rule-based.
- Google Calendar is read-only. The app never writes to or edits the calendar. No Google OAuth or Google Cloud project: it reads calendars already synced to the phone.
- Gmail integration is out of v1.
- Light theme, one teal accent. No dark mode or animations in v1.
- Minimal scope, minimal manual work.

**Suggested libraries:** expo-sqlite, expo-calendar (read), expo-notifications (local), expo-clipboard, expo-linking (tel:, mailto:, maps, meeting links), expo-document-picker and expo-sharing (export/import), expo-file-system.

## 2. Core concepts and rules

### 2.1 Company

Name, role, recruiter (name, phone, email), job description (text and link), notes, status (Active or Rejected), reminder state. A company groups rounds from calendar events and manual entries.

### 2.2 Round

A round is one interview event. Sources: Calendar (read-only) or Manual (editable). Round numbers are never typed: they are counted by date within a company. Moving a round to another company recounts both companies automatically.

A round is **done** once its time has passed.

### 2.3 Round result

Each past round has one result:

- **Result pending** (default after the round happens), blue bubble.
- **Approved**, green bubble. Stays in the list, counts in "rounds approved".
- **Rejected**, red bubble. Moves the whole company to the Rejected section.
- **Didn't happen** (joined but nobody showed up, or the call fell through), amber bubble. Not counted as approved, creates no pending result and no ping tracking, company stays Active.

### 2.4 Pending and ping logic (final version)

Follow-up and result pending were merged. There is no automatic follow-up suggestion, no overdue state and no colour change by age. You decide when to chase.

- **Pending bubble** shows the wait from the last round from day one, for example "Pending · 1 day", "Pending · 8 days". It stays blue.
- **Mark as pinged** is a button. It always reads "Mark as pinged". Tapping it records today as a ping.
- **Ping bubble** is separate from the button and shows the last ping: "Pinged today", "Pinged 1 day ago", "Pinged 2 days ago". It is green once pinged.
- Before any ping on the latest round, the bubble reads "Haven't pinged yet" (grey).
- Ping status applies to the **latest round only**. When the result for that round is set (for example approved), the ping bubble disappears. When the next round happens, "Haven't pinged yet" appears again and earlier pings do not carry over.
- Opening the follow-up email counts as a ping.
- Ping dates are listed on the company page, for example "Pinged: 29 Oct, 26 Oct".
- A round marked "Didn't happen" has no pending or ping state.

### 2.5 Recruiter call only (no interview yet)

Used when a recruiter called and said they will schedule something, but no round exists.

- Created via the "Recruiter call (no interview yet)" type on the Add screen.
- Company shows an "Awaiting schedule · N days" bubble and the same ping bubble and rules as a pending round.
- Timeline shows the recruiter call as done and the interview as "Not scheduled yet".
- "Not moving forward" moves the company to Rejected.
- When the invite arrives, a calendar refresh adds it to this company as round 1 with no re-entry.

### 2.6 Rejected section and reopen

A rejected round or "Not moving forward" moves the company to the Rejected section. Rejected companies show in grey with "out after round X" and keep full history. A **Reopen** button on the company page moves it back to Active (re-interview or a different role).

### 2.7 Company matching from calendar events

This is the biggest risk, so the app flags doubt instead of guessing silently.

- Signals used: recruiter email or domain, organizer, a name you corrected earlier, and the event title (patterns like "Interview with Acme" or "Acme – Technical round").
- If the signals agree, the event is attached automatically.
- If they disagree, or the title is generic ("Technical round"), the event goes to **Needs review** and nothing is attached.
- Every automatic addition shows a banner such as "New round added to Umbrella Labs" with **Change** and **Undo**.
- Once you place an event, later refreshes never move it back.
- Your choices are remembered as aliases (same organizer email or title pattern suggests the same company first; the app still asks when unsure).
- Remaining risk: two roles at one company, or one recruiter working for several companies. The review flow covers these.

### 2.8 Calendar refresh

- Automatic: re-read on app open and on return from another app.
- Manual: Refresh button on Home and Refresh now in Settings.
- Pull-to-refresh on Home and Companies.
- Picks up new events, moved or cancelled rounds, changed meeting links.
- Moved or cancelled rounds are flagged for you, never silently changed.
- Never touches notes, results or ping history.
- A new interview found shows a blue banner above the Next interview card, for example "New interview found: Stark Industries, Screening call on Tue 4 Nov".

## 3. Screens

Navigation: bottom bar with three tabs (Home, Companies, Settings), each with icon and label, active tab highlighted. Add, Company detail, Follow-up email, Which company? and Full job description are pushed screens with a Back or Cancel.

| # | Screen | Reached from | Purpose |
| --- | --- | --- | --- |
| 3.1 | Home | Home tab (opens first) | Next interview, results waiting, pings, banners |
| 3.2 | Companies | Companies tab | Search, Active and Rejected lists |
| 3.3 | Company detail | Tap a company, banner or Home card | Rounds, results, follow-up, recruiter, JD, notes |
| 3.4 | Add interview | + Add interview on Home | Manual entries and recruiter calls |
| 3.5 | Which company? | Amber banner on Home | Place an event the app could not match |
| 3.6 | Follow-up email | Email follow-up button | Three mail templates |
| 3.7 | Recruiter call only | A company with no round yet | Chase a recruiter who has not scheduled |
| 3.8 | Full job description | Full-screen icon on the JD card | Read, search and jump through a long JD |
| 3.9 | Settings | Settings tab | Calendars, keywords, reminder, signature, backup |
| 3.10 | Edit job description | Edit icon on the JD card | Replace or correct the JD |

### 3.1 Home

&#91;image: Home screen\]

The first screen. It answers: what is next, and who am I waiting on.

- Heading "Next interview" with the date line ("Saturday, 31 Oct · Updated just now") and a Refresh button. Calendar is also re-read automatically on app open and on return from another app, and pull-to-refresh works on this screen.
- Banners sit between the heading and the card. Amber: "1 event needs your decision: Technical round, Tue 4 Nov. Tap to choose the company ›", which opens Which company? (3.5). Blue: "New interview found: Stark Industries, Screening call on Tue 4 Nov", shown when a refresh finds an event not yet in the app. Moved or cancelled rounds are flagged here too, never silently changed.
- **Next interview card** (teal outline): chips for source (Calendar or Manual) and Round N at top left, countdown at top right ("in 2h 15m"), then company, "Technical round · Senior Backend Engineer" and the time range. Join Meet is the filled primary button (Meet, Zoom or Teams link) with Copy link beside it. A divider, then the recruiter row (name, "Recruiter · phone") with a Call button.
- **Waiting for result** card: one entry per company with a pending result. Left side: company and "round · date". Right side, two stacked bubbles: Pending · N days (blue, shown from day one) above the ping bubble (green Pinged today, Pinged 2 days ago, or grey Haven't pinged yet). Buttons: Email follow-up (filled, opens 3.6) and Call side by side, then a full-width Mark as pinged. No suggestions and no overdue colours: you decide when to chase.
- **Previous** card: the last round, same layout, with its result bubble. A walk-in reads "HR round · 30 Oct · Walk-in".
- **+ Add interview** is a floating pill at bottom right above the tab bar. In the design it covers part of the Globex buttons, so the scroll area needs bottom padding of at least the pill height plus the tab bar.
- Bottom tab bar: Home, Companies, Settings with icons and labels; the active tab has a teal top line. Each tab is at least 48px tall and clears the phone's swipe area.

### 3.2 Companies

&#91;image: Companies screen\]

All companies in one list, split by outcome.

- Search bar at the top ("Search company, role or recruiter"), filters as you type. Pull down to refresh.
- Two sections, **Active** and **Rejected**, each with a count at right (4 and 2).
- Each row: company, role, and a status line ("Last round 23 Oct · Technical", "Recruiter call 27 Oct · not scheduled", "Round 3 approved · round 4 today").
- Bubbles at right: Pending · N days, Awaiting schedule · N days, Interview today, and the ping bubble (green Pinged, or grey Haven't pinged yet) where it applies. A company whose latest round already has a result shows no ping bubble (Acme Corp).
- Rejected rows are greyed, show the role and "out after round N" and a red Rejected bubble (Initech after round 1, Hooli after round 4). History stays; a Reopen button on the company page brings a company back.
- Tap any row to open Company detail (3.3).
- Later option: also search by words inside job descriptions.

### 3.3 Company detail

&#91;image: Company detail screen\]

Everything about one company, top to bottom.

- Back link "‹ Companies", company name, role, then the status and ping bubbles in one row. Rejected companies show a red Rejected bubble and a Reopen button.
- Two stat tiles: Rounds approved and Awaiting result.
- **Rounds card**, oldest first. Each row: round name, "date · mode" with a short note ("interviewer didn't join"), result bubble at right. Example: Recruiter screen, 16 Oct, Phone, Approved; Technical round, 20 Oct, Online, Didn't happen; Technical round, 23 Oct, Online, latest round, Pending · 8 days. Round numbers are counted by date, never typed.
- Under the latest pending round: Mark approved (green) and Mark rejected (red), then a full-width Interview didn't happen. Help line: rejected moves the company to Rejected; didn't happen is not counted and tracks no result or ping.
- Every round has a Move to another company action; its result, pings and notes move with it. Manual rounds can be edited or deleted. Calendar rounds are read-only (change them in Google Calendar).
- **Follow up card**: "Latest round: Technical, 23 Oct (8 days ago)", "Pings: 29 Oct, 26 Oct", Email follow-up (filled, opens 3.6), Call plus the recruiter's first name, and a full-width Mark as pinged. Help line: ping status tracks the latest round only and clears when you get its result.
- **Recruiter card**: name, phone and email on one line, Copy number and Copy email. Name and email are prefilled from the invite organizer, a phone number from the description when present; all editable.
- **Job description card** (final spec): a 2 to 3 line preview with the word count in the card header and two small icon-only buttons at the top right, Edit (opens 3.10) and View full screen (opens 3.8). A posting link, when saved, opens in the browser. The exported design still shows the earlier collapsed card with a chevron; the icons replace it.
- **Your notes card**: free text for prep, questions asked and feedback. Notes belong to the company, not the calendar event, so a rescheduled invite never detaches them.
- Company actions (menu): Rename, Merge with another company, Reopen, Not moving forward.

### 3.4 Add interview

&#91;image: Add interview screen\]

For anything the calendar does not have: walk-ins, offline rounds, WhatsApp-arranged calls and recruiter calls.

- Cancel link and "Add interview" heading. Type chips: Walk-in, Offline, Phone, Online, then a full-width "Recruiter call (no interview yet)" chip. The selected chip is filled teal.
- Company and date are required (marked \*). Optional: time, role, address or meeting link, contact name and phone, notes.
- The design shows the recruiter call form: Company \* ("e.g. Wayne Tech"), Role, Call date \* and Time side by side, Recruiter name and Recruiter phone side by side, "What did the recruiter say?" ("e.g. will schedule round 1 this week"). Help line: "Shows as Awaiting schedule until a round is added. You can follow up and track pings meanwhile."
- The other four types use the same pattern with the optional fields above; their forms were not exported.
- A saved address opens in Google Maps in one tap. Manual entries get a local reminder 1 hour before (set in Settings). Calendar events rely on Google's own reminders.
- Save is a full-width filled button pinned at the bottom. Fields and buttons are at least 48px tall.

### 3.5 Which company? (ambiguous events)

&#91;image: Which company screen\]

Shown when a calendar event cannot be matched with confidence. Nothing is attached until you decide.

- Back link "‹ Home". Yellow event card: title, "Tue 4 Nov, 3:00 PM · Online", and "From your calendar. Organizer: hr@gmail.example. I couldn't tell which company this is."
- **Add to an existing company**: radio list showing company, role and last round (Umbrella Labs selected; Wayne Tech "recruiter call only"; Acme Corp "last: round 4").
- **Place it as**: chips Round 1 to Round 4, pre-selected to the next number (Round 3 for Umbrella Labs). Choosing another number renumbers later rounds automatically.
- **Or it's a new company**: name field ("e.g. Stark Industries") and Create new company.
- The main button "Add to Umbrella Labs as round 3" updates with the choice and is pinned at the bottom. Below it: Decide later (stays in the review list) and Not an interview (removes it); both are cut off in the export.
- Your choice is remembered: the same organizer email or title pattern suggests that company first next time, though the app still asks when unsure. A placed event is never moved back by later refreshes.

### 3.6 Follow-up email

&#91;image: Follow-up email screen\]

One tap from a pending company to a ready-to-send mail.

- Cancel link, "Follow-up email" heading, three template chips (Follow up selected). Follow up: thanks for the round, asks for next steps. Reschedule: says you joined at the scheduled time, the interview did not take place, and asks for a new slot. Check fit: thanks the recruiter for the first call, notes they said they would schedule the next step, asks for an update and whether your profile fits.
- Mail card with To (recruiter email), Subject ("Following up: SDE II, Technical round") and body: greeting, round with date, role and company, the ask, then your signature from Settings.
- Help line: company, role, round and date are filled from the tracker; the text is editable; opening Mail marks the company as pinged today.
- Copy text (outlined) copies the message. Open in Mail (filled) opens the phone's default mail app with everything filled in and sends from whichever account that app uses. Both are pinned at the bottom.

### 3.7 Recruiter call only

&#91;image: Recruiter call only screen\]

For a recruiter who called and said they will schedule an interview, but has not.

- Back link, company name, role, then Awaiting schedule · N days and the ping bubble.
- **Timeline card**: Recruiter call (date, Phone, recruiter name, Call done bubble) and Interview (Not scheduled yet, Waiting bubble). Below: a red Not moving forward button (moves the company to Rejected) and the line "When an invite arrives, refresh adds it here as round 1."
- **Follow up card**: "\[Recruiter\] said he would schedule the next step. Ask for an update, or check if your profile fits." Buttons: Email follow-up (opens 3.6 with the Check fit template), Call \[name\], Mark as pinged. Same ping rules as a pending round.
- Recruiter card with Copy number and Copy email, then Your notes.

### 3.8 Full job description

&#91;image: Full job description screen\]

A reading view for long descriptions. The company page only ever loads a short preview, so very long pastes stay fast.

- Back link to the company, heading "Job description", and "SDE II · pasted 20 Oct · about 1,850 words".
- Find in description box searches the pasted text only.
- Jump chips (About, Responsibilities, Requirements, Nice to have, Benefits) scroll sideways. They are built from headings found in the text and hidden when none are found.
- Body card in larger type with paragraph spacing and bullets, plus the footer line "Long descriptions scroll here. The company page shows a short preview only."
- Buttons below the card (cut off in the export): Copy text, Edit (opens 3.10), Open posting.

### 3.9 Settings

&#91;image: Settings screen\]

- **Calendars to read**: "Last updated today, 10:42 AM" with Refresh now. Every calendar on the phone is listed with its account address; tick the job-search calendar (Job search ticked, Personal and Employer unticked). Read-only permission only. Never tick an employer calendar, which colleagues or admins may see.
- **Interview keywords**: chips (interview, round, screening, technical, HR, recruiter) plus + Add. Events matching a keyword are kept.
- **Reminder for manual entries**: one row, default "1 hour before".
- **Email signature**: text box prefilled with "Thanks, Your Name, phone, LinkedIn". Help line: "Added to the end of every follow-up email." Still editable per email.
- **Backup**: Export and Import, "Save or restore companies, rounds and notes as a file." This is the only protection if the phone is lost or reset.

### 3.10 Edit job description

&#91;image: Edit job description screen\]

Opened from the Edit icon on the company page's job description card, and from the Edit button on the full-screen view.

- Cancel link, heading "Edit job description", subtitle "Umbrella Labs · SDE II".
- Description: a large scrolling text box holding the current text, editable in place, with a live word count ("1,850 words") and two buttons, Paste new (replaces the text with the clipboard) and Clear.
- Posting link field (placeholder "https://").
- Help line: "Paste the correct description to replace this one, or edit it in place."
- Save description is a full-width filled button pinned at the bottom. Cancel discards changes.
- Saving refreshes the preview, word count and jump chips everywhere.

## 4. Data model

| Table | Fields |
| --- | --- |
| Company | id, name, role, status (active, rejected), rejected\_after\_round, jd\_text, jd\_link, notes, created\_at |
| Recruiter | id, company\_id, name, phone, email |
| Round (manual) | id, company\_id, type (walk\_in, offline, phone, online, recruiter\_call), datetime, location\_or\_link, contact, notes |
| CalendarLink | calendar\_event\_id, company\_id, manually\_placed (bool), cached title, start, end, organizer, meeting link |
| RoundMeta | round ref (manual id or calendar event id), result (pending, approved, rejected, didnt\_happen), result\_set\_at |
| Ping | id, company\_id, round ref, pinged\_at |
| Alias | pattern type (organizer email, domain, title pattern), pattern, company\_id |
| ReviewItem | calendar\_event\_id, status (open, decided, dismissed) |
| Settings | selected\_calendar\_ids, keywords, signature, reminder\_minutes |

Round numbers are derived by sorting a company's rounds by date.

## 5. Extraction rules (no AI)

- Meeting links: Meet, Zoom, Teams URLs from location and description.
- Phone numbers: regex from the description.
- Emails: organizer and attendees.
- Company guess: title patterns "Interview with X", "X – Round", organizer domain; stripped of generic words.
- Interview detection: title or description contains a keyword from the list.

## 6. Mobile and UI requirements

- All buttons and inputs at least 48px high; tabs tall enough for easy tapping and clear of the bottom swipe area.
- Button rows wrap onto a second line on narrow phones.
- Layout flexes from 320px width up; Back and Cancel are large tap targets.
- Tap to copy phone, email and links; tap to call; tap address for Maps; tap link to join.
- Source tag (Calendar or Manual) on cards.
- Status bubbles: blue pending, green approved or pinged, red rejected, amber didn't happen, grey haven't pinged yet.
- Design status: layout rules were checked but not tested on real devices at 360px versus 430px.

## 7. MVP scope

**In v1**

- Calendar read with calendar picker, keyword filter, event parsing, refresh.
- Manual entries (5 types) with edit, delete, local reminder.
- Companies list with search, Active and Rejected sections.
- Company detail with rounds, results, recruiter, JD preview with edit and full-screen icons, notes, rename, merge, reopen.
- Result tracking and pending days.
- Ping tracking (Mark as pinged button, separate bubble, latest-round-only rule).
- Follow-up email with three templates and configurable signature.
- Needs review flow and Move to another company.
- Full job description screen.
- Export and import backup.

**Out of v1**

Gmail scan, writing to the calendar, automatic follow-up reminders or overdue flags, clash warnings, pipeline stages beyond the result states, salary or offer comparison, iOS, web, cloud sync, dark mode, AI features.

## 8. Build order

1. Local database, models, manual entry create, edit, delete.
2. Calendar permission, picker, keyword filter, event parsing.
3. Company grouping, aliases, merge, Needs review, Which company? flow.
4. Company detail: rounds, results, ping logic, Reopen.
5. Home cards, Companies search, refresh behaviour.
6. Follow-up email templates and signature.
7. JD preview, edit, full-screen view.
8. Reminders, export and import.
9. Test build through EAS (free). Play Store needs a one-time $25 fee only if published.

## 9. Known gaps and open questions

- Clash warning and stale flag were dropped; confirm they stay out of v1.
- Home and Companies states for "Didn't happen" as the latest round, and Wayne Tech in Home's Waiting list, were not drawn.
- Globex and Acme rows do not open pages in the clickable design; buttons such as Call, Copy and Mark approved are visual only.
- Data lives only on the phone, so export and import is the only protection against loss.
- If a recruiter arranges a round by WhatsApp or phone, it must be added manually.
- Company-name guessing will sometimes be wrong; the review flow, undo and move actions are the safeguards.
- The exported PDF predates the job description icon change, so its company page still shows the collapsed card. The icon layout is specified in 3.3 but not yet drawn.