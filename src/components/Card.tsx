import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme/tokens';

interface Props { children: ReactNode; muted?: boolean; outlined?: boolean; style?: StyleProp<ViewStyle> }

/** Tonal panel, no border. `outlined` is the 2px teal outline (Next card only); `muted` the greyed look. */
export function Card({ children, muted, outlined, style }: Props) {
  return <View style={[styles.card, muted && styles.muted, outlined && styles.outlined, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg },
  muted: { backgroundColor: colors.disabledBg },
  outlined: { backgroundColor: colors.ground, borderColor: colors.accent, borderWidth: 2, padding: space.lg - 2 },
});
