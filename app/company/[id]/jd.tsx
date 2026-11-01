import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../../../src/components/Button';
import { Chip } from '../../../src/components/Chip';
import { loadJd, type JdRecord } from '../../../src/db/repos/companies';
import { formatWords, findMatches, jumpTargets, matchSegments, toBlocks, type Block } from '../../../src/domain/jd';
import { useData } from '../../../src/hooks/useData';
import { colors, MIN_TOUCH, radius, space, type } from '../../../src/theme/tokens';
import { safeHttps } from '../../../src/utils/links';

export default function FullJd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Wrapped so "not found" is distinguishable from "not loaded yet". Full text loads here only.
  const { data, error } = useData(async () => ({ jd: await loadJd(id) }), [id]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {data?.jd
        ? <Reader jd={data.jd} onBack={back} onEdit={() => router.push({ pathname: '/company/[id]/jd-edit', params: { id } })} />
        : (
          <View style={styles.top}>
            <BackLink onPress={back} />
            {(error || data) && <Text style={styles.muted}>{error ? 'Could not load this description.' : 'This company no longer exists.'}</Text>}
          </View>
        )}
    </SafeAreaView>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Back to company" onPress={onPress} style={styles.back}>
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

function Reader({ jd, onBack, onEdit }: { jd: JdRecord; onBack: () => void; onEdit: () => void }) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const list = useRef<FlatList<Block>>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const blocks = useMemo(() => toBlocks(jd.text), [jd.text]);
  const jumps = useMemo(() => jumpTargets(blocks), [blocks]);
  const found = useMemo(() => findMatches(blocks, query), [blocks, query]);
  const href = safeHttps(jd.link);

  // Heights of rendered blocks. Jumping uses these (estimates for blocks not rendered yet) instead of
  // VirtualizedList frame metrics, which are not reliable for rows of varying height.
  const heights = useRef(new Map<string, number>());  const offsetOf = (index: number) => {
    let y = CARD_PAD;
    for (let i = 0; i < index; i++) y += heights.current.get(blocks[i].id) ?? estimateHeight(blocks[i]);
    return y;
  };
  const jumpTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(jumpTimer.current), []);
  const jump = (index: number) => {
    list.current?.scrollToOffset({ offset: offsetOf(index), animated: false });
    // One correction pass once the rows above have been measured. Bounded: no retry loop.
    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => list.current?.scrollToOffset({ offset: offsetOf(index), animated: false }), 150);
  };
  // Find scrolls to the first match as you type.
  useEffect(() => { if (found.first >= 0) jump(found.first); }, [found.first, query]);

  const copy = async () => {
    await Clipboard.setStringAsync(jd.text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  const sub = [jd.role, jd.words > 0 ? `about ${formatWords(jd.words)}` : undefined].filter(Boolean).join(' · ');

  return (
    <>
      <View style={styles.top}>
        <BackLink onPress={onBack} />
        <Text accessibilityRole="header" style={styles.title}>Job description</Text>
        {!!sub && <Text style={styles.sub}>{sub}</Text>}
        <TextInput
          value={query} onChangeText={setQuery} placeholder="Find in description" placeholderTextColor={colors.textFaint}
          accessibilityLabel="Find in description" maxLength={100} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
          style={styles.find}
        />
        {query.trim() !== '' && (
          <Text accessibilityLiveRegion="polite" style={styles.help}>
            {found.total === 0 ? 'No matches' : found.total === 1 ? '1 match' : `${found.total} matches`}
          </Text>
        )}
        {jumps.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
            {jumps.map(j => <Chip key={j.label} label={j.label} onPress={() => jump(j.index)} />)}
          </ScrollView>
        )}
      </View>

      {jd.text === '' ? (
        <View style={styles.top}><Text style={styles.muted}>No description saved yet.</Text></View>
      ) : (
        <FlatList
          ref={list}
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          data={blocks}
          extraData={query}
          keyExtractor={b => b.id}
          renderItem={({ item }) => <BlockView block={item} query={query} onHeight={h => heights.current.set(item.id, h)} />}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          windowSize={7}
          ListFooterComponent={<Text style={styles.footer}>Long descriptions scroll here. The company page shows a short preview only.</Text>}
        />
      )}

      <View style={styles.bar}>
        <View style={styles.flex}><Button label={copied ? 'Copied' : 'Copy text'} variant="secondary" disabled={jd.text === ''} onPress={copy} /></View>
        <View style={styles.flex}><Button label="Edit" variant="secondary" onPress={onEdit} /></View>
        <View style={styles.flex}><Button label="Open posting" disabled={!href} onPress={() => href && Linking.openURL(href)} /></View>
      </View>
    </>
  );
}

const Highlighted = memo(function Highlighted({ text, query, style }: { text: string; query: string; style: object }) {
  return (
    <Text style={style} selectable>
      {matchSegments(text, query).map((s, i) => (s.hit ? <Text key={i} style={styles.hit}>{s.text}</Text> : s.text))}
    </Text>
  );
});

const BlockView = memo(function BlockView({ block, query, onHeight }: { block: Block; query: string; onHeight: (h: number) => void }) {
  return (
    <View style={styles.block} onLayout={e => onHeight(e.nativeEvent.layout.height)}>
      {block.heading !== undefined && <Highlighted text={block.heading} query={query} style={styles.heading} />}
      {block.body !== '' && <Highlighted text={block.body} query={query} style={styles.body} />}
    </View>
  );
});

const CARD_PAD = space.lg;
/** Rough height of a block that has not been rendered yet (17px type, 26px lines, about 38 characters a line). */
const estimateHeight = (b: Block) =>
  (b.heading !== undefined ? 30 : 0) + space.md
  + b.body.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 38)), 0) * 26;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  back: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { ...type.section, color: colors.accent },
  title: { ...type.title, color: colors.text },
  sub: { ...type.body, color: colors.textMuted },
  muted: { ...type.body, color: colors.textFaint },
  help: { fontSize: 13, color: colors.textFaint },
  find: {
    minHeight: MIN_TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: space.md, ...type.body, color: colors.text,
  },
  chips: { gap: space.sm, paddingVertical: space.xs },
  card: {
    flex: 1, minHeight: 160, marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardContent: { padding: CARD_PAD },
  block: { gap: space.xs, paddingBottom: space.md },
  heading: { fontSize: 19, fontWeight: '700', color: colors.text },
  body: { fontSize: 17, lineHeight: 26, color: colors.text },
  hit: { backgroundColor: '#FFE08A', color: colors.text },
  footer: { fontSize: 13, color: colors.textFaint, marginTop: space.md },
  flex: { flex: 1, minWidth: 0 },
  bar: {
    flexDirection: 'row', gap: space.sm, padding: space.lg, marginTop: space.sm, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
