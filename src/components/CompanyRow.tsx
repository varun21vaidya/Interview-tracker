import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Bundle } from '../types/entities';
import { roundMarks, trackLabel } from '../domain/roundTrack';
import { companyRow } from '../domain/status';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { RoundTrack } from './RoundTrack';
import { RowHead } from './RowHead';

interface Props { bundle: Bundle; now: number; onPress: (companyId: string) => void }

export function CompanyRow({ bundle, now, onPress }: Props) {
  const { company } = bundle;
  const { statusLine, bubbles } = companyRow(bundle, now);
  const marks = useMemo(() => roundMarks(bundle.rounds, now), [bundle.rounds, now]);
  const rejected = company.status === 'rejected';
  // Rejected rows show "role · out after round N" on one line; active rows show role, then the status line.
  const subtitle = rejected ? [company.role, statusLine].filter(Boolean).join(' · ') : company.role;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[company.name, subtitle, rejected ? '' : statusLine, ...bubbles.map(b => b.text), marks.length ? trackLabel(marks) : '']
        .filter(Boolean).join(', ')}
      onPress={() => onPress(company.id)}
      style={({ pressed }) => [styles.press, pressed && { backgroundColor: colors.pressed }]}
    >
      <RowHead
        main={(
          <View style={styles.main}>
            <Text style={[type.name, { color: rejected ? colors.muted : colors.text }]}>{company.name}</Text>
            {!!subtitle && <Text style={[type.body, { color: colors.muted }]}>{subtitle}</Text>}
            {!rejected && <Text style={[type.body, { color: colors.muted }]}>{statusLine}</Text>}
            {marks.length > 0 && <View style={styles.track}><RoundTrack marks={marks} /></View>}
          </View>
        )}
        bubbles={bubbles}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { minHeight: MIN_TOUCH, paddingVertical: space.md },
  main: { gap: 0 },
  track: { marginTop: space.sm },
});
