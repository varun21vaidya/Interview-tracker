import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

interface Props { visible: boolean; onClose: () => void; title?: string; children: ReactNode }

/** Bottom sheet. Replaces every centred modal. */
export function Sheet({ visible, onClose, title, children }: Props) {
  const { contentWidth, height } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { width: contentWidth, maxHeight: height * 0.85, paddingBottom: insets.bottom + space.lg }]}>
          {!!title && <Text accessibilityRole="header" style={[type.name, { color: colors.text }]}>{title}</Text>}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface RowProps { label: string; icon: IconName; onPress: () => void; danger?: boolean }

export function MenuRow({ label, icon, onPress, danger }: RowProps) {
  const ink = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}
    >
      <Icon name={icon} size={20} color={ink} />
      <Text style={[type.bodyStrong, { color: ink, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.ground, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card,
    padding: space.lg, gap: space.sm, elevation: 8,
  },
  row: {
    minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.sm, borderRadius: radius.inner,
  },
});
