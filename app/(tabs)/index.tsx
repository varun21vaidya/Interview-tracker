import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text>Home</Text>
      {/* Temporary: remove after Phase 0 */}
      <Link href="/spike" style={styles.link}>
        Open calendar spike
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  link: { color: '#0F766E', padding: 12 },
});
