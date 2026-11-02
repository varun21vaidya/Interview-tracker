import type { ReactNode } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

interface Props { children: ReactNode; edges?: Edge[]; keyboard?: boolean }

/** Safe-area frame. `keyboard` pads by the real keyboard overlap (needs a device check on Android). */
export function Screen({ children, edges = ['top', 'bottom'], keyboard }: Props) {
  const body = keyboard
    ? <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">{children}</KeyboardAvoidingView>
    : children;
  return <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.ground }}>{body}</SafeAreaView>;
}
