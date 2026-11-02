import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ActionRow } from '../../../src/components/ActionRow';
import { Banner } from '../../../src/components/Banner';
import { Bubble } from '../../../src/components/Bubble';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { IconButton } from '../../../src/components/IconButton';
import { InlineError } from '../../../src/components/InlineError';
import { JdCard } from '../../../src/components/JdCard';
import { Page } from '../../../src/components/Page';
import { RoundRow } from '../../../src/components/RoundRow';
import { RoundTrack } from '../../../src/components/RoundTrack';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { MenuRow, Sheet } from '../../../src/components/Sheet';
import { Stat } from '../../../src/components/Stat';
import { TextField } from '../../../src/components/TextField';
import { clearResult, markPinged, mergeCompanies, moveRound, notMovingForward, renameCompany, reopenCompany, saveNotes, setResult } from '../../../src/db/repos/actions';
import { loadBundles } from '../../../src/db/repos/bundles';
import { syncCompanyReminders, syncReminder } from '../../../src/services/notifications';
import { useData } from '../../../src/hooks/useData';
import { acceptCancel, acceptMove, keepRound, reopenRound } from '../../../src/db/repos/sync';
import { firstName, telUri } from '../../../src/domain/contact';
import { agoText, modeLabel, type CompanyDetailModel, type RoundRowModel } from '../../../src/domain/detail';
import { defaultTemplate } from '../../../src/domain/email';
import { roundMarks } from '../../../src/domain/roundTrack';
import { shortDate } from '../../../src/domain/status';
import { useActionRunner } from '../../../src/hooks/useActionRunner';
import { useCompany } from '../../../src/hooks/useCompany';
import { colors, MIN_TOUCH, radius, space, tones, type } from '../../../src/theme/tokens';
import type { Bundle } from '../../../src/types/entities';

const pingDateText = (pings: number[]) => pings.map(shortDate).join(', ');

export default function CompanyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bundle, model, now, error, loading, missing } = useCompany(id);

  const [menu, setMenu] = useState(false);
  const [roundMenu, setRoundMenu] = useState<RoundRowModel | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);           // draft name while the rename box is open
  const [picker, setPicker] = useState<{ kind: 'merge' } | { kind: 'move'; roundId: string } | null>(null);
  const others = useData(loadBundles).data;
  const { error: actionError, run } = useActionRunner();
  const marks = useMemo(() => (bundle ? roundMarks(bundle.rounds, now) : []), [bundle, now]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  if (!bundle || !model) {
    const text = error ? 'Could not load this company.' : missing ? 'This company no longer exists.' : '';
    return (
      <Screen>
        <Page>
          <ScreenHeader back={{ label: 'Companies', onPress: back }} title="Company" />
          {!!text && <InlineError message={text} />}
        </Page>
      </Screen>
    );
  }

  const { company, recruiter } = bundle;
  const { rejected, timeline, target } = model;
  const call = [...bundle.calls].sort((a, b) => b.callAt - a.callAt)[0];
  const contactName = recruiter?.name ?? call?.recruiterName;
  const phone = recruiter?.phone;

  return (
    <Screen keyboard>
      <Page>
        <View>
          <ScreenHeader
            back={{ label: 'Companies', onPress: back }} display title={company.name} subtitle={model.subtitle}
            right={<IconButton icon="more-horizontal" label="Company actions" onPress={() => setMenu(true)} />}
          />
        </View>
        <View style={styles.tight}>
          <View style={styles.bubbleRow}>
            {model.bubbles.map(b => <Bubble key={b.text} {...b} />)}
          </View>
          {!timeline && <RoundTrack marks={marks} />}
        </View>
        {!!actionError && <Banner tone="amber" text={actionError} />}
        {rejected && <Button label="Reopen" variant="secondary" onPress={run(() => reopenCompany(company.id), 'Could not reopen this company. Try again.')} />}

        {!timeline && (
          <Card style={styles.stats}>
            <Stat value={model.approved} label="Rounds approved" />
            <View style={styles.statRule} />
            <Stat value={model.awaiting} label="Awaiting result" />
          </Card>
        )}

        {timeline
          ? <TimelineCard bundle={bundle} model={model} onNotMoving={run(() => notMovingForward(company.id), 'Could not update this company. Try again.')} />
          : <RoundsCard model={model} run={run} onMore={setRoundMenu} />}

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
              : <Text style={[type.body, { color: colors.muted }]}>
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
      </Page>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Company actions">
        <MenuRow label="Rename" icon="edit-2" onPress={() => { setMenu(false); setRenaming(company.name); }} />
        <MenuRow label="Merge with another company" icon="git-merge" onPress={() => { setMenu(false); setPicker({ kind: 'merge' }); }} />
        {rejected
          ? <MenuRow label="Reopen" icon="rotate-ccw" onPress={() => { setMenu(false); void run(() => reopenCompany(company.id), 'Could not reopen this company. Try again.')(); }} />
          : <MenuRow danger label="Not moving forward" icon="slash" onPress={() => { setMenu(false); void run(() => notMovingForward(company.id), 'Could not update this company. Try again.')(); }} />}
      </Sheet>

      <Sheet visible={!!roundMenu} onClose={() => setRoundMenu(null)} title={roundMenu?.title}>
        {roundMenu && (
          <>
            <MenuRow
              label="Move to another company" icon="corner-up-right"
              onPress={() => { const r = roundMenu; setRoundMenu(null); setPicker({ kind: 'move', roundId: r.round.id }); }}
            />
            {roundMenu.round.source === 'manual' && (
              <MenuRow
                label="Edit" icon="edit-2"
                onPress={() => { const r = roundMenu; setRoundMenu(null); router.push({ pathname: '/add', params: { roundId: r.round.id } }); }}
              />
            )}
            {roundMenu.assumed && (
              <MenuRow
                label="Interview didn’t happen" icon="x-circle"
                onPress={() => { const r = roundMenu; setRoundMenu(null); void run(() => setResult(r.round.id, 'didnt_happen'), 'Could not save the result. Try again.')(); }}
              />
            )}
            {roundMenu.changeable && (
              <MenuRow
                label="Change result" icon="rotate-ccw"
                onPress={() => { const r = roundMenu; setRoundMenu(null); void run(() => clearResult(r.round.id), 'Could not change the result. Try again.')(); }}
              />
            )}
          </>
        )}
      </Sheet>

      {renaming !== null && (
        <RenameSheet
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
            await run(async () => {
              if (picker.kind === 'merge') { await mergeCompanies(target, company.id); await syncCompanyReminders(company.id); }
              else { await moveRound(picker.roundId, target); await syncReminder(picker.roundId); }
            }, picker.kind === 'merge' ? 'Could not merge the companies. Nothing was changed.' : 'Could not move the round. Nothing was changed.')();
            setPicker(null);
          }}
        />
      )}
    </Screen>
  );
}

function RenameSheet({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState('');
  return (
    <Sheet visible onClose={onCancel} title="Rename company">
      <TextField value={name} onChangeText={setName} autoFocus accessibilityLabel="Company name" error={err || undefined} />
      <ActionRow>
        <Button label="Save" onPress={() => onSave(name).catch(e => setErr(e instanceof Error ? e.message : 'Could not rename.'))} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </ActionRow>
    </Sheet>
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
    <Sheet visible onClose={onCancel} title={title}>
      {companies.length === 0 && <Text style={[type.body, { color: colors.muted }]}>There is no other company yet.</Text>}
      <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
        {companies.map(c => {
          const on = chosen?.id === c.id;
          return (
            <Pressable
              key={c.id} accessibilityRole="radio" accessibilityState={{ checked: on }}
              onPress={() => setChosen(c)}
              style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: colors.pressed }]}
            >
              <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              <Text style={[on ? type.name : type.body, { color: colors.text, flexShrink: 1 }]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {chosen && <Text style={[type.small, { color: colors.muted }]}>{note}</Text>}
      <ActionRow stackAlways>
        <Button
          label={chosen ? confirmLabel(chosen.name) : 'Choose a company'} disabled={!chosen || busy}
          onPress={() => { if (!chosen) return; setBusy(true); onConfirm(chosen.id).catch(() => setBusy(false)); }}
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </ActionRow>
    </Sheet>
  );
}

type Runner = ReturnType<typeof useActionRunner>['run'];

function RoundsCard({ model, onMore, run }: { model: CompanyDetailModel; onMore: (row: RoundRowModel) => void; run: Runner }) {
  return (
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Rounds</Text>
      {model.rows.map((row, i) => (
        <Fragment key={row.round.id}>
          {i > 0 && <View style={styles.rule} />}
          <RoundRow row={row} onMore={() => onMore(row)}>
            {row.change && <ChangeFlag roundId={row.round.id} change={row.change} />}
            {row.actions && (
              <View style={styles.actions}>
                <ActionRow>
                  <Button label="Mark approved" variant="positive" onPress={run(() => setResult(row.round.id, 'approved'), 'Could not save the result. Try again.')} />
                  <Button label="Mark rejected" variant="danger" onPress={run(() => setResult(row.round.id, 'rejected'), 'Could not save the result. Try again.')} />
                </ActionRow>
                <Button label="Interview didn’t happen" variant="secondary" onPress={run(() => setResult(row.round.id, 'didnt_happen'), 'Could not save the result. Try again.')} />
                <Text style={[type.small, { color: colors.muted }]}>
                  Rejected moves the company to Rejected. Didn’t happen is not counted and tracks no result or ping.
                </Text>
              </View>
            )}
            {row.assumed && <Text style={[type.small, { color: colors.muted }]}>Counted as approved because a later round exists.</Text>}
          </RoundRow>
        </Fragment>
      ))}
    </Card>
  );
}

/** Moved or cancelled in the calendar: the round is never changed silently. */
function ChangeFlag({ roundId, change }: { roundId: string; change: NonNullable<CompanyDetailModel['rows'][number]['change']> }) {
  return (
    <View style={styles.flag}>
      <Text style={[type.bodyStrong, { color: tones.amber.fg }]}>{change.text}</Text>
      <ActionRow>
        {change.kind === 'cancelled' && change.acknowledged ? (
          <Button label="Reopen" onPress={() => reopenRound(roundId)} />
        ) : (
          <>
            <Button label="Accept" onPress={() => (change.kind === 'moved' ? acceptMove(roundId) : acceptCancel(roundId))} />
            <Button label="Keep" variant="secondary" onPress={() => keepRound(roundId)} />
          </>
        )}
      </ActionRow>
    </View>
  );
}

function TimelineCard({ bundle, model, onNotMoving }: { bundle: Bundle; model: CompanyDetailModel; onNotMoving: () => void }) {
  const call = [...bundle.calls].sort((a, b) => b.callAt - a.callAt)[0];
  const who = call?.recruiterName ?? bundle.recruiter?.name;
  return (
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Timeline</Text>
      {call && (
        <View style={styles.timelineRow}>
          <View style={styles.flex}>
            <Text style={[type.name, { color: colors.text }]}>Recruiter call</Text>
            <Text style={[type.body, { color: colors.muted }]}>{[shortDate(call.callAt), modeLabel('phone'), who].filter(Boolean).join(' · ')}</Text>
          </View>
          <Bubble text="Call done" tone="green" />
        </View>
      )}
      <View style={styles.timelineRow}>
        <View style={styles.flex}>
          <Text style={[type.name, { color: colors.text }]}>Interview</Text>
          <Text style={[type.body, { color: colors.muted }]}>Not scheduled yet</Text>
        </View>
        <Bubble text="Waiting" tone="blue" />
      </View>
      {!model.rejected && <Button variant="danger" label="Not moving forward" onPress={onNotMoving} />}
      <Text style={[type.small, { color: colors.muted }]}>When an invite arrives, refresh adds it here as round 1.</Text>
    </Card>
  );
}

function RoundSummary({ bundle, model, now }: { bundle: Bundle; model: CompanyDetailModel; now: number }) {
  const round = bundle.rounds.find(r => r.id === model.target?.id);
  return (
    <View style={styles.gapXs}>
      {round && <Text style={[type.body, { color: colors.muted }]}>{`Latest round: ${round.label}, ${agoText(round.startsAt, now)}`}</Text>}
      {model.pings.length > 0 && <Text style={[type.body, { color: colors.muted }]}>{`Pings: ${pingDateText(model.pings)}`}</Text>}
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
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>{title}</Text>
      {children}
      <View style={styles.actions}>
        <ActionRow>
          <Button label="Email follow-up" onPress={onEmail} />
          {onCall && <Button label={callLabel} variant="secondary" onPress={onCall} />}
        </ActionRow>
        <Button label="Mark as pinged" variant="secondary" onPress={onPinged} />
      </View>
      {!!helpLine && <Text style={[type.small, { color: colors.muted }]}>{helpLine}</Text>}
    </Card>
  );
}

function RecruiterCard({ name, phone, email }: { name?: string; phone?: string; email?: string }) {
  const empty = !name && !phone && !email;
  return (
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>Recruiter</Text>
      {empty ? (
        <Text style={[type.body, { color: colors.muted }]}>No recruiter details yet.</Text>
      ) : (
        <View>
          {!!name && <Text style={[type.name, { color: colors.text }]}>{name}</Text>}
          {!!phone && <Text selectable style={[type.body, { color: colors.text }]}>{phone}</Text>}
          {!!email && <Text selectable style={[type.body, { color: colors.text }]}>{email}</Text>}
        </View>
      )}
      <ActionRow>
        <CopyButton label="Copy number" text={phone} />
        <CopyButton label="Copy email" text={email} />
      </ActionRow>
      <Button label="Call" icon="phone" disabled={!phone} onPress={() => phone && Linking.openURL(telUri(phone))} />
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
  const [note, setNote] = useState('');
  const save = () => {
    if (text === initial) return;
    saveNotes(companyId, text).then(() => setNote('Saved'), () => setNote('Could not save your notes. Try again.'));
  };
  return (
    <Card style={styles.card}>
      <TextField
        label="Your notes" value={text}
        onChangeText={t => { setText(t); setNote(''); }}
        onBlur={save}
        lines={5}
        placeholder="Prep, questions asked, feedback"
      />
      {!!note && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{note}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tight: { gap: space.sm, marginTop: -space.xs },
  bubbleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stats: { flexDirection: 'row', paddingVertical: space.md, paddingHorizontal: 0 },
  statRule: { width: 1, alignSelf: 'stretch', backgroundColor: colors.rule },
  card: { gap: space.sm },
  rule: { height: 1, backgroundColor: colors.rule },
  gapXs: { gap: space.xs },
  actions: { gap: space.sm },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  flag: { gap: space.sm, backgroundColor: tones.amber.bg, borderColor: tones.amber.border, borderWidth: 1, borderRadius: radius.input, padding: space.md },
  pickerList: { flexGrow: 0 },
  pickRow: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: radius.inner },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
