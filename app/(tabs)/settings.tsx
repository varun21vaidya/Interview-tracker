import { useCallback, useEffect, useState } from 'react';
import { Button, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { getCalendars } from 'expo-calendar';
import { loadSampleData } from '../../src/db/seed';
import {
  getCalendarIds, getKeywords, getLastSync, getSignature, setCalendarIds, setKeywords, setSignature,
} from '../../src/db/repos/settings';
import { updatedText } from '../../src/domain/home';
import { getCalendarAccess, requestCalendarAccess, type CalendarAccess } from '../../src/services/permissions';
import { Chip } from '../../src/components/Chip';
import { useData } from '../../src/hooks/useData';
import { Card } from '../../src/components/Card';
import { colors, radius, space, type } from '../../src/theme/tokens';

export default function Settings() {
  const [status, setStatus] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text>Settings</Text>
      <CalendarsCard />
      <KeywordsCard />
      <SignatureCard />
      {__DEV__ && (
        <View style={styles.dev}>
          <Link href="/debug-events">Debug: read events (temporary)</Link>
          <Button
            title="Load sample data"
            onPress={() => {
              setStatus('Loading…');
              loadSampleData().then(() => setStatus('Sample data loaded'), e => setStatus(`Failed: ${e.message}`));
            }}
          />
          {status ? <Text>{status}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

interface CalRow { id: string; title: string; account: string }

/**
 * Calendars to read. Nothing is ticked by default. The OS permission prompt only appears when the
 * user presses "Allow calendar access" here, never at launch.
 */
function CalendarsCard() {
  const { data: ids } = useData(getCalendarIds, []);
  const { data: lastSync } = useData(getLastSync, []);
  const [access, setAccess] = useState<CalendarAccess | null>(null);
  const [rows, setRows] = useState<CalRow[]>([]);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    try {
      const cals = await getCalendars();
      // ownerAccount is Android-only (UNVERIFIED elsewhere), so fall back to the source name.
      setRows(cals.map(c => ({ id: c.id, title: c.title, account: c.ownerAccount ?? c.source?.name ?? '' })));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not list calendars');
    }
  }, []);

  useEffect(() => {
    getCalendarAccess().then(a => { setAccess(a); if (a === 'granted') loadRows(); }, e => setError(String(e?.message ?? e)));
  }, [loadRows]);

  async function allow() {
    try {
      const a = await requestCalendarAccess();
      setAccess(a);
      if (a === 'granted') await loadRows();
      else setError(a === 'ask' ? 'Access was not granted. Press the button to try again.' : 'Access is blocked. Turn it on in app settings.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not ask for calendar access');
    }
  }

  const ticked = ids ?? [];
  const toggle = (id: string) => setCalendarIds(ticked.includes(id) ? ticked.filter(x => x !== id) : [...ticked, id]);
  const updated = updatedText(lastSync ?? null, Date.now());

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Calendars to read</Text>
      {updated ? <Text style={styles.help}>Last {updated.charAt(0).toLowerCase() + updated.slice(1)}</Text> : null}
      {access === 'granted' ? (
        <>
          {rows.length === 0 && !error ? <Text style={styles.help}>No calendars found on this phone.</Text> : null}
          {rows.map(r => (
            <View key={r.id} style={styles.calRow}>
              <View style={styles.calText}>
                <Text style={styles.calTitle}>{r.title}</Text>
                {r.account ? <Text style={styles.help}>{r.account}</Text> : null}
              </View>
              <Switch
                value={ticked.includes(r.id)}
                onValueChange={() => toggle(r.id)}
                accessibilityLabel={`Read ${r.title}`}
              />
            </View>
          ))}
          {ticked.length > 0 ? (
            <Text style={styles.warn}>Never tick an employer calendar: colleagues or admins may see it.</Text>
          ) : null}
          <Text style={styles.help}>Read-only. This app never changes your calendar.</Text>
        </>
      ) : access === null ? null : (
        <View style={styles.access}>
          <Text style={styles.calTitle}>Calendar access is needed</Text>
          <Text style={styles.help}>Allow read-only access to list your calendars and pick the job-search one.</Text>
          {access === 'ask'
            ? <Button title="Allow calendar access" onPress={allow} />
            : <Button title="Open app settings" onPress={() => Linking.openSettings()} />}
        </View>
      )}
      {error ? <Text style={styles.warn}>{error}</Text> : null}
    </Card>
  );
}

/** Interview keywords: tap a chip to remove it. Events matching a keyword are kept. */
function KeywordsCard() {
  const { data } = useData(getKeywords, []);
  const [draft, setDraft] = useState('');
  if (data === null) return null;

  function add() {
    const w = draft.trim().slice(0, 40);
    if (!w || data!.some(k => k.toLowerCase() === w.toLowerCase())) { setDraft(''); return; }
    setKeywords([...data!, w]);
    setDraft('');
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Interview keywords</Text>
      <View style={styles.chips}>
        {data.map(k => (
          <Chip key={k} label={`${k}  ✕`} selected onPress={() => setKeywords(data.filter(x => x !== k))} />
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="+ Add keyword"
          autoCapitalize="none"
          returnKeyType="done"
          accessibilityLabel="Add keyword"
          style={[styles.input, styles.addInput]}
        />
        <Pressable accessibilityRole="button" onPress={add} style={styles.addBtn}>
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>
      <Text style={styles.help}>Events whose title or description contains a keyword are kept. Tap a chip to remove it.</Text>
    </Card>
  );
}

/** Email signature. Saved on blur; the stored value is what every follow-up email ends with. */
function SignatureCard() {
  const { data } = useData(getSignature, []);
  if (data === null) return null;
  return <SignatureEditor key="sig" initial={data} />;
}

function SignatureEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Email signature</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => { if (text !== initial) setSignature(text); }}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Email signature"
        style={styles.input}
      />
      <Text style={styles.help}>Added to the end of every follow-up email.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  dev: { marginTop: 24, gap: 8, alignItems: 'center' },
  card: { alignSelf: 'stretch', gap: space.sm, marginTop: space.lg },
  cardTitle: { ...type.section, color: colors.text },
  input: {
    minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, ...type.body, color: colors.text,
  },
  help: { fontSize: 13, color: colors.textFaint },
  warn: { fontSize: 13, color: '#7A4A00' },
  calRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: space.md },
  calText: { flex: 1 },
  calTitle: { ...type.body, fontWeight: '600', color: colors.text },
  access: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  addInput: { flex: 1, minHeight: 48, paddingVertical: space.sm },
  addBtn: { minHeight: 48, minWidth: 48, paddingHorizontal: space.lg, justifyContent: 'center' },
  addLabel: { ...type.body, fontWeight: '700', color: colors.accent },
});
