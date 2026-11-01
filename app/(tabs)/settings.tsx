import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { getCalendars } from 'expo-calendar';
import { loadSampleData } from '../../src/db/seed';
import {
  getCalendarIds, getKeywords, getLastSync, getSignature, setCalendarIds, setKeywords, setSignature,
} from '../../src/db/repos/settings';
import { updatedText } from '../../src/domain/home';
import { countsText, UNENCRYPTED_NOTE } from '../../src/domain/backup';
import { exportBackup, exportSummary, pickBackup, restore } from '../../src/services/backup';
import { getCalendarAccess, requestCalendarAccess, type CalendarAccess } from '../../src/services/permissions';
import { Chip } from '../../src/components/Chip';
import { useData } from '../../src/hooks/useData';
import { useSync } from '../../src/hooks/useSync';
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
      <BackupCard />
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
  const sync = useSync();

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
          <Button title={sync.syncing ? 'Refreshing…' : 'Refresh now'} onPress={() => { void sync.run(); }} disabled={sync.syncing} />
          {sync.message ? <Text style={styles.warn}>{sync.message}</Text> : null}
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
  const { data, error } = useData(getKeywords, []);
  const [draft, setDraft] = useState('');
  if (error) return <LoadFailed title="Interview keywords" />;
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

function LoadFailed({ title }: { title: string }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.warn}>Could not load this setting. Close and reopen the app.</Text>
    </Card>
  );
}

/** Email signature. Saved on blur; the stored value is what every follow-up email ends with. */
function SignatureCard() {
  const { data, error } = useData(getSignature, []);
  if (error) return <LoadFailed title="Email signature" />;
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

/** Export, summary and import. Import asks first and shows what the file contains. */
function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run(label: string, job: () => Promise<string | void>) {
    setBusy(true); setMessage('');
    try { const done = await job(); if (done) setMessage(done); }
    catch (e) { setMessage(`${label} failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  }

  const importFile = () => run('Import', async () => {
    const b = await pickBackup();
    if (!b) return;
    const msg = `This file has ${countsText(b)}.

Everything currently in the app will be replaced. This cannot be undone.`;
    const ok = Platform.OS === 'web'                 // Alert.alert does nothing on web
      ? window.confirm(msg)
      : await new Promise<boolean>(resolve => Alert.alert('Replace all data?', msg, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
        ], { cancelable: true, onDismiss: () => resolve(false) }));
    if (!ok) return;
    await restore(b);
    return 'Backup restored.';
  });

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Backup</Text>
      <Text style={styles.help}>Save or restore companies, rounds and notes as a file. This is the only protection if the phone is lost or reset.</Text>
      <Button title="Export backup" onPress={() => run('Export', async () => { await exportBackup(); })} disabled={busy} />
      <Button title="Share readable summary" onPress={() => run('Export', async () => { await exportSummary(); })} disabled={busy} />
      <Button title="Import backup" onPress={importFile} disabled={busy} />
      <Text style={styles.warn}>{UNENCRYPTED_NOTE}</Text>
      {message ? <Text style={styles.help}>{message}</Text> : null}
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
