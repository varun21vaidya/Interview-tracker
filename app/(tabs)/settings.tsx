import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { loadSampleData } from '../../src/db/seed';
import { getSignature, setSignature } from '../../src/db/repos/settings';
import { useData } from '../../src/hooks/useData';
import { Card } from '../../src/components/Card';
import { colors, radius, space, type } from '../../src/theme/tokens';

export default function Settings() {
  const [status, setStatus] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text>Settings</Text>
      <SignatureCard />
      {__DEV__ && (
        <View style={styles.dev}>
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
});
