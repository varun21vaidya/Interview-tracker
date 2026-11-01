import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { dismissEvent, loadReviewScreen, placeEvent } from '../../src/db/repos/review';
import { eventWhen, lastRoundText, orderCompanies, placeLabel, positionOptions } from '../../src/domain/review';
import { useData } from '../../src/hooks/useData';
import { colors, MIN_TOUCH, radius, space, tones, type } from '../../src/theme/tokens';

const MAX_NAME = 200;

/** Which company? (3.5). Nothing is pre-selected (D7) and nothing is created until the user confirms (D6). */
export default function WhichCompany() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { data, error } = useData(() => loadReviewScreen(eventId), [eventId]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const [selected, setSelected] = useState<string | null>(null);
  const [position, setPosition] = useState(1);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);          // after a decision the reload shows "no longer open"; keep that flash hidden

  const item = data?.item ?? null;
  const prefilled = useRef(false);
  useEffect(() => {
    if (item && !prefilled.current) { prefilled.current = true; setNewName(item.suggestedName ?? ''); }
  }, [item]);

  const companies = useMemo(
    () => (data && item ? orderCompanies(data.bundles.map(b => b.company), item.ranked) : []),
    [data, item]);
  const bundleOf = (id: string) => data!.bundles.find(b => b.company.id === id)!;
  const chosen = selected && data ? bundleOf(selected) : null;
  const options = chosen && item ? positionOptions(chosen, item.event.startsAt) : null;

  const choose = (id: string) => {
    setSelected(id);
    setPosition(positionOptions(bundleOf(id), item!.event.startsAt).initial);
  };

  const run = async (action: () => Promise<unknown>, then: () => void) => {
    if (busy) return;
    setBusy(true);
    finished.current = true;
    try { await action(); then(); } catch { finished.current = false; } finally { setBusy(false); }
  };
  const openCompany = (id: string | null) =>
    id ? router.replace({ pathname: '/company/[id]', params: { id } }) : goBack();   // null: someone else already decided it

  const place = () => {
    let id: string | null = null;
    return run(async () => { id = await placeEvent(eventId, { companyId: selected! }, position); }, () => openCompany(id));
  };
  const createNew = () => {
    let id: string | null = null;
    return run(async () => { id = await placeEvent(eventId, { newName }, null); }, () => openCompany(id));
  };
  const notInterview = () => run(() => dismissEvent(eventId), goBack);

  const nameOk = newName.trim().length > 0 && newName.trim().length <= MAX_NAME;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.back}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Which company?</Text>

          {error && <Text style={styles.muted}>Could not load this event.</Text>}
          {data && !item && !finished.current && <Text style={styles.muted}>This event is no longer waiting for a decision.</Text>}

          {data && item && (
            <>
              <View style={styles.eventCard}>
                <Text style={styles.eventTitle}>{item.event.title || '(no title)'}</Text>
                <Text style={styles.eventLine}>{eventWhen(item.event)}</Text>
                <Text style={styles.eventLine}>
                  From your calendar.{item.event.organizerEmail ? ` Organizer: ${item.event.organizerEmail}.` : ''} I couldn't tell which company this is.
                </Text>
              </View>

              <Text accessibilityRole="header" style={styles.section}>Add to an existing company</Text>
              {companies.length === 0 && <Text style={styles.muted}>No active companies yet. Create one below.</Text>}
              <View style={styles.stack}>
                {companies.map(c => {
                  const on = c.id === selected;
                  return (
                    <Pressable
                      key={c.id} accessibilityRole="radio" accessibilityState={{ checked: on }}
                      accessibilityLabel={`${c.name}${c.role ? `, ${c.role}` : ''}, ${lastRoundText(bundleOf(c.id))}`}
                      onPress={() => choose(c.id)}
                    >
                      <Card outlined={on} style={styles.radioRow}>
                        <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                        <View style={styles.flex}>
                          <Text style={styles.name}>{c.name}</Text>
                          <Text style={styles.muted}>{[c.role, lastRoundText(bundleOf(c.id))].filter(Boolean).join(' · ')}</Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>

              {chosen && options && (
                <>
                  <Text accessibilityRole="header" style={styles.section}>Place it as</Text>
                  <View style={styles.chips}>
                    {options.positions.map(p => (
                      <Chip key={p} label={`Round ${p}`} selected={p === position} onPress={() => setPosition(p)} />
                    ))}
                  </View>
                  <Text style={styles.muted}>Choosing another number renumbers later rounds automatically.</Text>
                </>
              )}

              <Text accessibilityRole="header" style={styles.section}>Or it's a new company</Text>
              <TextInput
                accessibilityLabel="New company name" value={newName} onChangeText={setNewName}
                placeholder="e.g. Stark Industries" placeholderTextColor={colors.textFaint} maxLength={MAX_NAME} style={styles.input}
              />
              <Button label="Create new company" variant="secondary" onPress={createNew} disabled={!nameOk || busy} />

              <View style={styles.later}>
                <Button label="Decide later" variant="secondary" onPress={goBack} disabled={busy} />
                <Button label="Not an interview" variant="secondary" onPress={notInterview} disabled={busy} />
              </View>
            </>
          )}
        </ScrollView>

        {data && item && (
          <View style={styles.footer}>
            <Button
              label={chosen ? placeLabel(chosen.company.name, position) : 'Choose a company above'}
              onPress={place} disabled={!chosen || busy}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  back: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { ...type.body, color: colors.accent, fontWeight: '600' },
  title: { ...type.title, color: colors.text },
  muted: { ...type.body, color: colors.textMuted },
  eventCard: { backgroundColor: tones.amber.bg, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  eventTitle: { ...type.name, color: tones.amber.fg },
  eventLine: { ...type.body, color: tones.amber.fg },
  section: { ...type.section, color: colors.text, marginTop: space.sm },
  stack: { gap: space.sm },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  name: { ...type.name, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: {
    minHeight: MIN_TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, backgroundColor: colors.surface, color: colors.text, fontSize: 15,
  },
  later: { gap: space.sm, marginTop: space.lg },
  footer: { padding: space.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
