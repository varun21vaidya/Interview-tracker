import { Pressable, StyleSheet, Text } from 'react-native';
import { useLayout } from '../hooks/useLayout';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';

/** Pill height; scroll areas under it pad by this plus margins. The tab bar is already outside the scene. */
export const PILL_HEIGHT = MIN_TOUCH + space.sm;
export const FLOATING_PADDING = PILL_HEIGHT + space.lg * 2;

export function FloatingAdd({ onPress }: { onPress: () => void }) {
  const { gutter } = useLayout();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel="Add interview" onPress={onPress}
      style={({ pressed }) => [styles.pill, { right: gutter, backgroundColor: pressed ? colors.accentPressed : colors.accent }]}
    >
      <Icon name="plus" size={20} color={colors.onAccent} />
      <Text style={[type.button, { color: colors.onAccent }]}>Add interview</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute', bottom: space.lg, minHeight: PILL_HEIGHT, minWidth: MIN_TOUCH,
    paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: radius.pill,
    flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
});
