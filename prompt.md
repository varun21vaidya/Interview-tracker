You are a senior mobile architect. Write an HLD, LLD, folder structure, and phased detailed plan for an Android-only personal app called "Interview Tracker."

Attached: 
1. Interview_Tracker_Final_MVP_Spec_and_Screens.md (rules, screens, data model)
2. Interview_Tracker_App_Screens.pdf (10 screenshots; use for layout and exact text)

Where the spec and screens disagree, the decisions below win.

STACK (locked)
- Expo, React Native, TypeScript (strict)
- expo-sqlite (local only), expo-calendar (read-only), expo-notifications (local), expo-clipboard, expo-linking, expo-document-picker, expo-sharing, expo-file-system
- No backend, no login, no Google OAuth, no Gmail, no AI, no dark mode, no animations in v1
- Android 12+ test device; EAS preview builds for personal use; Play Store later

USER PROFILE
- Knows TypeScript, new to React Native and Expo. Explain RN/Expo concepts briefly where they first appear.
- Works under 5 hours a week. Phases must be small and each must end with something runnable on a phone.

DECISIONS (final)
1. Round numbering: "Didn't happen" rounds get no number. Numbers count only counted rounds, by date. Example: Umbrella 16 Oct = R1, 20 Oct didn't happen = none, 23 Oct = R2.
2. Recruiter call (no interview yet) is a timeline entry on the company, not a round. Becomes Round 1 when the invite arrives.
3. Home: any company whose latest done round is pending appears under "Waiting for result" (Globex included).
4. Home Next card: soonest upcoming interview. Other upcoming ones are listed below it.
5. A round happening today with no result: no ping bubble; company stays Active.
6. New company detected from a calendar event: goes to Needs review; not created until the user confirms. Blue banner only for auto-attached events to existing companies.
7. Which company? screen: nothing pre-selected.
8. Ping sources: "Mark as pinged", "Copy text", and "Open in Mail" all record a ping on the latest done pending round.
9. Reopen: rounds renumber; old results kept.
10. Multiple roles at one company: separate companies.
11. "Not an interview": event stays hidden unless its time or organizer changes.
12. Merge: moves all rounds, pings, and notes into target; deletes source.
13. Rejected with no rounds: row label "Recruiter call only, not moving forward".
14. Backup: single JSON file with schemaVersion, plus a readable text summary. Import replaces data after confirmation.
15. Pending on the day of a round: "Pending · today".

ASSUMPTIONS TO LABEL (mark each with ASSUMPTION)
- One recruiter per company.
- Reminder options: 15 min, 1 hour (default), 1 day before.
- No reminders for recruiter calls.
- Calendar window: past 60 days to next 120 days.
- Expo Router for navigation.

Before writing anything long, ask me up to 5 clarifying questions if you need them. Then produce:

1. HLD: system context, modules, navigation, key data flows, cross-cutting concerns (errors, permissions, time zones, idempotent refresh).
2. LLD: SQLite schema with migration plan; TypeScript entities; pure domain function signatures and rules (numbering, pending, ping bubble, rejected label, Home sections, matching score, calendar diff, extraction regexes); state machines; screen component trees; notification rules; backup format; empty and error states.
3. Folder structure (Expo Router layout).
4. Detailed phased plan sized for under 5 hours a week: each phase with tasks, files, acceptance criteria, and tests. Include a device test checklist.

Keep it precise. Tag every rule with its spec reference (R1 to R44) or decision number above.