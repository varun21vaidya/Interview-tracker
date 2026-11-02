import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, radius, space, tones, type, type Tone } from '../theme/tokens';
import { Icon } from './Icon';

interface Action { label: string; onPress: () => void }
interface Props {
  tone: Extract<Tone, 'amber' | 'blue'>; text: string; onPress?: () => void;
  /** Small buttons under the text (blue banner: Change, Undo). */
  actions?: Action[];
}

/** Banner between the heading and the card. Tappable only when it has an action. */
export function Banner({ tone, text, onPress, actions }: Props) {
  const t = tones[tone];
  const border = 'border' in t ? { borderWidth: 1, borderColor: t.border } : null;
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }, border]}>
      <Pressable accessibilityRole={onPress ? 'button' : 'text'} disabled={!onPress} onPress={onPress} style={styles.body}>
        <Text style={[type.bodyStrong, styles.text, { color: t.fg }]}>{text}</Text>
        {!!onPress && <Icon name="chevron-right" size={18} color={t.fg} />}
      </Pressable>
      {!!actions?.length && (
        <View style={styles.actions}>
          {actions.map(a => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={styles.action}>
              <Text style={[type.bodyStrong, { color: t.fg, textDecorationLine: 'underline' }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.input, paddingHorizontal: space.lg },
  body: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  text: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.lg },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
