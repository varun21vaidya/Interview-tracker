import { StyleSheet, Text, View } from 'react-native';
import type { Bubble as BubbleModel } from '../domain/pings';
import { radius, tones, type } from '../theme/tokens';

/** Small status pill. Not interactive, so it is exempt from the 48 touch size. */
export function Bubble({ text, tone }: BubbleModel) {
  const t = tones[tone];
  const border = 'border' in t ? { borderWidth: 1, borderColor: t.border } : null;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, border]}>
      <Text maxFontSizeMultiplier={1.6} style={[type.bubble, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
});
