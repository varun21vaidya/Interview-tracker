import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLayout } from '../hooks/useLayout';
import { colors, space } from '../theme/tokens';
import { ActionRow } from './ActionRow';

/** Pinned actions under a scrolling screen. The Screen frame already handles the bottom inset. */
export function BottomBar({ children, stackAlways, above }: { children: ReactNode; stackAlways?: boolean; above?: ReactNode }) {
  const { contentWidth } = useLayout();
  return (
    <View style={styles.bar}>
      <View style={{ width: contentWidth - space.lg * 2, maxWidth: '100%', alignSelf: 'center', gap: space.sm }}>
        {above}
        <ActionRow stackAlways={stackAlways}>{children}</ActionRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.ground, borderTopWidth: 1, borderTopColor: colors.rule, padding: space.lg },
});
