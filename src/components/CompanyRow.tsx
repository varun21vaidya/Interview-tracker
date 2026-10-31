import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Bundle } from '../types/entities';
import { companyRow } from '../domain/status';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { Bubble } from './Bubble';
import { Card } from './Card';

interface Props { bundle: Bundle; now: number; onPress: (companyId: string) => void }

export function CompanyRow({ bundle, now, onPress }: Props) {
  const { company } = bundle;
  const { statusLine, bubbles } = companyRow(bundle, now);
  const rejected = company.status === 'rejected';
  // Rejected rows show "role · out after round N" on one line; active rows show role, then the status line.
  const subtitle = rejected ? [company.role, statusLine].filter(Boolean).join(' · ') : company.role;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[company.name, subtitle, rejected ? '' : statusLine, ...bubbles.map(b => b.text)].filter(Boolean).join(', ')}
      onPress={() => onPress(company.id)}
      style={styles.press}
    >
      <Card muted={rejected}>
        <View style={styles.row}>
          <View style={styles.main}>
            <Text style={[styles.name, rejected && styles.dim]}>{company.name}</Text>
            {!!subtitle && <Text style={[styles.line, rejected && styles.dim]}>{subtitle}</Text>}
            {!rejected && <Text style={styles.line}>{statusLine}</Text>}
          </View>
          <View style={styles.bubbles}>
            {bubbles.map(b => <Bubble key={b.text} {...b} />)}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { minHeight: MIN_TOUCH },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  main: { flex: 1, minWidth: 0 },
  bubbles: { maxWidth: '45%', flexShrink: 0, alignItems: 'flex-end', gap: space.xs },
  name: { ...type.name, color: colors.text },
  line: { ...type.body, color: colors.textMuted },
  dim: { color: colors.textFaint },
});
