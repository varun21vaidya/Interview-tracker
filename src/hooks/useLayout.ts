import { useWindowDimensions } from 'react-native';
import { CONTENT_MAX } from '../theme/tokens';

export function useLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  return {
    width, height, fontScale,
    compact: width < 360 || fontScale >= 1.3,   // side-by-side actions and fields stack
    gutter: width >= 400 ? 20 : 16,
    contentWidth: Math.min(width, CONTENT_MAX),
  };
}
