import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Icon } from '../../src/components/Icon';
import { InlineError } from '../../src/components/InlineError';
import { Page } from '../../src/components/Page';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
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
    <Screen>
      <Page>
        <ScreenHeader back={{ label: 'Home', onPress: goHome }} title="Needs review" />
        {!!error && <InlineError message="Could not load the list." />}
        {data?.length === 0 && <Text style={[type.body, { color: colors.muted }]}>Nothing needs your decision.</Text>}
        {!!data?.length && (
          <Card style={styles.panel}>
            {data.map(({ event }, i) => (
              <Fragment key={event.eventId}>
                {i > 0 && <View style={styles.rule} />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title || '(no title)'}, ${eventWhen(event)}. Choose the company`}
                  onPress={() => router.push({ pathname: '/review/[eventId]', params: { eventId: event.eventId } })}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.pressed }]}
                >
                  <View style={styles.main}>
                    <Text style={[type.name, { color: colors.text }]}>{event.title || '(no title)'}</Text>
                    <Text style={[type.body, { color: colors.muted }]}>{eventWhen(event)}</Text>
                    <Text style={[type.bodyStrong, { color: colors.accent, marginTop: space.xs }]}>Choose the company</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              </Fragment>
            ))}
          </Card>
        )}
      </Page>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { paddingVertical: space.xs },
  rule: { height: 1, backgroundColor: colors.rule },
  row: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  main: { flex: 1, minWidth: 0 },
});
