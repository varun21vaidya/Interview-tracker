import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme/tokens';
import { Button } from './Button';

/** One sentence, inside the block that failed. A retry button only when the caller can retry. */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.text }]}>{message}</Text>
      {!!onRetry && <View style={styles.btn}><Button label="Try again" variant="secondary" onPress={onRetry} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: space.sm }, btn: { alignSelf: 'flex-start' } });
