// Phase 7 debug screen. Temporary: delete once sync (next phase) shows real events.
// Reads ONLY the calendars ticked in Settings. Does not set last_sync, so the window stays "first read" (14 days back).
import { useState } from 'react';
import { ActivityIndicator, Button, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { storedEvents, upsertEvent } from '../src/db/repos/calendarEvents';
import { getCalendarIds, getKeywords, getLastSync } from '../src/db/repos/settings';
import { readEvents } from '../src/services/calendarSync';
import { getCalendarAccess, requestCalendarAccess } from '../src/services/permissions';
import type { CalEvent } from '../src/types/entities';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'none-ticked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; events: CalEvent[]; cached: number };

export default function DebugEvents() {
  if (!__DEV__) return null; // never expose calendar contents in a release build
  return <DebugEventsScreen />;
}

function DebugEventsScreen() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function load() {
    setState({ kind: 'loading' });
    try {
      let access = await getCalendarAccess();
      if (access === 'ask') access = await requestCalendarAccess(); // first use, from a button press
      if (access !== 'granted') {
        setState({ kind: 'denied', canAskAgain: access === 'ask' });
        return;
      }
      const ids = await getCalendarIds();
      if (!ids.length) {
        setState({ kind: 'none-ticked' });
        return;
      }
      const now = Date.now();
      const events = await readEvents(ids, await getKeywords(), await getLastSync(), now);
      for (const ev of events) await upsertEvent(ev, now);
      const cached = (await storedEvents(ids)).size;
      setState({ kind: 'ready', events, cached });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return (
    <View style={styles.container}>
      <Button title="Read ticked calendars" onPress={load} />
      {state.kind === 'loading' && <ActivityIndicator style={styles.gap} />}
      {state.kind === 'denied' && (
        <View style={styles.gap}>
          <Text>Calendar access denied. Nothing was read.</Text>
          <Button title="Open app settings" onPress={() => Linking.openSettings()} />
        </View>
      )}
      {state.kind === 'none-ticked' && <Text style={styles.gap}>No calendar is ticked. Tick one in Settings.</Text>}
      {state.kind === 'error' && <Text style={styles.gap}>Error: {state.message}</Text>}
      {state.kind === 'ready' && (
        <FlatList
          style={styles.gap}
          data={state.events}
          keyExtractor={e => e.eventId}
          ListHeaderComponent={
            <Text style={styles.header}>{state.events.length} matching events · {state.cached} cached</Text>
          }
          ListEmptyComponent={<Text>No events matched a keyword in this window.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.title}>{item.title || '(no title)'}</Text>
              <Text style={styles.sub}>{new Date(item.startsAt).toLocaleString()} · calendar {item.calendarId}</Text>
              <Text style={styles.sub}>link: {item.meetingLink ?? '—'}</Text>
              <Text style={styles.sub}>phone: {item.phone ?? '—'}</Text>
              <Text style={styles.sub}>organizer: {item.organizerEmail ?? '—'}</Text>
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
  title: { fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
});
