import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';

interface Props { label: string; onPress: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, primary ? styles.primary : styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.label, { color: primary ? colors.onAccent : colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, paddingHorizontal: space.lg,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  disabled: { opacity: 0.5 },
  label: { ...type.section },
});
