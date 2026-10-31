import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { telUri } from '../domain/contact';
import type { NextModel } from '../domain/home';
import { colors, radius, space, type } from '../theme/tokens';
import { Button } from './Button';
import { Card } from './Card';

interface Props { model: NextModel }

export function NextCard({ model }: Props) {
  const { link, phone, recruiterName } = model;
  return (
    <Card outlined>
      <View style={styles.top}>
        <View style={styles.chips}>
          {model.chips.map(c => <Text key={c} style={styles.chip}>{c}</Text>)}
        </View>
        <Text style={styles.countdown}>{model.countdown}</Text>
      </View>
      <Text style={styles.name}>{model.name}</Text>
      <Text style={styles.line}>{model.title}</Text>
      <Text style={styles.line}>{model.timeText}</Text>

      {link && (
        <View style={styles.buttons}>
          <View style={styles.grow}><Button label="Join" onPress={() => Linking.openURL(link)} /></View>
          <View style={styles.grow}><Button label="Copy link" variant="secondary" onPress={() => Clipboard.setStringAsync(link)} /></View>
        </View>
      )}

      {(recruiterName || phone) && (
        <>
          <View style={styles.divider} />
          <View style={styles.recruiter}>
            <View style={styles.grow}>
              {!!recruiterName && <Text style={styles.recruiterName}>{recruiterName}</Text>}
              <Text style={styles.line}>{['Recruiter', phone].filter(Boolean).join(' · ')}</Text>
            </View>
            {!!phone && <Button label="Call" variant="secondary" onPress={() => Linking.openURL(telUri(phone))} />}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  chips: { flexDirection: 'row', gap: space.xs, flexShrink: 1, flexWrap: 'wrap' },
  chip: {
    ...type.bubble, color: colors.textMuted, backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3, overflow: 'hidden',
  },
  countdown: { ...type.section, color: colors.accent },
  name: { ...type.title, color: colors.text },
  line: { ...type.body, color: colors.textMuted },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  grow: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
  recruiter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  recruiterName: { ...type.name, color: colors.text },
});
