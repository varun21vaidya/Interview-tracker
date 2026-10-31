import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { addRecruiterCall, addRound, deleteRound, loadRoundForEdit, updateRound } from '../src/db/repos/actions';
import { parseStart, roundLabel, validateAdd, type AddKind, type FormErrors } from '../src/domain/validation';
import { colors, MIN_TOUCH, radius, space, type } from '../src/theme/tokens';

const KINDS: { kind: AddKind; label: string }[] = [
  { kind: 'walk_in', label: 'Walk-in' }, { kind: 'offline', label: 'Offline' },
  { kind: 'phone', label: 'Phone' }, { kind: 'online', label: 'Online' },
];
const pad = (n: number) => String(n).padStart(2, '0');
const dateText = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const timeText = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

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

  useEffect(() => {
    if (!roundId) return;
    loadRoundForEdit(roundId).then(r => {
      if (!r) { goBack(); return; }          // calendar round or already deleted
      setKind(r.type); setCompany(r.companyName); setRole(r.role ?? '');
      setLabel(r.label === 'Interview' ? '' : r.label);
      setDate(dateText(r.startsAt)); setTime(timeText(r.startsAt));
      setWhere(r.locationOrLink ?? ''); setContactName(r.contactName ?? ''); setContactPhone(r.contactPhone ?? '');
      setNotes(r.notes ?? ''); setLoaded(true);
    });
  }, [roundId]);

  const recruiter = kind === 'recruiter_call';

  const save = async () => {
    const e = validateAdd({ kind, company, date, time });
    setErrors(e);
    if (Object.keys(e).length) return;
    const startsAt = parseStart(date, time)!;
    setSaving(true);
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
    } finally { setSaving(false); }
  };

  const doDelete = async () => { await deleteRound(roundId!); goBack(); };
  const remove = () => Platform.OS === 'web'
    ? (globalThis.confirm?.('Delete this round? Its pings are deleted too.') ?? true) && void doDelete()   // Alert.alert is a no-op on web
    : Alert.alert('Delete this round?', 'Its pings are deleted too.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: doDelete },
  ]);

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => goBack()} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{editing ? 'Edit interview' : 'Add interview'}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {!editing && (
            <View style={styles.chips}>
              {KINDS.map(k => <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />)}
              <View style={styles.full}>
                <Chip label="Recruiter call (no interview yet)" selected={recruiter} onPress={() => setKind('recruiter_call')} />
              </View>
            </View>
          )}
          <Field label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Wayne Tech" error={errors.company} />
          <Field label="Role" value={role} onChangeText={setRole} />
          {!recruiter && <Field label="Round name" value={label} onChangeText={setLabel} placeholder="e.g. Technical round" />}
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Field label={recruiter ? 'Call date *' : 'Date *'} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={errors.date} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={styles.flex}>
              <Field label="Time" value={time} onChangeText={setTime} placeholder="HH:MM" error={errors.time} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          {!recruiter && <Field label="Address or meeting link" value={where} onChangeText={setWhere} autoCapitalize="none" />}
          <View style={styles.pair}>
            <View style={styles.flex}><Field label={recruiter ? 'Recruiter name' : 'Contact name'} value={contactName} onChangeText={setContactName} /></View>
            <View style={styles.flex}><Field label={recruiter ? 'Recruiter phone' : 'Contact phone'} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" /></View>
          </View>
          <Field
            label={recruiter ? 'What did the recruiter say?' : 'Notes'} value={notes} onChangeText={setNotes} multiline
            placeholder={recruiter ? 'e.g. will schedule round 1 this week' : undefined}
          />
          {recruiter && (
            <Text style={styles.help}>Shows as Awaiting schedule until a round is added. You can follow up and track pings meanwhile.</Text>
          )}
          {editing && <Button label="Delete round" variant="secondary" onPress={remove} />}
        </ScrollView>
        <View style={styles.footer}>
          <Button label={editing ? 'Save changes' : 'Save'} onPress={save} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps extends TextInputProps { label: string; error?: string }
function Field({ label, error, multiline, style, ...rest }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label} placeholderTextColor={colors.textFaint} multiline={multiline}
        style={[styles.input, multiline && styles.multi, !!error && styles.inputError, style]} {...rest}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm },
  cancel: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  cancelText: { ...type.body, color: colors.accent, fontWeight: '600' },
  title: { ...type.title, color: colors.text },
  body: { padding: space.lg, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  full: { width: '100%' },
  pair: { flexDirection: 'row', gap: space.md },
  field: { gap: space.xs },
  label: { ...type.section, color: colors.text },
  input: {
    minHeight: MIN_TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, backgroundColor: colors.surface, color: colors.text, fontSize: 15,
  },
  multi: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  inputError: { borderColor: '#8A1C1C' },
  error: { ...type.body, color: '#8A1C1C' },
  help: { ...type.body, color: colors.textMuted },
  footer: { padding: space.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
