import { Children, Fragment, type ReactNode } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionRow } from '../../src/components/ActionRow';
import { AppMark } from '../../src/components/AppMark';
import { Banner } from '../../src/components/Banner';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FLOATING_PADDING, FloatingAdd } from '../../src/components/FloatingAdd';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import { InlineError } from '../../src/components/InlineError';
import { NextCard } from '../../src/components/NextCard';
import { Page } from '../../src/components/Page';
import { Screen } from '../../src/components/Screen';
import { HomeSkeleton } from '../../src/components/Skeleton';
import { PreviousCard, WaitingCard } from '../../src/components/WaitingCard';
import { markPinged } from '../../src/db/repos/actions';
import { undoAutoAdd } from '../../src/db/repos/sync';
import { dateLine, type WaitingModel } from '../../src/domain/home';
import { bannerText } from '../../src/domain/syncRules';
import { useAccessCard } from '../../src/hooks/useAccessCard';
import { useActionRunner } from '../../src/hooks/useActionRunner';
import { useHome } from '../../src/hooks/useHome';
import { useSync } from '../../src/hooks/useSync';
import { colors, MIN_TOUCH, space, type } from '../../src/theme/tokens';

export default function Home() {
  const router = useRouter();
  const { view, now, lastSync, error, refreshing, refresh } = useHome();
  const showAccess = useAccessCard();
  const sync = useSync({ auto: true });          // app open and return to foreground, debounced to once a minute
  const { error: actionError, run } = useActionRunner();
  const onRefresh = () => { refresh(); void sync.run(); };

  const openCompany = (id: string) => router.push({ pathname: '/company/[id]', params: { id } });
  const addInterview = () => router.push('/add');
  // `model.template` says which text the email screen opens with (Check fit for a recruiter call only).
  const openEmail = (m: WaitingModel) =>
    router.push({ pathname: '/company/[id]/follow-up', params: { id: m.companyId, template: m.template } });
  const pinged = (m: WaitingModel) => { void run(() => markPinged(m.companyId, m.target, 'mark'), 'Could not save the ping. Try again.')(); };
  const openReviews = () => router.push('/review');
  // Change: take the round back out (like Undo) and open Which company? for the same event.
  const change = async (roundId: string) => {
    const eventId = await undoAutoAdd(roundId);
    if (eventId) router.push({ pathname: '/review/[eventId]', params: { eventId } });
  };

  const n = view?.waiting.length ?? 0;

  return (
    <Screen edges={['top']}>
      <Page
        bottomPad={FLOATING_PADDING}
        refreshControl={<RefreshControl refreshing={refreshing || sync.syncing} onRefresh={onRefresh} colors={[colors.accent]} />}
      >
        <View style={styles.heading}>
          <View style={styles.grow}>
            <View style={styles.mark}><AppMark /></View>
            <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>Next interview</Text>
            <Text style={[type.small, { color: colors.muted }]}>{dateLine(now, lastSync)}</Text>
            {n > 0 && (
              <Text style={[type.bodyStrong, styles.finding]}>
                {`${n} ${n === 1 ? 'company' : 'companies'} waiting for a result`}
              </Text>
            )}
          </View>
          <IconButton icon="refresh-cw" label="Refresh" onPress={onRefresh} disabled={sync.syncing} />
        </View>

        {showAccess && (
          <Card style={styles.gap}>
            <Text style={[type.name, { color: colors.text }]}>Calendar access is off</Text>
            <Text style={[type.body, { color: colors.muted }]}>Allow calendar access to find new interviews. Manual entries still work.</Text>
            <ActionRow>
              <Button label="Open app settings" onPress={() => { void Linking.openSettings(); }} />
              <Button label="Settings tab" variant="secondary" onPress={() => router.push('/settings')} />
            </ActionRow>
          </Card>
        )}
        {!!error && <InlineError message="Could not load your interviews." onRetry={onRefresh} />}
        {!!actionError && <Banner tone="amber" text={actionError} />}
        {!!sync.message && <Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.muted }]}>{sync.message}</Text>}

        {view === null && !error && <HomeSkeleton />}

        {view && (
          <>
            {(view.openReviews > 0 || view.changed > 0 || view.added.length > 0) && (
              <View style={styles.banners}>
                {view.openReviews > 0 && (
                  <Banner
                    tone="amber"
                    text={`${view.openReviews} ${view.openReviews === 1 ? 'event needs' : 'events need'} your decision. Tap to choose the company`}
                    onPress={openReviews}
                  />
                )}
                {view.changed > 0 && (
                  <Banner tone="amber" text={`${view.changed} ${view.changed === 1 ? 'round was' : 'rounds were'} moved or cancelled.`} />
                )}
                {view.added.slice(0, 3).map(a => (
                  <Banner
                    key={a.roundId}
                    tone="blue"
                    text={bannerText(a)}
                    onPress={() => openCompany(a.companyId)}
                    actions={[
                      { label: 'Change', onPress: () => change(a.roundId) },
                      { label: 'Undo', onPress: () => { void undoAutoAdd(a.roundId); } },
                    ]}
                  />
                ))}
              </View>
            )}

            {view.empty ? (
              <Card style={styles.gap}>
                <Text style={[type.name, { color: colors.text }]}>No interviews yet</Text>
                <Text style={[type.body, { color: colors.muted }]}>Add your first interview, or connect a calendar in Settings.</Text>
                <ActionRow>
                  <Button label="Add interview" onPress={addInterview} />
                  <Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} />
                </ActionRow>
              </Card>
            ) : (
              <>
                {view.next
                  ? <NextCard model={view.next} onOpen={openCompany} />
                  : <Card><Text style={[type.body, { color: colors.muted }]}>No upcoming interviews.</Text></Card>}

                {view.later.length > 0 && (
                  <Section title="Later">
                    {view.later.map(l => (
                      <Pressable
                        key={l.roundId} accessibilityRole="button" accessibilityLabel={`${l.name}, ${l.line}`}
                        onPress={() => openCompany(l.companyId)}
                        style={({ pressed }) => [styles.later, pressed && { backgroundColor: colors.pressed }]}
                      >
                        <View style={styles.grow}>
                          <Text style={[type.name, { color: colors.text }]}>{l.name}</Text>
                          <Text style={[type.body, { color: colors.muted }]}>{l.line}</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color={colors.muted} />
                      </Pressable>
                    ))}
                  </Section>
                )}

                {view.waiting.length > 0 && (
                  <Section title="Waiting for result" count={view.waiting.length}>
                    {view.waiting.map(w => (
                      <WaitingCard key={w.companyId} model={w} onOpen={openCompany} onEmail={openEmail} onPinged={pinged} />
                    ))}
                  </Section>
                )}

                {view.previous.length > 0 && (
                  <Section title="Previous">
                    {view.previous.map(p => <PreviousCard key={p.companyId} model={p} onOpen={openCompany} />)}
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </Page>
      <FloatingAdd onPress={addInterview} />
    </Screen>
  );
}

/** One panel with ruled rows. */
function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>{title}{count ? ` · ${count}` : ''}</Text>
      <Card style={styles.panel}>
        {Children.toArray(children).map((c, i) => (
          <Fragment key={i}>{i > 0 && <View style={styles.rule} />}{c}</Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  gap: { gap: space.sm },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.lg },
  mark: { marginBottom: space.md },
  finding: { color: colors.accent, marginTop: space.xs },
  banners: { gap: space.sm },
  section: { gap: space.sm },
  panel: { paddingVertical: space.xs },
  rule: { height: 1, backgroundColor: colors.rule, marginVertical: space.sm },
  later: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
