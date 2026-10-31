import { Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TOUCH, radius, space, tones, type, type Tone } from '../theme/tokens';

interface Props { tone: Extract<Tone, 'amber' | 'blue'>; text: string; onPress?: () => void }

/** Banner between the heading and the card. Tappable only when it has an action. */
export function Banner({ tone, text, onPress }: Props) {
  const t = tones[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.banner, { backgroundColor: t.bg }]}
    >
      <Text style={[styles.text, { color: t.fg }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: MIN_TOUCH, justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  text: { ...type.body, fontWeight: '600' },
});
