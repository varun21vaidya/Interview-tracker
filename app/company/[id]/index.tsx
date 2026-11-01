import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Banner } from '../../../src/components/Banner';
import { Bubble } from '../../../src/components/Bubble';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { JdCard } from '../../../src/components/JdCard';
import { RoundRow } from '../../../src/components/RoundRow';
import { StatTile } from '../../../src/components/StatTile';
import { markPinged, mergeCompanies, moveRound, notMovingForward, renameCompany, reopenCompany, saveNotes, setResult } from '../../../src/db/repos/actions';
import { loadBundles } from '../../../src/db/repos/bundles';
import { syncCompanyReminders, syncReminder } from '../../../src/services/notifications';
import { useData } from '../../../src/hooks/useData';
import { acceptCancel, acceptMove, keepRound, reopenRound } from '../../../src/db/repos/sync';
import { firstName, telUri } from '../../../src/domain/contact';
import { agoText, modeLabel, type CompanyDetailModel } from '../../../src/domain/detail';
import { defaultTemplate } from '../../../src/domain/email';
import { shortDate } from '../../../src/domain/status';
import { useActionRunner } from '../../../src/hooks/useActionRunner';
import { useCompany } from '../../../src/hooks/useCompany';
import { colors, MIN_TOUCH, radius, space, type } from '../../../src/theme/tokens';
import type { Bundle } from '../../../src/types/entities';

const pingDateText = (pings: number[]) => pings.map(shortDate).join(', ');

export default function CompanyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bundle, model, now, error, loading, missing } = useCompany(id);

  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);           // draft name while the rename box is open
  const [picker, setPicker] = useState<{ kind: 'merge' } | { kind: 'move'; roundId: string } | null>(null);
  const others = useData(loadBundles).data;
  const { error: actionError, run } = useActionRunner();

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
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, styles.flex]}>{company.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Company actions" onPress={() => setMenu(true)} style={styles.menuBtn}>
            <Text style={styles.menuDots}>⋯</Text>
          </Pressable>
        </View>
        {!!model.subtitle && <Text style={styles.subtitle}>{model.subtitle}</Text>}
        <View style={styles.bubbleRow}>
          {model.bubbles.map(b => <Bubble key={b.text} {...b} />)}
        </View>
        {!!actionError && <Banner tone="amber" text={actionError} />}
        {rejected && <Button label="Reopen" variant="secondary" onPress={run(() => reopenCompany(company.id), 'Could not reopen this company. Try again.')} />}

        {!timeline && (
          <View style={styles.tiles}>
            <StatTile value={model.approved} label="Rounds approved" />
            <StatTile value={model.awaiting} label="Awaiting result" />
          </View>
        )}

        {timeline
          ? <TimelineCard bundle={bundle} model={model} onNotMoving={run(() => notMovingForward(company.id), 'Could not update this company. Try again.')} />
          : <RoundsCard model={model} run={run} onMove={roundId => setPicker({ kind: 'move', roundId })} />}

        {target && (
          <FollowUpCard
            title="Follow up"
            helpLine={target.type === 'round'
              ? 'Ping status tracks the latest round only and clears when you get its result.'
              : undefined}
            onEmail={() => router.push({ pathname: '/company/[id]/follow-up', params: { id: company.id, template: defaultTemplate(target) } })}
            onCall={phone ? () => Linking.openURL(telUri(phone)) : undefined}
            callLabel={firstName(contactName) ? `Call ${firstName(contactName)}` : 'Call'}
            onPinged={run(() => markPinged(company.id, target, 'mark'), 'Could not save the ping. Try again.')}
          >
            {target.type === 'round'
              ? <RoundSummary bundle={bundle} model={model} now={now} />
              : <Text style={styles.body}>
                  {`${firstName(contactName) ?? 'The recruiter'} said they would schedule the next step. Ask for an update, or check if your profile fits.`}
                </Text>}
          </FollowUpCard>
        )}

        <RecruiterCard name={contactName} phone={phone} email={recruiter?.email} />

        <JdCard
          preview={company.jdPreview} words={company.jdWords} link={company.jdLink}
          onEdit={() => router.push({ pathname: '/company/[id]/jd-edit', params: { id: company.id } })}
          onView={() => router.push({ pathname: '/company/[id]/jd', params: { id: company.id } })}
        />

        <NotesCard key={company.id} companyId={company.id} initial={company.notes ?? ''} />
      </ScrollView>

      <Modal transparent animationType="fade" visible={menu} onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <View style={styles.sheet}>
            <Button label="Rename" variant="secondary" onPress={() => { setMenu(false); setRenaming(company.name); }} />
            <Button label="Merge with another company" variant="secondary" onPress={() => { setMenu(false); setPicker({ kind: 'merge' }); }} />
            {rejected
              ? <Button label="Reopen" variant="secondary" onPress={() => { setMenu(false); void run(() => reopenCompany(company.id), 'Could not reopen this company. Try again.')(); }} />
              : <Danger label="Not moving forward" onPress={() => { setMenu(false); void run(() => notMovingForward(company.id), 'Could not update this company. Try again.')(); }} />}
          </View>
        </Pressable>
      </Modal>

      {renaming !== null && (
        <RenameModal
          initial={renaming}
          onCancel={() => setRenaming(null)}
          onSave={async name => { await renameCompany(company.id, name); setRenaming(null); }}
        />
      )}

      {picker && (
        <CompanyPicker
          title={picker.kind === 'merge' ? 'Merge with which company?' : 'Move this round to which company?'}
          confirmLabel={picker.kind === 'merge'
            ? (n: string) => `Merge ${n} into ${company.name}`
            : (n: string) => `Move to ${n}`}
          note={picker.kind === 'merge'
            ? 'Its rounds, pings, notes and recruiter calls move here and that company is removed.'
            : 'Its result, pings and notes go with it.'}
          companies={(others ?? []).map(b => b.company).filter(c => c.id !== company.id)}
          onCancel={() => setPicker(null)}
          onConfirm={async target => {
            const ok = await run(async () => {
              if (picker.kind === 'merge') { await mergeCompanies(target, company.id); await syncCompanyReminders(company.id); }
              else { await moveRound(picker.roundId, target); await syncReminder(picker.roundId); }
            }, picker.kind === 'merge' ? 'Could not merge the companies. Nothing was changed.' : 'Could not move the round. Nothing was changed.')();
            setPicker(null);
            if (!ok) return;
          }}
        />
      )}
    </SafeAreaView>
  );
}

function RenameModal({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState('');
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.cardTitle}>Rename company</Text>
          <TextInput value={name} onChangeText={setName} autoFocus accessibilityLabel="Company name" style={styles.input} />
          {!!err && <Text style={styles.error}>{err}</Text>}
          <Button label="Save" onPress={() => onSave(name).catch(e => setErr(e instanceof Error ? e.message : 'Could not rename.'))} />
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

interface PickerProps {
  title: string; note: string; companies: { id: string; name: string }[];
  confirmLabel: (name: string) => string; onCancel: () => void; onConfirm: (id: string) => Promise<void>;
}

/** Pick a company, then confirm. Used by Merge and by Move to another company. */
function CompanyPicker({ title, note, companies, confirmLabel, onCancel, onConfirm }: PickerProps) {
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, styles.pickerSheet]}>
          <Text style={styles.cardTitle}>{title}</Text>
          {companies.length === 0 && <Text style={styles.muted}>There is no other company yet.</Text>}
          <ScrollView style={styles.pickerList}>
            {companies.map(c => (
              <Pressable
                key={c.id} accessibilityRole="button" accessibilityState={{ selected: chosen?.id === c.id }}
                onPress={() => setChosen(c)} style={[styles.pickRow, chosen?.id === c.id && styles.pickRowOn]}
              >
                <Text style={styles.rowTitle}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {chosen && <Text style={styles.help}>{note}</Text>}
          <Button
            label={chosen ? confirmLabel(chosen.name) : 'Choose a company'} disabled={!chosen || busy}
            onPress={() => { if (!chosen) return; setBusy(true); onConfirm(chosen.id).catch(() => setBusy(false)); }}
          />
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Back to Companies" onPress={onPress} style={styles.back}>
      <Text style={styles.backText}>‹ Companies</Text>
    </Pressable>
  );
}

type Runner = ReturnType<typeof useActionRunner>['run'];

function RoundsCard({ model, onMove, run }: { model: CompanyDetailModel; onMove: (roundId: string) => void; run: Runner }) {
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Rounds</Text>
      {model.rows.map(row => (
        <RoundRow key={row.round.id} row={row}>
          {row.change && <ChangeFlag roundId={row.round.id} change={row.change} />}
          <Button label="Move to another company" variant="secondary" onPress={() => onMove(row.round.id)} />
          {row.round.source === 'manual' && (
            <Button label="Edit" variant="secondary" onPress={() => router.push({ pathname: '/add', params: { roundId: row.round.id } })} />
          )}
          {row.actions && (
            <View style={styles.actions}>
              <View style={styles.pair}>
                <View style={styles.flex}><Button label="Mark approved" onPress={run(() => setResult(row.round.id, 'approved'), 'Could not save the result. Try again.')} /></View>
                <View style={styles.flex}><Danger label="Mark rejected" onPress={run(() => setResult(row.round.id, 'rejected'), 'Could not save the result. Try again.')} /></View>
              </View>
              <Button label="Interview didn’t happen" variant="secondary" onPress={run(() => setResult(row.round.id, 'didnt_happen'), 'Could not save the result. Try again.')} />
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

/** Moved or cancelled in the calendar: the round is never changed silently. */
function ChangeFlag({ roundId, change }: { roundId: string; change: NonNullable<CompanyDetailModel['rows'][number]['change']> }) {
  return (
    <View style={styles.flag}>
      <Text style={styles.flagText}>{change.text}</Text>
      <View style={styles.pair}>
        {change.kind === 'cancelled' && change.acknowledged ? (
          <View style={styles.flex}><Button label="Reopen" onPress={() => reopenRound(roundId)} /></View>
        ) : (
          <>
            <View style={styles.flex}>
              <Button label="Accept" onPress={() => (change.kind === 'moved' ? acceptMove(roundId) : acceptCancel(roundId))} />
            </View>
            <View style={styles.flex}><Button label="Keep" variant="secondary" onPress={() => keepRound(roundId)} /></View>
          </>
        )}
      </View>
    </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  menuBtn: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  menuDots: { fontSize: 28, color: colors.accent },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: space.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  pickerSheet: { maxHeight: '80%' },
  pickerList: { flexGrow: 0 },
  pickRow: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: space.xs },
  pickRowOn: { borderColor: colors.accent, borderWidth: 2 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, ...type.body, color: colors.text },
  error: { ...type.body, color: '#B42318' },
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
  flag: { gap: space.sm, backgroundColor: '#FDEBC8', borderRadius: radius.md, padding: space.md, marginTop: space.xs },
  flagText: { ...type.body, color: '#7A4A00', fontWeight: '600' },
  danger: {
    minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, paddingHorizontal: space.lg, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#B42318',
  },
  dangerLabel: { ...type.section, color: '#FFFFFF' },
});
