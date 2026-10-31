import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Bubble } from '../../../src/components/Bubble';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { RoundRow } from '../../../src/components/RoundRow';
import { StatTile } from '../../../src/components/StatTile';
import { markPinged, notMovingForward, reopenCompany, saveNotes, setResult } from '../../../src/db/repos/actions';
import { firstName, telUri } from '../../../src/domain/contact';
import { agoText, modeLabel, type CompanyDetailModel } from '../../../src/domain/detail';
import { shortDate } from '../../../src/domain/status';
import { useCompany } from '../../../src/hooks/useCompany';
import { colors, MIN_TOUCH, radius, space, type } from '../../../src/theme/tokens';
import type { Bundle } from '../../../src/types/entities';

type Template = 'follow_up' | 'check_fit';

// Email screen (3.6) is out of scope for this phase: stubbed. The template says which text it will open with.
const openEmail = (_companyId: string, _template: Template) => {};

const pingDateText = (pings: number[]) => pings.map(shortDate).join(', ');

export default function CompanyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bundle, model, now, error, loading, missing } = useCompany(id);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  if (!bundle || !model) {
    const text = error ? 'Could not load this company.' : missing ? 'This company no longer exists.' : loading ? '' : '';
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.content}>
          <BackLink onPress={back} />
          {!!text && <Text style={styles.empty}>{text}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const { company, recruiter } = bundle;
  const { rejected, timeline, target } = model;
  const call = [...bundle.calls].sort((a, b) => b.callAt - a.callAt)[0];
  const contactName = recruiter?.name ?? call?.recruiterName;
  const phone = recruiter?.phone;

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackLink onPress={back} />
        <Text accessibilityRole="header" style={styles.title}>{company.name}</Text>
        {!!model.subtitle && <Text style={styles.subtitle}>{model.subtitle}</Text>}
        <View style={styles.bubbleRow}>
          {model.bubbles.map(b => <Bubble key={b.text} {...b} />)}
        </View>
        {rejected && <Button label="Reopen" variant="secondary" onPress={() => reopenCompany(company.id)} />}

        {!timeline && (
          <View style={styles.tiles}>
            <StatTile value={model.approved} label="Rounds approved" />
            <StatTile value={model.awaiting} label="Awaiting result" />
          </View>
        )}

        {timeline
          ? <TimelineCard bundle={bundle} model={model} onNotMoving={() => notMovingForward(company.id)} />
          : <RoundsCard model={model} />}

        {target && (
          <FollowUpCard
            title="Follow up"
            helpLine={target.type === 'round'
              ? 'Ping status tracks the latest round only and clears when you get its result.'
              : undefined}
            onEmail={() => openEmail(company.id, target.type === 'round' ? 'follow_up' : 'check_fit')}
            onCall={phone ? () => Linking.openURL(telUri(phone)) : undefined}
            callLabel={firstName(contactName) ? `Call ${firstName(contactName)}` : 'Call'}
            onPinged={() => markPinged(company.id, target, 'mark')}
          >
            {target.type === 'round'
              ? <RoundSummary bundle={bundle} model={model} now={now} />
              : <Text style={styles.body}>
                  {`${firstName(contactName) ?? 'The recruiter'} said they would schedule the next step. Ask for an update, or check if your profile fits.`}
                </Text>}
          </FollowUpCard>
        )}

        <RecruiterCard name={contactName} phone={phone} email={recruiter?.email} />

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Job description</Text>
          <Text style={styles.muted}>Coming soon.</Text>
        </Card>

        <NotesCard key={company.id} companyId={company.id} initial={company.notes ?? ''} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Back to Companies" onPress={onPress} style={styles.back}>
      <Text style={styles.backText}>‹ Companies</Text>
    </Pressable>
  );
}

function RoundsCard({ model }: { model: CompanyDetailModel }) {
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Rounds</Text>
      {model.rows.map(row => (
        <RoundRow key={row.round.id} row={row}>
          {row.round.source === 'manual' && (
            <Button label="Edit" variant="secondary" onPress={() => router.push({ pathname: '/add', params: { roundId: row.round.id } })} />
          )}
          {row.actions && (
            <View style={styles.actions}>
              <View style={styles.pair}>
                <View style={styles.flex}><Button label="Mark approved" onPress={() => setResult(row.round.id, 'approved')} /></View>
                <View style={styles.flex}><Danger label="Mark rejected" onPress={() => setResult(row.round.id, 'rejected')} /></View>
              </View>
              <Button label="Interview didn’t happen" variant="secondary" onPress={() => setResult(row.round.id, 'didnt_happen')} />
              <Text style={styles.help}>
                Rejected moves the company to Rejected. Didn’t happen is not counted and tracks no result or ping.
              </Text>
            </View>
          )}
        </RoundRow>
      ))}
    </Card>
  );
}

function TimelineCard({ bundle, model, onNotMoving }: { bundle: Bundle; model: CompanyDetailModel; onNotMoving: () => void }) {
  const call = [...bundle.calls].sort((a, b) => b.callAt - a.callAt)[0];
  const who = call?.recruiterName ?? bundle.recruiter?.name;
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Timeline</Text>
      {call && (
        <View style={styles.timelineRow}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Recruiter call</Text>
            <Text style={styles.body}>{[shortDate(call.callAt), modeLabel('phone'), who].filter(Boolean).join(' · ')}</Text>
          </View>
          <Bubble text="Call done" tone="green" />
        </View>
      )}
      <View style={styles.timelineRow}>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Interview</Text>
          <Text style={styles.body}>Not scheduled yet</Text>
        </View>
        <Bubble text="Waiting" tone="blue" />
      </View>
      {!model.rejected && <Danger label="Not moving forward" onPress={onNotMoving} />}
      <Text style={styles.help}>When an invite arrives, refresh adds it here as round 1.</Text>
    </Card>
  );
}

function RoundSummary({ bundle, model, now }: { bundle: Bundle; model: CompanyDetailModel; now: number }) {
  const round = bundle.rounds.find(r => r.id === model.target?.id);
  return (
    <View style={styles.gap}>
      {round && <Text style={styles.body}>{`Latest round: ${round.label}, ${agoText(round.startsAt, now)}`}</Text>}
      {model.pings.length > 0 && <Text style={styles.body}>{`Pings: ${pingDateText(model.pings)}`}</Text>}
    </View>
  );
}

interface FollowProps {
  title: string; helpLine?: string; children: ReactNode; callLabel: string;
  onEmail: () => void; onCall?: () => void; onPinged: () => void;
}

function FollowUpCard({ title, helpLine, children, callLabel, onEmail, onCall, onPinged }: FollowProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
      <View style={styles.actions}>
        <Button label="Email follow-up" onPress={onEmail} />
        {onCall && <Button label={callLabel} variant="secondary" onPress={onCall} />}
        <Button label="Mark as pinged" variant="secondary" onPress={onPinged} />
      </View>
      {!!helpLine && <Text style={styles.help}>{helpLine}</Text>}
    </Card>
  );
}

function RecruiterCard({ name, phone, email }: { name?: string; phone?: string; email?: string }) {
  const line = [name, phone, email].filter(Boolean).join(' · ');
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Recruiter</Text>
      <Text style={line ? styles.body : styles.muted}>{line || 'No recruiter details yet.'}</Text>
      <View style={styles.pair}>
        <View style={styles.flex}><CopyButton label="Copy number" text={phone} /></View>
        <View style={styles.flex}><CopyButton label="Copy email" text={email} /></View>
      </View>
      <Button label="Call" disabled={!phone} onPress={() => phone && Linking.openURL(telUri(phone))} />
    </Card>
  );
}

/** Copies on press and says "Copied" for a moment. */
function CopyButton({ label, text }: { label: string; text?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const press = async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1500);
  };
  return <Button label={done ? 'Copied' : label} variant="secondary" disabled={!text} onPress={press} />;
}

function NotesCard({ companyId, initial }: { companyId: string; initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Your notes</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => { if (text !== initial) saveNotes(companyId, text); }}
        multiline
        textAlignVertical="top"
        placeholder="Prep, questions asked, feedback"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Your notes"
        style={styles.notes}
      />
    </Card>
  );
}

/** Red action button (Mark rejected, Not moving forward). Same size and shape as Button. */
function Danger({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.danger}>
      <Text style={styles.dangerLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  back: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { ...type.section, color: colors.accent },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted },
  bubbleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tiles: { flexDirection: 'row', gap: space.md },
  card: { gap: space.sm },
  cardTitle: { ...type.section, color: colors.text },
  rowTitle: { ...type.name, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
  muted: { ...type.body, color: colors.textFaint },
  help: { fontSize: 13, color: colors.textFaint },
  empty: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xl },
  gap: { gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  actions: { gap: space.sm, marginTop: space.xs },
  pair: { flexDirection: 'row', gap: space.sm },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  notes: {
    minHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, ...type.body, color: colors.text,
  },
  danger: {
    minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, paddingHorizontal: space.lg, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#B42318',
  },
  dangerLabel: { ...type.section, color: '#FFFFFF' },
});
