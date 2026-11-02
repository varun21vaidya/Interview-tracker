import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useLayout } from '../hooks/useLayout';
import { space } from '../theme/tokens';

interface Props extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: ReactNode; bottomPad?: number; contentStyle?: StyleProp<ViewStyle>;
}

/** Scrolling content: gutters, a centred column on tablets, one gap between blocks. */
export function Page({ children, bottomPad = space.xl, contentStyle, ...rest }: Props) {
  const { gutter, contentWidth } = useLayout();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { paddingHorizontal: gutter, paddingBottom: bottomPad, width: contentWidth, alignSelf: 'center', gap: space.lg },
        contentStyle,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
