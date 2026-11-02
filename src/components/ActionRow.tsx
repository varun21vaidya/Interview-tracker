import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useLayout } from '../hooks/useLayout';
import { space } from '../theme/tokens';

/** Buttons side by side, stacked on small screens or large text. */
export function ActionRow({ children, stackAlways }: { children: ReactNode; stackAlways?: boolean }) {
  const { compact } = useLayout();
  const items = Children.toArray(children).filter(Boolean);
  const stack = compact || stackAlways;
  return (
    <View style={{ flexDirection: stack ? 'column' : 'row', gap: space.sm }}>
      {items.map((c, i) => <View key={i} style={stack ? undefined : { flex: 1, minWidth: 0 }}>{c}</View>)}
    </View>
  );
}
