import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../../../src/components/Button';
import { loadJd, saveJd, type JdRecord } from '../../../src/db/repos/companies';
import { countWords, formatWords, MAX_LINK_CHARS, prepareJd, TEXT_ERROR } from '../../../src/domain/jd';
import { useData } from '../../../src/hooks/useData';
import { colors, MIN_TOUCH, radius, space, type } from '../../../src/theme/tokens';

export default function EditJd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useData(async () => ({ jd: await loadJd(id) }), [id]);
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {data?.jd
        // Loaded once: later reloads never overwrite what is being typed.
        ? <Editor key={id} id={id} jd={data.jd} onCancel={cancel} onSaved={cancel} />
        : (
          <View style={styles.content}>
            <CancelLink onPress={cancel} />
            {(error || data) && <Text style={styles.muted}>{error ? 'Could not load this description.' : 'This company no longer exists.'}</Text>}
          </View>
        )}
    </SafeAreaView>
  );
}

function CancelLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.cancel}>
      <Text style={styles.cancelText}>Cancel</Text>
    </Pressable>
  );
}

function Editor({ id, jd, onCancel, onSaved }: { id: string; jd: JdRecord; onCancel: () => void; onSaved: () => void }) {
  const [text, setText] = useState(jd.text);
  const [link, setLink] = useState(jd.link ?? '');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const words = useMemo(() => countWords(text), [text]);
  const problem = useMemo(() => prepareJd(text, link).error, [text, link]);  // https-only link (spec 3.10), size caps
  const tooLong = problem === TEXT_ERROR;

  const paste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip.trim() === '') { setStatus('The clipboard is empty.'); return; }
      setText(clip); setStatus('');
    } catch {
      setStatus('Could not read the clipboard.');
    }
  };

  const save = async () => {
    if (busy.current || problem) return;
    busy.current = true; setSaving(true);
    try {
      await saveJd(id, text, link);
      onSaved();
    } catch {
      setStatus('Could not save. Try again.');
      busy.current = false; setSaving(false);
    }
  };

  const subtitle = [jd.name, jd.role].filter(Boolean).join(' · ');

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <CancelLink onPress={onCancel} />
        <Text accessibilityRole="header" style={styles.title}>Edit job description</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={text} onChangeText={setText} multiline textAlignVertical="top" scrollEnabled
          placeholder="Paste the job description" placeholderTextColor={colors.textFaint}
          accessibilityLabel="Description" style={[styles.input, styles.big]}
        />
        <Text accessibilityLiveRegion="polite" style={styles.count}>{formatWords(words)}</Text>
        {tooLong && <Text accessibilityLiveRegion="polite" style={styles.error}>{problem}</Text>}
        <View style={styles.pair}>
          <View style={styles.flex}><Button label="Paste new" variant="secondary" onPress={paste} /></View>
          <View style={styles.flex}><Button label="Clear" variant="secondary" disabled={text === ''} onPress={() => { setText(''); setStatus(''); }} /></View>
        </View>

        <Text style={styles.label}>Posting link</Text>
        <TextInput
          value={link} onChangeText={setLink} placeholder="https://" placeholderTextColor={colors.textFaint}
          accessibilityLabel="Posting link" maxLength={MAX_LINK_CHARS} autoCapitalize="none" autoCorrect={false} keyboardType="url"
          style={[styles.input, !!problem && !tooLong && styles.invalid]}
        />
        {!!problem && !tooLong && <Text accessibilityLiveRegion="polite" style={styles.error}>{problem}</Text>}

        <Text style={styles.help}>Paste the correct description to replace this one, or edit it in place.</Text>
        {!!status && <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>}
      </ScrollView>

      <View style={styles.bar}>
        <Button label={saving ? 'Saving…' : 'Save description'} disabled={saving || !!problem} onPress={save} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  cancel: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  cancelText: { ...type.section, color: colors.accent },
  title: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textMuted, marginBottom: space.sm },
  muted: { ...type.body, color: colors.textFaint },
  label: { ...type.section, color: colors.text, marginTop: space.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
    padding: space.md, minHeight: MIN_TOUCH, ...type.body, color: colors.text,
  },
  big: { height: 360 },
  invalid: { borderColor: '#B42318' },
  count: { fontSize: 13, color: colors.textFaint },
  pair: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  help: { fontSize: 13, color: colors.textFaint, marginTop: space.sm },
  error: { fontSize: 13, color: '#B42318' },
  status: { ...type.body, color: colors.accent },
  bar: { padding: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
