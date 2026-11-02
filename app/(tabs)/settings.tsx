import { Fragment, useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';
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
import { ActionRow } from '../../src/components/ActionRow';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Page } from '../../src/components/Page';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useData } from '../../src/hooks/useData';
import { useSync } from '../../src/hooks/useSync';
import { colors, MIN_TOUCH, space, type } from '../../src/theme/tokens';

export default function Settings() {
  const [status, setStatus] = useState('');

  return (
    <Screen edges={['top']} keyboard>
      <Page>
        <Text accessibilityRole="header" style={[type.title, styles.title]}>Settings</Text>
        <CalendarsCard />
        <KeywordsCard />
        <SignatureCard />
        <BackupCard />
        {__DEV__ && (
          <View style={styles.dev}>
            <Text style={[type.small, { color: colors.muted }]}>Developer tools</Text>
            <Link href="/debug-events" style={[type.body, { color: colors.accent }]}>Debug: read events (temporary)</Link>
            <Button
              label="Load sample data" variant="secondary"
              onPress={() => {
                setStatus('Loading…');
                loadSampleData().then(() => setStatus('Sample data loaded'), e => setStatus(`Failed: ${e.message}`));
              }}
            />
            {status ? <Text style={[type.body, { color: colors.text }]}>{status}</Text> : null}
          </View>
        )}
      </Page>
    </Screen>
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
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Calendars to read</Text>
      {updated ? <Text style={[type.small, { color: colors.muted }]}>Last {updated.charAt(0).toLowerCase() + updated.slice(1)}</Text> : null}
      {access === 'granted' ? (
        <>
          {rows.length === 0 && !error ? <Text style={[type.small, { color: colors.muted }]}>No calendars found on this phone.</Text> : null}
          <View>
            {rows.map((r, i) => (
              <Fragment key={r.id}>
                {i > 0 && <View style={styles.rule} />}
                <View style={styles.calRow}>
                  <View style={styles.calText}>
                    <Text style={[type.bodyStrong, { color: colors.text }]}>{r.title}</Text>
                    {r.account ? <Text style={[type.small, { color: colors.muted }]}>{r.account}</Text> : null}
                  </View>
                  <Switch
                    value={ticked.includes(r.id)}
                    onValueChange={() => toggle(r.id)}
                    trackColor={{ false: colors.disabledBg, true: colors.accent }}
                    thumbColor={colors.ground}
                    accessibilityLabel={`Read ${r.title}`}
                  />
                </View>
              </Fragment>
            ))}
          </View>
          {ticked.length > 0 ? (
            <Text style={[type.small, { color: colors.warning }]}>Never tick an employer calendar: colleagues or admins may see it.</Text>
          ) : null}
          <Text style={[type.small, { color: colors.muted }]}>Read-only. This app never changes your calendar.</Text>
          <Button variant="secondary" icon="refresh-cw" label={sync.syncing ? 'Refreshing…' : 'Refresh now'} onPress={() => { void sync.run(); }} disabled={sync.syncing} />
          {sync.message ? <Text style={[type.small, { color: colors.warning }]}>{sync.message}</Text> : null}
        </>
      ) : access === null ? null : (
        <View style={styles.access}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>Calendar access is needed</Text>
          <Text style={[type.small, { color: colors.muted }]}>Allow read-only access to list your calendars and pick the job-search one.</Text>
          {access === 'ask'
            ? <Button label="Allow calendar access" onPress={allow} />
            : <Button label="Open app settings" onPress={() => Linking.openSettings()} />}
        </View>
      )}
      {error ? <Text style={[type.small, { color: colors.warning }]}>{error}</Text> : null}
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
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Interview keywords</Text>
      <View style={styles.chips}>
        {data.map(k => (
          <Chip key={k} label={k} icon="x" selected accessibilityLabel={`Remove ${k}`} onPress={() => setKeywords(data.filter(x => x !== k))} />
        ))}
      </View>
      <View style={styles.addRow}>
        <View style={styles.addInput}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add keyword"
            autoCapitalize="none"
            returnKeyType="done"
            accessibilityLabel="Add keyword"
          />
        </View>
        <Button label="Add" variant="secondary" onPress={add} />
      </View>
      <Text style={[type.small, { color: colors.muted }]}>Events whose title or description contains a keyword are kept. Tap a chip to remove it.</Text>
    </Card>
  );
}

function LoadFailed({ title }: { title: string }) {
  return (
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>{title}</Text>
      <Text style={[type.body, { color: colors.text }]}>Could not load this setting. Close and reopen the app.</Text>
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
  const [note, setNote] = useState('');
  const save = () => {
    if (text === initial) return;
    Promise.resolve(setSignature(text)).then(() => setNote('Saved'), () => setNote('Could not save your signature. Try again.'));
  };
  return (
    <Card style={styles.card}>
      <TextField
        label="Email signature" value={text}
        onChangeText={t => { setText(t); setNote(''); }}
        onBlur={save}
        lines={4}
      />
      <Text style={[type.small, { color: colors.muted }]}>Added to the end of every follow-up email.</Text>
      {!!text.trim() && (
        <View style={styles.preview}>
          <Text style={[type.small, { color: colors.muted }]}>Your emails end with:</Text>
          <Text style={[type.small, { color: colors.muted }]}>{text}</Text>
        </View>
      )}
      {!!note && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{note}</Text>}
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
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Backup</Text>
      <Text style={[type.small, { color: colors.muted }]}>Save or restore companies, rounds and notes as a file. This is the only protection if the phone is lost or reset.</Text>
      <ActionRow stackAlways>
        <Button label="Export backup" icon="download" onPress={() => run('Export', async () => { await exportBackup(); })} disabled={busy} />
        <Button variant="secondary" label="Share readable summary" icon="share-2" onPress={() => run('Export', async () => { await exportSummary(); })} disabled={busy} />
        <Button variant="secondary" label="Import backup" icon="upload" onPress={importFile} disabled={busy} />
      </ActionRow>
      <Text style={[type.small, { color: colors.warning }]}>{UNENCRYPTED_NOTE}</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{message}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, marginTop: space.lg },
  dev: { gap: space.sm, marginTop: space.md },
  card: { gap: space.md },
  rule: { height: 1, backgroundColor: colors.rule },
  calRow: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH, gap: space.md, paddingVertical: space.xs },
  calText: { flex: 1, minWidth: 0 },
  access: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  addInput: { flex: 1, minWidth: 0 },
  preview: { gap: 2, borderLeftWidth: 2, borderLeftColor: colors.rule, paddingLeft: space.md },
});
