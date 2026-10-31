import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { telUri } from '../domain/contact';
import type { PreviousModel, WaitingModel } from '../domain/home';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { Bubble } from './Bubble';
import { Button } from './Button';
import { Card } from './Card';

interface WaitingProps {
  model: WaitingModel;
  onOpen: (companyId: string) => void;
  onEmail: (model: WaitingModel) => void;
  onPinged: (model: WaitingModel) => void;
}

/** One entry per company with a pending result. No suggestions and no overdue colours. */
export function WaitingCard({ model, onOpen, onEmail, onPinged }: WaitingProps) {
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[model.name, model.line, model.pending.text, model.ping?.text].filter(Boolean).join(', ')}
        onPress={() => onOpen(model.companyId)}
        style={styles.head}
      >
        <View style={styles.main}>
          <Text style={styles.name}>{model.name}</Text>
          <Text style={styles.line}>{model.line}</Text>
        </View>
        <View style={styles.bubbles}>
          <Bubble {...model.pending} />
          {model.ping && <Bubble {...model.ping} />}
        </View>
      </Pressable>
      <View style={styles.row}>
        <View style={styles.grow}><Button label="Email follow-up" onPress={() => onEmail(model)} /></View>
        {!!model.phone && (
          <View style={styles.grow}><Button label="Call" variant="secondary" onPress={() => Linking.openURL(telUri(model.phone!))} /></View>
        )}
      </View>
      <View style={styles.full}><Button label="Mark as pinged" variant="secondary" onPress={() => onPinged(model)} /></View>
    </Card>
  );
}

/** The last round with its result bubble, same layout as the waiting header. */
export function PreviousCard({ model, onOpen }: { model: PreviousModel; onOpen: (companyId: string) => void }) {
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[model.name, model.line, model.bubble.text].join(', ')}
        onPress={() => onOpen(model.companyId)}
        style={styles.head}
      >
        <View style={styles.main}>
          <Text style={styles.name}>{model.name}</Text>
          <Text style={styles.line}>{model.line}</Text>
        </View>
        <View style={styles.bubbles}><Bubble {...model.bubble} /></View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: MIN_TOUCH },
  main: { flex: 1, minWidth: 0 },
  bubbles: { maxWidth: '45%', flexShrink: 0, alignItems: 'flex-end', gap: space.xs },
  name: { ...type.name, color: colors.text },
  line: { ...type.body, color: colors.textMuted },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  grow: { flex: 1 },
  full: { marginTop: space.sm },
});
