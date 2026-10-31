import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors, space, type } from '../src/theme/tokens';

/** Stub route: the Add interview screen is built in a later phase. */
export default function Add() {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Add interview' }} />
      <Text style={styles.text}>Add interview is coming in a later phase.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  text: { ...type.body, color: colors.textMuted, textAlign: 'center' },
});
