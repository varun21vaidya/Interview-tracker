import { StyleSheet, Text, View } from 'react-native';
import type { Bubble as BubbleModel } from '../domain/pings';
import { radius, space, tones, type } from '../theme/tokens';

/** Small status pill. Not interactive, so it is exempt from the 48 touch size. */
export function Bubble({ text, tone }: BubbleModel) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-end', maxWidth: '100%', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3 },
  text: { ...type.bubble, textAlign: 'center' },
});
