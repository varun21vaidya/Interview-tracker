import { View, type DimensionValue } from 'react-native';
import { colors, radius, space } from '../theme/tokens';

/** Flat placeholder block. No animation. */
export function Skeleton({ width = '100%', height, round = radius.inner }: { width?: DimensionValue; height: number; round?: number }) {
  return <View style={{ width, height, borderRadius: round, backgroundColor: colors.disabledBg }} />;
}

/** Same footprint as the Next card and two rows, so nothing shifts when data arrives. */
export function HomeSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading" style={{ gap: space.lg }}>
      <Skeleton height={180} round={radius.card} />
      <Skeleton width="40%" height={18} />
      <Skeleton height={64} round={radius.card} />
      <Skeleton height={64} round={radius.card} />
    </View>
  );
}
