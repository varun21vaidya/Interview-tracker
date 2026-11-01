import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Card } from '../../src/components/Card';
import { loadOpenReviews } from '../../src/db/repos/review';
import { eventWhen } from '../../src/domain/review';
import { useData } from '../../src/hooks/useData';
import { colors, MIN_TOUCH, space, type } from '../../src/theme/tokens';

/** Needs review: every open calendar event waiting for a company decision. */
export default function ReviewList() {
  const router = useRouter();
  const { data, error } = useData(loadOpenReviews);
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable accessibilityRole="button" onPress={goHome} style={styles.back}>
          <Text style={styles.backText}>‹ Home</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Needs review</Text>
        {error && <Text style={styles.muted}>Could not load the list.</Text>}
        {data?.length === 0 && <Text style={styles.muted}>Nothing needs your decision.</Text>}
        {data?.map(({ event }) => (
          <Pressable
            key={event.eventId} accessibilityRole="button"
            onPress={() => router.push({ pathname: '/review/[eventId]', params: { eventId: event.eventId } })}
          >
            <Card>
              <Text style={styles.name}>{event.title || '(no title)'}</Text>
              <Text style={styles.muted}>{eventWhen(event)}</Text>
              <Text style={styles.link}>Choose the company ›</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.md },
  back: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { ...type.body, color: colors.accent, fontWeight: '600' },
  title: { ...type.title, color: colors.text },
  name: { ...type.name, color: colors.text },
  muted: { ...type.body, color: colors.textMuted },
  link: { ...type.body, color: colors.accent, fontWeight: '600', marginTop: space.xs },
});
