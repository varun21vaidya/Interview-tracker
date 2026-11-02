import { Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TOUCH, radius } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

interface Props { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }

/** 48px target, transparent at rest, a soft circle when pressed. */
export function IconButton({ icon, label, onPress, disabled, color }: Props) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && { backgroundColor: colors.pressed }]}
    >
      <Icon name={icon} size={22} color={disabled ? colors.muted : color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
