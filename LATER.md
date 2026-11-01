# Later

Found in the Phase 12 walk-through. Outside the spec, so not done.

- Home access card when calendar permission is denied. Today the card is in Settings only (matches the spec) and Home shows a one-line message on a manual refresh.
- Failed writes on company detail buttons (mark result, pinged, reopen, merge) have no on-screen message. They fail silently.
- Restore uses `withTransactionAsync`, which is not exclusive. A calendar sync running at the same moment could interleave. Use `withExclusiveTransactionAsync`.
- Settings screen shows a duplicate "Settings" title under the tab header, and uses default-styled buttons.
- Monthly export reminder (listed as an ASSUMPTION in the plan risks).
- Retry button on the "Could not open the database" screen.
- Remove `app/spike.tsx` and `app/debug-events.tsx` once no longer needed. Both are `__DEV__` only now.
