import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { AppMark } from '../src/components/AppMark';
import { Button } from '../src/components/Button';
import { getDb } from '../src/db/client';
import { colors, space, type } from '../src/theme/tokens';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A font that fails to load must not block the app: the system font is used instead.
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSerif_400Regular,
  });

  useEffect(() => {
    getDb().then(() => { setError(null); setReady(true); }).catch(setError);
  }, [attempt]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg, backgroundColor: colors.ground }}>
        <AppMark />
        <Text style={[type.name, { color: colors.text }]}>Couldn’t open your data</Text>
        <Text style={[type.body, { color: colors.muted }]}>{error.message}</Text>
        <Button label="Try again" onPress={() => setAttempt(a => a + 1)} />
      </View>
    );
  }
  if (!ready || !(fontsLoaded || fontError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ground }}>
        <AppMark />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Screen name="debug-events" options={{ headerShown: true, title: 'Debug events (temporary)' }} />
      <Stack.Screen name="spike" options={{ headerShown: true, title: 'Spike (temporary)' }} />
    </Stack>
  );
}
