import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme/tokens';

interface Props { value: number; label: string }

export function Stat({ value, label }: Props) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <Text style={[type.figure, { color: colors.text }]}>{value}</Text>
      <Text style={[type.small, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ stat: { flex: 1, paddingHorizontal: space.lg } });
