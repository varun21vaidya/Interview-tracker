import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';

interface Props { label: string; selected?: boolean; onPress: () => void }

/** Selectable chip. Selected is filled teal. */
export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.label, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { ...type.body, fontWeight: '600' },
});
