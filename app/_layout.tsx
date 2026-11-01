import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Stack } from 'expo-router';
import { getDb } from '../src/db/client';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getDb().then(() => { setError(null); setReady(true); }).catch(setError);
  }, [attempt]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text>Could not open the database: {error.message}</Text>
        <Button label="Try again" onPress={() => setAttempt(a => a + 1)} />
      </View>
    );
  }
  if (!ready) return null;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="debug-events" options={{ title: 'Debug events (temporary)' }} />
      <Stack.Screen name="spike"options={{ title: 'Spike (temporary)' }} />
    </Stack>
  );
}
