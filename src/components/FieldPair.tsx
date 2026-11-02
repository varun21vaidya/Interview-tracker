import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useLayout } from '../hooks/useLayout';
import { space } from '../theme/tokens';

/** Two fields side by side; one column when compact. */
export function FieldPair({ children }: { children: [ReactNode, ReactNode] }) {
  const { compact } = useLayout();
  return (
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md }}>
      {children.map((c, i) => <View key={i} style={compact ? undefined : { flex: 1, minWidth: 0 }}>{c}</View>)}
    </View>
  );
}
