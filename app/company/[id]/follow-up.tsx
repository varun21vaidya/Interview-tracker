import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomBar } from '../../../src/components/BottomBar';
import { Button } from '../../../src/components/Button';
import { Chip } from '../../../src/components/Chip';
import { InlineError } from '../../../src/components/InlineError';
import { Page } from '../../../src/components/Page';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { TextField } from '../../../src/components/TextField';
import { markPinged } from '../../../src/db/repos/actions';
import { getSignature } from '../../../src/db/repos/settings';
import { firstName } from '../../../src/domain/contact';
import type { CompanyDetailModel } from '../../../src/domain/detail';
import { buildEmail, defaultTemplate, emailContext, TEMPLATES, toField, type Template } from '../../../src/domain/email';
import { useCompany } from '../../../src/hooks/useCompany';
import { useData } from '../../../src/hooks/useData';
import { useLayout } from '../../../src/hooks/useLayout';
import { copyBody, openMail } from '../../../src/services/mail';
import { colors, space, type } from '../../../src/theme/tokens';
import type { Bundle } from '../../../src/types/entities';

const isTemplate = (v?: string): v is Template => TEMPLATES.some(t => t.id === v);

export default function FollowUp() {
  const { id, template } = useLocalSearchParams<{ id: string; template?: string }>();
  const router = useRouter();
  const { bundle, model, error, missing } = useCompany(id);
  const { data: signature } = useData(getSignature, []);
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  return (
    <Screen keyboard>
      {bundle && model && signature !== null
        // Keyed so a different company starts fresh; later data reloads never overwrite the user's edits.
        ? <Editor key={id} bundle={bundle} model={model} signature={signature} initial={isTemplate(template) ? template : undefined} onCancel={cancel} />
        : (
          <Page>
            <ScreenHeader cancel={cancel} title="Follow-up email" />
            {(error || missing) && <InlineError message={error ? 'Could not load this company.' : 'This company no longer exists.'} />}
          </Page>
        )}
    </Screen>
  );
}

interface EditorProps { bundle: Bundle; model: CompanyDetailModel; signature: string; initial?: Template; onCancel: () => void }

function Editor({ bundle, model, signature, initial, onCancel }: EditorProps) {
  const { company, recruiter } = bundle;
  const { height } = useLayout();
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

  const messageLines = Math.round((Math.max(200, Math.min(height * 0.4, 320)) - 24) / 22);

  return (
    <>
      <Page>
        <ScreenHeader cancel={onCancel} title="Follow-up email" />
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {TEMPLATES.map(t => <Chip key={t.id} radio label={t.label} selected={t.id === tpl} onPress={() => pick(t.id)} />)}
        </View>

        <View style={styles.to}>
          <Text style={[type.section, { color: colors.text }]}>To</Text>
          <Text style={[type.body, { color: to ? colors.text : colors.muted }]}>{to || 'No recruiter email'}</Text>
          {!!note && <Text style={[type.small, { color: colors.muted }]}>{note}</Text>}
        </View>
        <TextField label="Subject" value={subject} onChangeText={setSubject} />
        <TextField label="Message" value={body} onChangeText={setBody} lines={messageLines} />

        <Text style={[type.small, { color: colors.muted }]}>
          {`Company, role, round and date are filled in from the tracker. Your signature comes from Settings. You can edit the text before sending. Opening Mail marks ${company.name} as pinged today.`}
        </Text>
        {!!status && <Text accessibilityLiveRegion="polite" style={[type.bodyStrong, { color: colors.accent }]}>{status}</Text>}
      </Page>

      <BottomBar>
        <Button label="Copy text" variant="secondary" onPress={act('copy', () => copyBody(body), 'Copied, marked as pinged')} />
        <Button label="Open in Mail" onPress={act('mail', () => openMail(to, subject, body), 'Marked as pinged')} />
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  to: { gap: 2 },
});
