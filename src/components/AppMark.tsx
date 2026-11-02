import { View } from 'react-native';
import { colors } from '../theme/tokens';

/** Three connected track marks: solid, solid, ring. Decorative. */
export function AppMark() {
  const dot = { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent };
  const link = { width: 10, height: 2, backgroundColor: colors.accent };
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={dot} /><View style={link} /><View style={dot} /><View style={link} />
      <View style={[dot, { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.accent }]} />
    </View>
  );
}
