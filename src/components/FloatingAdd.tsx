import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';

/** Pill height; scroll areas under it pad by at least this plus the tab bar. */
export const PILL_HEIGHT = MIN_TOUCH + space.sm;
export const TAB_BAR_HEIGHT = 64;
/** Bottom padding for the scroll content: the pill, its margin, and the tab bar. */
export const FLOATING_PADDING = PILL_HEIGHT + space.lg * 2 + TAB_BAR_HEIGHT;

export function FloatingAdd({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.pill}>
      <Text style={styles.label}>+ Add interview</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute', right: space.lg, bottom: space.lg, height: PILL_HEIGHT, minWidth: MIN_TOUCH,
    paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  label: { ...type.section, color: colors.onAccent },
});
