import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ActionRow } from '../../../src/components/ActionRow';
import { BottomBar } from '../../../src/components/BottomBar';
import { Button } from '../../../src/components/Button';
import { InlineError } from '../../../src/components/InlineError';
import { Page } from '../../../src/components/Page';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { TextField } from '../../../src/components/TextField';
import { loadJd, saveJd, type JdRecord } from '../../../src/db/repos/companies';
import { countWords, formatWords, MAX_LINK_CHARS, prepareJd, TEXT_ERROR } from '../../../src/domain/jd';
import { useData } from '../../../src/hooks/useData';
import { useLayout } from '../../../src/hooks/useLayout';
import { colors, type } from '../../../src/theme/tokens';

export default function EditJd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useData(async () => ({ jd: await loadJd(id) }), [id]);
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  return (
    <Screen keyboard>
      {data?.jd
        // Loaded once: later reloads never overwrite what is being typed.
        ? <Editor key={id} id={id} jd={data.jd} onCancel={cancel} onSaved={cancel} />
        : (
          <Page>
            <ScreenHeader cancel={cancel} title="Edit job description" />
            {(error || data) && <InlineError message={error ? 'Could not load this description.' : 'This company no longer exists.'} />}
          </Page>
        )}
    </Screen>
  );
}

function Editor({ id, jd, onCancel, onSaved }: { id: string; jd: JdRecord; onCancel: () => void; onSaved: () => void }) {
  const { height } = useLayout();
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
  const descHeight = Math.max(220, height * 0.42);
  const descLines = Math.round((descHeight - 24) / 22);

  return (
    <>
      <Page nestedScrollEnabled>
        <ScreenHeader cancel={onCancel} title="Edit job description" subtitle={subtitle || undefined} />

        <TextField
          label="Description" value={text} onChangeText={setText} lines={descLines} scrollEnabled style={{ maxHeight: descHeight - 24 }}
          placeholder="Paste the job description" error={tooLong ? problem : undefined}
        />
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted, fontVariant: ['tabular-nums'] }]}>{formatWords(words)}</Text>
        <ActionRow>
          <Button label="Paste new" variant="secondary" icon="clipboard" onPress={paste} />
          <Button label="Clear" variant="secondary" disabled={text === ''} onPress={() => { setText(''); setStatus(''); }} />
        </ActionRow>

        <TextField
          label="Posting link" value={link} onChangeText={setLink} placeholder="https://"
          maxLength={MAX_LINK_CHARS} autoCapitalize="none" autoCorrect={false} keyboardType="url"
          error={!!problem && !tooLong ? problem : undefined}
        />

        <Text style={[type.small, styles.help]}>Paste the correct description to replace this one, or edit it in place.</Text>
        {!!status && <Text accessibilityLiveRegion="polite" style={[type.bodyStrong, { color: colors.accent }]}>{status}</Text>}
      </Page>

      <BottomBar>
        <Button label={saving ? 'Saving…' : 'Save description'} disabled={saving || !!problem} onPress={save} />
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({ help: { color: colors.muted } });
