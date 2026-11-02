import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomBar } from '../src/components/BottomBar';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { DateField } from '../src/components/DateField';
import { FieldPair } from '../src/components/FieldPair';
import { InlineError } from '../src/components/InlineError';
import { Page } from '../src/components/Page';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextField } from '../src/components/TextField';
import { addRecruiterCall, addRound, deleteRound, loadRoundForEdit, updateRound } from '../src/db/repos/actions';
import { dateText, timeText } from '../src/domain/home';
import { parseStart, roundLabel, validateAdd, type AddKind, type FormErrors } from '../src/domain/validation';
import { colors, space, type } from '../src/theme/tokens';

const KINDS: { kind: AddKind; label: string }[] = [
  { kind: 'walk_in', label: 'Walk-in' }, { kind: 'offline', label: 'Offline' },
  { kind: 'phone', label: 'Phone' }, { kind: 'online', label: 'Online' },
];

/** Add interview (3.4). With ?roundId it edits a manual round instead. */
export default function AddInterview() {
  const router = useRouter();
  const { roundId } = useLocalSearchParams<{ roundId?: string }>();
  const editing = !!roundId;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));   // no history after a deep link or reload

  const [kind, setKind] = useState<AddKind>('online');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [where, setWhere] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [failure, setFailure] = useState('');   // load or save problem, shown instead of failing silently

  useEffect(() => {
    if (!roundId) return;
    loadRoundForEdit(roundId).then(r => {
      if (!r) { goBack(); return; }          // calendar round or already deleted
      setKind(r.type); setCompany(r.companyName); setRole(r.role ?? '');
      setLabel(r.label === 'Interview' ? '' : r.label);
      setDate(dateText(r.startsAt)); setTime(timeText(r.startsAt));
      setWhere(r.locationOrLink ?? ''); setContactName(r.contactName ?? ''); setContactPhone(r.contactPhone ?? '');
      setNotes(r.notes ?? ''); setLoaded(true);
    }).catch(() => setFailure('Could not load this interview.'));
  }, [roundId]);

  const recruiter = kind === 'recruiter_call';

  const save = async () => {
    const e = validateAdd({ kind, company, date, time });
    setErrors(e);
    if (Object.keys(e).length) return;
    const startsAt = parseStart(date, time)!;
    setSaving(true); setFailure('');
    try {
      if (recruiter) {
        const id = await addRecruiterCall(
          { company, role, recruiterName: contactName, recruiterPhone: contactPhone }, { callAt: startsAt, said: notes });
        router.replace({ pathname: '/company/[id]', params: { id } });
        return;
      }
      const fields = { type: kind, label: roundLabel(label), startsAt, locationOrLink: where, contactName, contactPhone, notes };
      if (roundId) { await updateRound(roundId, fields); goBack(); return; }
      const id = await addRound({ company, role, recruiterName: contactName, recruiterPhone: contactPhone }, fields);
      router.replace({ pathname: '/company/[id]', params: { id } });
    } catch {
      setFailure('Could not save. Nothing was changed, try again.');
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    try { await deleteRound(roundId!); goBack(); } catch { setFailure('Could not delete this round.'); }
  };
  const remove = () => Platform.OS === 'web'
    ? (globalThis.confirm?.('Delete this round? Its pings are deleted too.') ?? true) && void doDelete()   // Alert.alert is a no-op on web
    : Alert.alert('Delete this round?', 'Its pings are deleted too.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: doDelete },
  ]);

  if (!loaded) {
    return (
      <Screen>
        <Page>
          <ScreenHeader cancel={goBack} title="Edit interview" />
          {!!failure && <InlineError message={failure} />}
        </Page>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Page>
        <ScreenHeader cancel={goBack} title={editing ? 'Edit interview' : 'Add interview'} />
        {!editing && (
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {KINDS.map(k => <Chip key={k.kind} radio label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />)}
            <View style={styles.full}>
              <Chip radio label="Recruiter call (no interview yet)" selected={recruiter} onPress={() => setKind('recruiter_call')} />
            </View>
          </View>
        )}
        <TextField label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Wayne Tech" error={errors.company} />
        <TextField label="Role" value={role} onChangeText={setRole} />
        {!recruiter && <TextField label="Round name" value={label} onChangeText={setLabel} placeholder="e.g. Technical round" />}
        <FieldPair>
          <DateField label={recruiter ? 'Call date *' : 'Date *'} mode="date" value={date} onChange={setDate} error={errors.date} />
          <DateField label="Time" mode="time" value={time} onChange={setTime} error={errors.time} optional />
        </FieldPair>
        {!recruiter && <TextField label="Address or meeting link" value={where} onChangeText={setWhere} autoCapitalize="none" />}
        <FieldPair>
          <TextField label={recruiter ? 'Recruiter name' : 'Contact name'} value={contactName} onChangeText={setContactName} />
          <TextField label={recruiter ? 'Recruiter phone' : 'Contact phone'} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
        </FieldPair>
        <TextField
          label={recruiter ? 'What did the recruiter say?' : 'Notes'} value={notes} onChangeText={setNotes} lines={4}
          placeholder={recruiter ? 'e.g. will schedule round 1 this week' : undefined}
        />
        {recruiter && (
          <Text style={[type.small, { color: colors.muted }]}>
            Shows as Awaiting schedule until a round is added. You can follow up and track pings meanwhile.
          </Text>
        )}
        {editing && (
          <View style={styles.danger}>
            <Button label="Delete round" variant="danger" icon="trash-2" onPress={remove} />
          </View>
        )}
      </Page>
      <BottomBar above={!!failure && <Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.danger }]}>{failure}</Text>}>
        <Button label={saving ? 'Saving…' : editing ? 'Save changes' : 'Save'} onPress={save} disabled={saving} />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  full: { width: '100%' },
  danger: { marginTop: space.xl },
});
