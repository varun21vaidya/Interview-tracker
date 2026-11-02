import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string; selected?: boolean; onPress: () => void; icon?: IconName;
  /** Part of a pick-one group. */
  radio?: boolean; accessibilityLabel?: string;
}

/** Selectable chip. Selected is filled teal. */
export function Chip({ label, selected, onPress, icon, radio, accessibilityLabel }: Props) {
  const ink = selected ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={radio ? { checked: !!selected } : { selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: pressed ? colors.accentPressed : colors.accent, borderColor: pressed ? colors.accentPressed : colors.accent }
          : { backgroundColor: pressed ? colors.pressed : colors.raised, borderColor: colors.control },
      ]}
    >
      <Text style={[type.bodyStrong, { color: ink, flexShrink: 1 }]}>{label}</Text>
      {!!icon && <Icon name={icon} size={16} color={ink} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
});
