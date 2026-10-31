import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme/tokens';
import { Card } from './Card';

interface Props { value: number; label: string }

export function StatTile({ value, label }: Props) {
  return (
    <Card style={styles.tile}>
      <View accessible accessibilityLabel={`${label}: ${value}`}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },
  value: { ...type.title, color: colors.text },
  label: { ...type.body, color: colors.textMuted, marginTop: space.xs },
});
