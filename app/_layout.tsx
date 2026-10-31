import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { getDb } from '../src/db/client';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getDb().then(() => setReady(true)).catch(setError);
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Could not open the database: {error.message}</Text>
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
