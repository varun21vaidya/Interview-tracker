import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Banner } from '../../src/components/Banner';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FLOATING_PADDING, FloatingAdd } from '../../src/components/FloatingAdd';
import { NextCard } from '../../src/components/NextCard';
import { PreviousCard, WaitingCard } from '../../src/components/WaitingCard';
import { markPinged } from '../../src/db/repos/actions';
import { undoAutoAdd } from '../../src/db/repos/sync';
import { dateLine, type WaitingModel } from '../../src/domain/home';
import { bannerText } from '../../src/domain/syncRules';
import { useHome } from '../../src/hooks/useHome';
import { useSync } from '../../src/hooks/useSync';
import { colors, space, type } from '../../src/theme/tokens';

export default function Home() {
  const router = useRouter();
  const { view, now, lastSync, error, refreshing, refresh } = useHome();
  const sync = useSync({ auto: true });          // app open and return to foreground, debounced to once a minute
  const onRefresh = () => { refresh(); void sync.run(); };

  const openCompany = (id: string) => router.push({ pathname: '/company/[id]', params: { id } });
  const addInterview = () => router.push('/add');
  // `model.template` says which text the email screen opens with (Check fit for a recruiter call only).
  const openEmail = (m: WaitingModel) =>
    router.push({ pathname: '/company/[id]/follow-up', params: { id: m.companyId, template: m.template } });
  const pinged = (m: WaitingModel) => { markPinged(m.companyId, m.target, 'mark'); };
  const openReviews = () => router.push('/review');
  // Change: take the round back out (like Undo) and open Which company? for the same event.
  const change = async (roundId: string) => {
    const eventId = await undoAutoAdd(roundId);
    if (eventId) router.push({ pathname: '/review/[eventId]', params: { eventId } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Tabs.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: FLOATING_PADDING }]}
        refreshControl={<RefreshControl refreshing={refreshing || sync.syncing} onRefresh={onRefresh} colors={[colors.accent]} />}
      >
        <View style={styles.heading}>
          <View style={styles.grow}>
            <Text accessibilityRole="header" style={styles.title}>Next interview</Text>
            <Text style={styles.date}>{dateLine(now, lastSync)}</Text>
          </View>
          <Button label="Refresh" variant="secondary" onPress={onRefresh} disabled={sync.syncing} />
        </View>

        {error && <Text style={styles.empty}>Could not load your interviews.</Text>}
        {!!sync.message && <Text accessibilityLiveRegion="polite" style={styles.syncNote}>{sync.message}</Text>}

        {view && (
          <>
            <View style={styles.banners}>
              {view.openReviews > 0 && (
                <Banner
                  tone="amber"
                  text={`${view.openReviews} ${view.openReviews === 1 ? 'event needs' : 'events need'} your decision. Tap to choose the company ›`}
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

            {view.empty ? (
              <Card>
                <Text style={styles.emptyTitle}>No interviews yet</Text>
                <Text style={styles.emptyBody}>Add your first interview, or connect a calendar in Settings.</Text>
                <View style={styles.actions}>
                  <View style={styles.grow}><Button label="Add interview" onPress={addInterview} /></View>
                  <View style={styles.grow}><Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} /></View>
                </View>
              </Card>
            ) : (
              <>
                {view.next
                  ? <NextCard model={view.next} />
                  : <Card><Text style={styles.emptyBody}>No upcoming interviews.</Text></Card>}

                {view.later.length > 0 && (
                  <Section title="Later">
                    {view.later.map(l => (
                      <Card key={l.roundId}>
                        <Text style={styles.laterName} onPress={() => openCompany(l.companyId)}>{l.name}</Text>
                        <Text style={styles.laterLine}>{l.line}</Text>
                      </Card>
                    ))}
                  </Section>
                )}

                {view.waiting.length > 0 && (
                  <Section title="Waiting for result">
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
      </ScrollView>
      <FloatingAdd onPress={addInterview} />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg },
  grow: { flex: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, marginBottom: space.md },
  title: { ...type.title, color: colors.text },
  date: { ...type.body, color: colors.textMuted },
  banners: { gap: space.sm, marginBottom: space.md },
  section: { marginTop: space.xl },
  sectionTitle: { ...type.section, color: colors.text, marginBottom: space.sm },
  stack: { gap: space.md },
  laterName: { ...type.name, color: colors.text },
  laterLine: { ...type.body, color: colors.textMuted },
  syncNote: { ...type.body, color: colors.textMuted, marginBottom: space.sm },
  empty: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xl },
  emptyTitle: { ...type.name, color: colors.text, marginBottom: space.xs },
  emptyBody: { ...type.body, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
});
