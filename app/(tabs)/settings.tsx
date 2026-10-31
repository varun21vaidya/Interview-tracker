import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { loadSampleData } from '../../src/db/seed';

export default function Settings() {
  const [status, setStatus] = useState('');

  return (
    <View style={styles.container}>
      <Text>Settings</Text>
      {__DEV__ && (
        <View style={styles.dev}>
          <Button
            title="Load sample data"
            onPress={() => {
              setStatus('Loading…');
              loadSampleData().then(() => setStatus('Sample data loaded'), e => setStatus(`Failed: ${e.message}`));
            }}
          />
          {status ? <Text>{status}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dev: { marginTop: 24, gap: 8, alignItems: 'center' },
});
