import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Chip } from '../../../src/components/Chip';
import { markPinged } from '../../../src/db/repos/actions';
import { getSignature } from '../../../src/db/repos/settings';
import { firstName } from '../../../src/domain/contact';
import type { CompanyDetailModel } from '../../../src/domain/detail';
import { buildEmail, defaultTemplate, emailContext, TEMPLATES, toField, type Template } from '../../../src/domain/email';
import { useCompany } from '../../../src/hooks/useCompany';
import { useData } from '../../../src/hooks/useData';
import { copyBody, openMail } from '../../../src/services/mail';
import { colors, MIN_TOUCH, radius, space, type } from '../../../src/theme/tokens';
import type { Bundle } from '../../../src/types/entities';

const isTemplate = (v?: string): v is Template => TEMPLATES.some(t => t.id === v);

export default function FollowUp() {
  const { id, template } = useLocalSearchParams<{ id: string; template?: string }>();
  const router = useRouter();
  const { bundle, model, error, missing } = useCompany(id);
  const { data: signature } = useData(getSignature, []);
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {bundle && model && signature !== null
        // Keyed so a different company starts fresh; later data reloads never overwrite the user's edits.
        ? <Editor key={id} bundle={bundle} model={model} signature={signature} initial={isTemplate(template) ? template : undefined} onCancel={cancel} />
        : (
          <View style={styles.content}>
            <CancelLink onPress={cancel} />
            {(error || missing) && <Text style={styles.muted}>{error ? 'Could not load this company.' : 'This company no longer exists.'}</Text>}
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

interface EditorProps { bundle: Bundle; model: CompanyDetailModel; signature: string; initial?: Template; onCancel: () => void }

function Editor({ bundle, model, signature, initial, onCancel }: EditorProps) {
  const { company, recruiter } = bundle;
  const target = model.target;
  const contact = recruiter?.name ?? [...bundle.calls].sort((a, b) => b.callAt - a.callAt)[0]?.recruiterName;
  const ctx = emailContext(bundle, target, signature, firstName(contact));
  const { to, note } = toField(recruiter?.email);

  const [tpl, setTpl] = useState<Template>(initial ?? defaultTemplate(target));
  const [subject, setSubject] = useState(() => buildEmail(tpl, ctx).subject);
  const [body, setBody] = useState(() => buildEmail(tpl, ctx).body);
  const [status, setStatus] = useState('');
  const busy = useRef(false);

  const pick = (t: Template) => {          // switching template replaces the text
    const e = buildEmail(t, ctx);
    setTpl(t); setSubject(e.subject); setBody(e.body); setStatus('');
  };

  // One press = one ping, and none if the action itself fails. busy blocks a double tap.
  const act = (channel: 'copy' | 'mail', run: () => Promise<unknown>, done: string) => async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await run();
      if (target) await markPinged(company.id, target, channel);
      setStatus(done);
    } catch {
      setStatus(channel === 'mail' ? 'Could not open a mail app.' : 'Could not copy.');
    } finally {
      busy.current = false;
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CancelLink onPress={onCancel} />
        <Text accessibilityRole="header" style={styles.title}>Follow-up email</Text>
        <View style={styles.chips}>
          {TEMPLATES.map(t => <Chip key={t.id} label={t.label} selected={t.id === tpl} onPress={() => pick(t.id)} />)}
        </View>

        <Card style={styles.card}>
          <Text style={styles.label}>To</Text>
          <Text style={to ? styles.value : styles.muted}>{to || 'No recruiter email'}</Text>
          {!!note && <Text style={styles.help}>{note}</Text>}
          <Text style={styles.label}>Subject</Text>
          <TextInput value={subject} onChangeText={setSubject} accessibilityLabel="Subject" style={styles.input} />
          <Text style={styles.label}>Message</Text>
          <TextInput
            value={body} onChangeText={setBody} multiline textAlignVertical="top"
            accessibilityLabel="Message" style={[styles.input, styles.bodyInput]}
          />
        </Card>

        <Text style={styles.help}>
          {`Company, role, round and date are filled in from the tracker. Your signature comes from Settings. You can edit the text before sending. Opening Mail marks ${company.name} as pinged today.`}
        </Text>
        {!!status && <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>}
      </ScrollView>

      <View style={styles.bar}>
        <View style={styles.flex}><Button label="Copy text" variant="secondary" onPress={act('copy', () => copyBody(body), 'Copied, marked as pinged')} /></View>
        <View style={styles.flex}><Button label="Open in Mail" onPress={act('mail', () => openMail(to, subject, body), 'Marked as pinged')} /></View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  cancel: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  cancelText: { ...type.section, color: colors.accent },
  title: { ...type.title, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { gap: space.sm },
  label: { ...type.section, color: colors.text },
  value: { ...type.body, color: colors.text },
  muted: { ...type.body, color: colors.textFaint },
  help: { fontSize: 13, color: colors.textFaint },
  status: { ...type.body, color: colors.accent },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, ...type.body, color: colors.text },
  bodyInput: { minHeight: 260 },
  flex: { flex: 1, minWidth: 0 },
  bar: {
    flexDirection: 'row', gap: space.sm, padding: space.lg, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
