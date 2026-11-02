import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { Icon } from './Icon';

interface Props {
  back?: { label: string; onPress: () => void };
  cancel?: () => void;
  title: string; subtitle?: string; right?: ReactNode; display?: boolean;
}

export function ScreenHeader({ back, cancel, title, subtitle, right, display }: Props) {
  return (
    <View style={styles.wrap}>
      {back && (
        <Pressable accessibilityRole="link" accessibilityLabel={`Back to ${back.label}`} onPress={back.onPress} style={styles.nav}>
          <Icon name="chevron-left" size={20} color={colors.text} />
          <Text style={[type.bodyStrong, styles.navText]}>{back.label}</Text>
        </Pressable>
      )}
      {cancel && (
        <Pressable accessibilityRole="link" onPress={cancel} style={styles.nav}>
          <Text style={[type.bodyStrong, styles.navText]}>Cancel</Text>
        </Pressable>
      )}
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header" maxFontSizeMultiplier={display ? 1.6 : undefined}
          style={[display ? type.display : type.title, styles.title]}
        >
          {title}
        </Text>
        {right}
      </View>
      {!!subtitle && <Text style={[type.body, styles.subtitle]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  nav: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, paddingRight: space.md },
  navText: { color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { color: colors.text, flex: 1, minWidth: 0 },
  subtitle: { color: colors.muted },
});
