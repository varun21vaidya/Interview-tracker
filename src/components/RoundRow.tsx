import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RoundRowModel } from '../domain/detail';
import { colors, space, type } from '../theme/tokens';
import { Bubble } from './Bubble';

interface Props { row: RoundRowModel; children?: ReactNode }

/** One round in the Rounds card. `children` is the action area under the latest pending round. */
export function RoundRow({ row, children }: Props) {
  const unnumbered = row.number === null;
  return (
    <View style={styles.wrap}>
      <View
        accessible
        accessibilityLabel={`${row.title}, ${row.detail}, ${row.bubble.text}`}
        style={styles.row}
      >
        <View style={styles.main}>
          <Text style={[styles.title, unnumbered && styles.dim]}>{row.title}</Text>
          <Text style={styles.detail}>{row.detail}</Text>
        </View>
        <View style={styles.bubble}><Bubble {...row.bubble} /></View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  main: { flex: 1, minWidth: 0 },
  bubble: { maxWidth: '45%', flexShrink: 0 },
  title: { ...type.name, color: colors.text },
  dim: { color: colors.textMuted },
  detail: { ...type.body, color: colors.textMuted },
});
