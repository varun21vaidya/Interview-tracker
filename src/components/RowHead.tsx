import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Bubble as BubbleModel } from '../domain/pings';
import { useLayout } from '../hooks/useLayout';
import { space } from '../theme/tokens';
import { Bubble } from './Bubble';

/** Name and bubbles. Beside each other on wide screens; bubbles drop below on narrow ones or large text. */
export function RowHead({ main, bubbles }: { main: ReactNode; bubbles: BubbleModel[] }) {
  const { width, fontScale } = useLayout();
  const stacked = width < 380 || fontScale >= 1.15;
  return (
    <View style={stacked ? styles.column : styles.row}>
      <View style={stacked ? undefined : styles.main}>{main}</View>
      <View style={stacked ? styles.bubblesRow : styles.bubblesColumn}>
        {bubbles.map(b => <Bubble key={b.text} {...b} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0 },
  bubblesColumn: { alignItems: 'flex-end', gap: space.xs, flexShrink: 0, maxWidth: '50%' },
  column: { gap: space.sm },
  bubblesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
