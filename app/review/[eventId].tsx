import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomBar } from '../../src/components/BottomBar';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { InlineError } from '../../src/components/InlineError';
import { Page } from '../../src/components/Page';
import { RoundTrack } from '../../src/components/RoundTrack';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { dismissEvent, loadReviewScreen, placeEvent } from '../../src/db/repos/review';
import { eventWhen, lastRoundText, orderCompanies, placeLabel, positionOptions } from '../../src/domain/review';
import { roundMarks } from '../../src/domain/roundTrack';
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
  const [failure, setFailure] = useState('');
  const finished = useRef(false);          // after a decision the reload shows "no longer open"; keep that flash hidden
  const [now] = useState(() => Date.now());

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
    setBusy(true); setFailure('');
    finished.current = true;
    try { await action(); then(); } catch { finished.current = false; setFailure('Could not save. Nothing was changed, try again.'); } finally { setBusy(false); }
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
    <Screen keyboard>
      <Page>
        <ScreenHeader back={{ label: 'Home', onPress: goBack }} title="Which company?" />

        {!!error && <InlineError message="Could not load this event." />}
        {data && !item && !finished.current && <Text style={[type.body, { color: colors.muted }]}>This event is no longer waiting for a decision.</Text>}

        {data && item && (
          <>
            <View style={styles.eventCard}>
              <Text style={[type.name, { color: tones.amber.fg }]}>{item.event.title || '(no title)'}</Text>
              <Text style={[type.body, { color: tones.amber.fg }]}>{eventWhen(item.event)}</Text>
              <Text style={[type.body, { color: tones.amber.fg }]}>
                From your calendar.{item.event.organizerEmail ? ` Organizer: ${item.event.organizerEmail}.` : ''} I couldn't tell which company this is.
              </Text>
            </View>

            <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Add to an existing company</Text>
            {companies.length === 0 && <Text style={[type.body, { color: colors.muted }]}>No active companies yet. Create one below.</Text>}
            {companies.length > 0 && (
              <Card style={styles.panel}>
                {companies.map((c, i) => {
                  const on = c.id === selected;
                  const b = bundleOf(c.id);
                  const marks = roundMarks(b.rounds, now);
                  return (
                    <Fragment key={c.id}>
                      {i > 0 && <View style={styles.rule} />}
                      <Pressable
                        accessibilityRole="radio" accessibilityState={{ checked: on }}
                        accessibilityLabel={`${c.name}${c.role ? `, ${c.role}` : ''}, ${lastRoundText(b)}`}
                        onPress={() => choose(c.id)}
                        style={({ pressed }) => [styles.radioRow, pressed && { backgroundColor: colors.pressed }]}
                      >
                        <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                        <View style={styles.flex}>
                          <Text style={[on ? type.name : type.bodyStrong, { color: colors.text }]}>{c.name}</Text>
                          <Text style={[type.body, { color: colors.muted }]}>{[c.role, lastRoundText(b)].filter(Boolean).join(' · ')}</Text>
                          {marks.length > 0 && <View style={styles.track}><RoundTrack marks={marks} /></View>}
                        </View>
                      </Pressable>
                    </Fragment>
                  );
                })}
              </Card>
            )}

            {chosen && options && (
              <>
                <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Place it as</Text>
                <View accessibilityRole="radiogroup" style={styles.chips}>
                  {options.positions.map(p => (
                    <Chip key={p} radio label={`Round ${p}`} selected={p === position} onPress={() => setPosition(p)} />
                  ))}
                </View>
                <Text style={[type.small, { color: colors.muted }]}>Choosing another number renumbers later rounds automatically.</Text>
              </>
            )}

            <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Or it's a new company</Text>
            <TextField
              accessibilityLabel="New company name" value={newName} onChangeText={setNewName}
              placeholder="e.g. Stark Industries" maxLength={MAX_NAME}
            />
            <Button label="Create new company" variant="secondary" onPress={createNew} disabled={!nameOk || busy} />

            <View style={styles.later}>
              <Button label="Decide later" variant="secondary" onPress={goBack} disabled={busy} />
              <Button label="Not an interview" variant="secondary" onPress={notInterview} disabled={busy} />
            </View>
          </>
        )}
      </Page>

      {data && item && (
        <BottomBar above={!!failure && <Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.danger }]}>{failure}</Text>}>
          <Button
            label={chosen ? placeLabel(chosen.company.name, position) : 'Choose a company above'}
            onPress={place} disabled={!chosen || busy}
          />
        </BottomBar>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  eventCard: {
    backgroundColor: tones.amber.bg, borderColor: tones.amber.border, borderWidth: 1,
    borderRadius: radius.input, padding: space.lg, gap: space.xs,
  },
  panel: { paddingVertical: space.xs },
  rule: { height: 1, backgroundColor: colors.rule },
  radioRow: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  radio: { width: 22, height: 22, marginTop: 1, borderRadius: 11, borderWidth: 2, borderColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  track: { marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  later: { gap: space.sm, marginTop: space.sm },
});
