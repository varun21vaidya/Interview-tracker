import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'positive' | 'danger';
interface Props { label: string; onPress: () => void; variant?: Variant; disabled?: boolean; icon?: IconName }

const fill = {
  primary:   { rest: colors.accent,   down: colors.accentPressed,   label: colors.onAccent },
  positive:  { rest: colors.positive, down: colors.positivePressed, label: colors.onAccent },
  danger:    { rest: colors.danger,   down: colors.dangerPressed,   label: colors.onAccent },
  secondary: { rest: colors.raised,   down: colors.pressed,         label: colors.text },
};

export function Button({ label, onPress, variant = 'primary', disabled, icon }: Props) {
  const f = fill[variant];
  const ink = disabled ? colors.muted : f.label;
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: disabled ? colors.disabledBg : pressed ? f.down : f.rest },
        variant === 'secondary' && !disabled && styles.outline,
      ]}
    >
      {!!icon && <Icon name={icon} size={18} color={ink} />}
      <Text style={[type.button, styles.label, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  outline: { borderWidth: 1, borderColor: colors.control },
  label: { textAlign: 'center', flexShrink: 1 },
});
