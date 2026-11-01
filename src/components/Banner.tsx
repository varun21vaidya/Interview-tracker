import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, radius, space, tones, type, type Tone } from '../theme/tokens';

interface Action { label: string; onPress: () => void }
interface Props {
  tone: Extract<Tone, 'amber' | 'blue'>; text: string; onPress?: () => void;
  /** Small buttons under the text (blue banner: Change, Undo). */
  actions?: Action[];
}

/** Banner between the heading and the card. Tappable only when it has an action. */
export function Banner({ tone, text, onPress, actions }: Props) {
  const t = tones[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Pressable
        accessibilityRole={onPress ? 'button' : 'text'}
        disabled={!onPress}
        onPress={onPress}
        style={styles.body}
      >
        <Text style={[styles.text, { color: t.fg }]}>{text}</Text>
      </Pressable>
      {!!actions?.length && (
        <View style={styles.actions}>
          {actions.map(a => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={styles.action}>
              <Text style={[styles.actionText, { color: t.fg }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.md, paddingHorizontal: space.lg },
  body: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingVertical: space.sm },
  text: { ...type.body, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.lg },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  actionText: { ...type.body, fontWeight: '700', textDecorationLine: 'underline' },
});
