// Phase 0 spike. Temporary: delete after the calendar fields are confirmed on-device.
import { getCalendars, requestCalendarPermissions } from 'expo-calendar';
import { useState } from 'react';
import { ActivityIndicator, Button, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CALENDAR_NAME = 'Job search';
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_BACK = 60;
const DAYS_AHEAD = 120;

type Row = { id: string; title: string; start: string };
type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'no-calendar'; available: string[] }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: Row[] };

export default function Spike() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function load() {
    setState({ kind: 'loading' });
    try {
      const perm = await requestCalendarPermissions();
      if (!perm.granted) {
        setState({ kind: 'denied', canAskAgain: perm.canAskAgain });
        return;
      }
      const calendars = await getCalendars();
      const calendar = calendars.find((c) => c.title === CALENDAR_NAME);
      if (!calendar) {
        setState({ kind: 'no-calendar', available: calendars.map((c) => c.title) });
        return;
      }
      const now = Date.now();
      const events = await calendar.listEvents(
        new Date(now - DAYS_BACK * DAY_MS),
        new Date(now + DAYS_AHEAD * DAY_MS),
      );
      if (__DEV__) {
        // Dev only. Shared native objects may log as {}, so also log plain copies of the fields.
        console.log('[spike] raw events', events);
        console.log(
          '[spike] raw events (plain)',
          events.map((e) => ({
            id: e.id,
            calendarId: e.calendarId,
            title: e.title,
            location: e.location,
            notes: e.notes,
            startDate: e.startDate,
            endDate: e.endDate,
            timeZone: e.timeZone,
            allDay: e.allDay,
            status: e.status,
            organizer: e.organizer,
            organizerEmail: e.organizerEmail,
            availability: e.availability,
            recurrenceRule: e.recurrenceRule,
          })),
        );
      }
      const rows = events
        .map((e) => ({ id: e.id, title: e.title, startMs: new Date(e.startDate).getTime() }))
        .sort((a, b) => a.startMs - b.startMs)
        .map((e) => ({ id: e.id, title: e.title || '(no title)', start: new Date(e.startMs).toLocaleString() }));
      setState({ kind: 'ready', rows });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <Button title="Request calendar permission and load events" onPress={load} />
      {state.kind === 'loading' && <ActivityIndicator style={styles.gap} />}
      {state.kind === 'denied' && (
        <View style={styles.gap}>
          <Text>Calendar access denied. Nothing was read.</Text>
          {!state.canAskAgain && <Button title="Open app settings" onPress={() => Linking.openSettings()} />}
        </View>
      )}
      {state.kind === 'no-calendar' && (
        <Text style={styles.gap}>
          No calendar named "{CALENDAR_NAME}". Found: {state.available.join(', ') || 'none'}
        </Text>
      )}
      {state.kind === 'error' && <Text style={styles.gap}>Error: {state.message}</Text>}
      {state.kind === 'ready' && (
        <FlatList
          style={styles.gap}
          data={state.rows}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={<Text style={styles.header}>{state.rows.length} events</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text>{item.title}</Text>
              <Text style={styles.sub}>{item.start}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  gap: { marginTop: 16 },
  header: { fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 8 },
  sub: { color: '#666', fontSize: 12 },
});
