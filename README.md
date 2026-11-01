# Interview Tracker

A personal Android app (Expo + React Native + SQLite) for tracking interview rounds, results and follow-ups.
All data lives on the phone. There is no account and no server.

## Run it

```bash
npm install
npm test            # Jest: pure logic and the backup validator
npm run typecheck
npm start           # dev server for the development build
```

Use an EAS **development build**, not Expo Go (calendar and notification behaviour differ).

```bash
npm run build:dev       # development build (APK)
npm run build:release   # APK for daily use
```

The release build has `android.allowBackup` off, drops every `console.*` call from the bundle,
and hides the dev-only screens ("Load sample data", the debug and spike routes).

## Your data is only on this phone

`allowBackup` is off on purpose, so Android's cloud backup does **not** keep a copy. If the phone is
lost, reset, or the app is uninstalled, the data is gone. The only protection is an export you made.
Export at least once a month.

## Export

1. Open **Settings** → **Backup**.
2. Tap **Export backup**. The share sheet opens with `interview-tracker-backup-YYYY-MM-DD.json`.
3. Save it somewhere off the phone (Google Drive, email to yourself, a laptop).

**Share readable summary** makes a plain `.txt` with counts and company names. It is for reading only
and cannot be restored.

The backup file is **not encrypted**. It holds company names, recruiter contacts, notes and job
descriptions, so store it somewhere private.

## Restore

1. Get the `.json` backup file onto the phone (download it from Drive or your email).
2. Open **Settings** → **Backup** → **Import backup** and pick the file.
3. The app shows what the file contains (counts of companies, rounds and so on). Read it.
4. Tap **Replace**. **Everything currently in the app is replaced.** This cannot be undone.
5. Check Home and Companies. Reminders for future manual rounds are scheduled again automatically.
6. Open **Settings** → **Calendars to read** and tick your calendar again. Calendar choices are not
   part of a backup. Then tap **Refresh now**.

A file that is damaged, too large, or from another app is rejected with a message, and nothing
changes. The restore runs as one transaction, so a failure part-way also leaves your data untouched.

## Moving to a new phone

Export on the old phone, install the APK on the new one, then follow **Restore** above.
Allow calendar and notification permissions when asked.

## Permissions

- **Calendar (read only).** The app never writes to your calendar. Nothing is ticked by default.
  Never tick an employer calendar: colleagues or admins may see it.
- **Notifications.** Asked for when you save your first manual round. Reminders fire at the start time
  minus the reminder setting.

## Later

Not in v1 on purpose: see `LATER.md`.
