import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RoundRowModel } from '../domain/detail';
import { colors, space, type } from '../theme/tokens';
import { IconButton } from './IconButton';
import { RowHead } from './RowHead';

interface Props { row: RoundRowModel; onMore?: () => void; children?: ReactNode }

/** One round in the Rounds card. `children` is the action area under the row. */
export function RoundRow({ row, onMore, children }: Props) {
  const unnumbered = row.number === null;
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View
          accessible
          accessibilityLabel={`${row.title}, ${row.detail}, ${row.bubble.text}`}
          style={styles.head}
        >
          <RowHead
            main={(
              <>
                <Text style={[type.name, { color: unnumbered ? colors.muted : colors.text }]}>{row.title}</Text>
                <Text style={[type.body, { color: colors.muted }]}>{row.detail}</Text>
              </>
            )}
            bubbles={[row.bubble]}
          />
        </View>
        {onMore && <IconButton icon="more-horizontal" label={`Actions for ${row.title}`} onPress={onMore} />}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.sm, gap: space.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  head: { flex: 1, minWidth: 0, paddingTop: space.xs },
});
