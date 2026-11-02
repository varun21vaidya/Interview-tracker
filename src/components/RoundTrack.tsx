import { StyleSheet, View } from 'react-native';
import { trackLabel, type RoundMark } from '../domain/roundTrack';
import { colors } from '../theme/tokens';

const S = 12;

function Mark({ kind }: { kind: RoundMark }) {
  switch (kind) {
    case 'approved': return <View style={[styles.slot, styles.circle, { backgroundColor: colors.positive }]} />;
    case 'rejected': return <View style={[styles.slot, { backgroundColor: colors.danger, borderRadius: 2 }]} />;
    case 'pending':
      return (
        <View style={[styles.slot, styles.circle, styles.ring, styles.center]}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />
        </View>
      );
    case 'upcoming': return <View style={[styles.slot, styles.circle, styles.ring]} />;
    case 'didnt_happen':
      return <View style={[styles.slot, styles.center]}><View style={{ width: 8, height: 2, backgroundColor: colors.muted }} /></View>;
    case 'cancelled':
      return (
        <View style={[styles.slot, styles.circle, styles.center, { borderWidth: 1.5, borderColor: colors.muted, overflow: 'hidden' }]}>
          <View style={{ width: 14, height: 1.5, backgroundColor: colors.muted, transform: [{ rotate: '-45deg' }] }} />
        </View>
      );
  }
}

/** One mark per round, joined by short rules. Shape carries the meaning, not just colour. */
export function RoundTrack({ marks }: { marks: RoundMark[] }) {
  if (marks.length === 0) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={trackLabel(marks)} style={styles.track}>
      {marks.map((m, i) => (
        <View key={i} style={styles.item}>
          {i > 0 && <View style={styles.link} />}
          <Mark kind={m} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 6 },
  item: { flexDirection: 'row', alignItems: 'center' },
  link: { width: 10, height: 2, backgroundColor: colors.rule },
  slot: { width: S, height: S },
  circle: { borderRadius: S / 2 },
  ring: { borderWidth: 2, borderColor: colors.accent },
  center: { alignItems: 'center', justifyContent: 'center' },
});
