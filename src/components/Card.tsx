import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme/tokens';

interface Props { children: ReactNode; muted?: boolean; outlined?: boolean; style?: StyleProp<ViewStyle> }

/** White card; `muted` is the greyed rejected look, `outlined` the teal outline. */
export function Card({ children, muted, outlined, style }: Props) {
  return (
    <View style={[styles.card, muted && styles.muted, outlined && styles.outlined, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  muted: { backgroundColor: colors.surfaceMuted },
  outlined: { borderColor: colors.accent, borderWidth: 2 },
});
