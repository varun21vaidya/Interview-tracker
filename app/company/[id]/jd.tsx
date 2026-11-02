import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { BottomBar } from '../../../src/components/BottomBar';
import { Button } from '../../../src/components/Button';
import { Chip } from '../../../src/components/Chip';
import { InlineError } from '../../../src/components/InlineError';
import { Page } from '../../../src/components/Page';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { TextField } from '../../../src/components/TextField';
import { IconButton } from '../../../src/components/IconButton';
import { loadJd, type JdRecord } from '../../../src/db/repos/companies';
import { formatWords, findMatches, jumpTargets, matchSegments, toBlocks, type Block } from '../../../src/domain/jd';
import { useData } from '../../../src/hooks/useData';
import { useLayout } from '../../../src/hooks/useLayout';
import { colors, radius, space, type } from '../../../src/theme/tokens';
import { safeHttps } from '../../../src/utils/links';

export default function FullJd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Wrapped so "not found" is distinguishable from "not loaded yet". Full text loads here only.
  const { data, error } = useData(async () => ({ jd: await loadJd(id) }), [id]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/companies'));

  return (
    <Screen>
      {data?.jd
        ? <Reader jd={data.jd} onBack={back} onEdit={() => router.push({ pathname: '/company/[id]/jd-edit', params: { id } })} />
        : (
          <Page>
            <ScreenHeader back={{ label: 'Company', onPress: back }} title="Job description" />
            {(error || data) && <InlineError message={error ? 'Could not load this description.' : 'This company no longer exists.'} />}
          </Page>
        )}
    </Screen>
  );
}

const CARD_PAD = space.lg;

function Reader({ jd, onBack, onEdit }: { jd: JdRecord; onBack: () => void; onEdit: () => void }) {
  const { width, fontScale, gutter, contentWidth } = useLayout();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const list = useRef<FlatList<Block>>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const blocks = useMemo(() => toBlocks(jd.text), [jd.text]);
  const jumps = useMemo(() => jumpTargets(blocks), [blocks]);
  const found = useMemo(() => findMatches(blocks, query), [blocks, query]);
  const href = safeHttps(jd.link);

  // Rough height of a block that has not been rendered yet (17px type, 26px lines, about 8.2px per character).
  const charsPerLine = Math.max(20, Math.floor((Math.min(width, contentWidth) - gutter * 2 - CARD_PAD * 2) / (8.2 * fontScale)));
  const lineH = 26 * fontScale;
  const estimateHeight = (b: Block) =>
    (b.heading !== undefined ? 30 * fontScale : 0) + space.md
    + b.body.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0) * lineH;

  // Heights of rendered blocks. Jumping uses these (estimates for blocks not rendered yet) instead of
  // VirtualizedList frame metrics, which are not reliable for rows of varying height.
  const heights = useRef(new Map<string, number>());
  const offsetOf = (index: number) => {
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
      <View style={[styles.top, { paddingHorizontal: gutter, width: contentWidth }]}>
        <ScreenHeader back={{ label: 'Company', onPress: onBack }} title="Job description" subtitle={sub || undefined} />
        <TextField
          value={query} onChangeText={setQuery} placeholder="Find in description" accessibilityLabel="Find in description"
          icon="search" maxLength={100} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
          trailing={query ? <IconButton icon="x" label="Clear find" onPress={() => setQuery('')} /> : undefined}
        />
        {query.trim() !== '' && (
          <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>
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
        <View style={[styles.top, { paddingHorizontal: gutter, width: contentWidth }]}>
          <Text style={[type.body, { color: colors.muted }]}>No description saved yet.</Text>
        </View>
      ) : (
        <FlatList
          ref={list}
          style={[styles.card, { marginHorizontal: gutter, width: contentWidth - gutter * 2 }]}
          contentContainerStyle={styles.cardContent}
          data={blocks}
          extraData={query}
          keyExtractor={b => b.id}
          renderItem={({ item }) => <BlockView block={item} query={query} onHeight={h => heights.current.set(item.id, h)} />}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          windowSize={7}
          ListFooterComponent={<Text style={[type.small, styles.footer]}>Long descriptions scroll here. The company page shows a short preview only.</Text>}
        />
      )}

      <BottomBar stackAlways={width < 400}>
        <Button label={copied ? 'Copied' : 'Copy text'} variant="secondary" icon="copy" disabled={jd.text === ''} onPress={copy} />
        <Button label="Edit" variant="secondary" icon="edit-2" onPress={onEdit} />
        <Button label="Open posting" icon="external-link" disabled={!href} onPress={() => href && Linking.openURL(href)} />
      </BottomBar>
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
      {block.heading !== undefined && <Highlighted text={block.heading} query={query} style={[type.heading, { color: colors.text }]} />}
      {block.body !== '' && <Highlighted text={block.body} query={query} style={[type.reading, { color: colors.text }]} />}
    </View>
  );
});

const styles = StyleSheet.create({
  top: { alignSelf: 'center', gap: space.sm, paddingBottom: space.sm },
  chips: { gap: space.sm, paddingVertical: space.xs },
  card: { flex: 1, minHeight: 160, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.card, marginBottom: space.sm },
  cardContent: { padding: CARD_PAD },
  block: { gap: space.xs, paddingBottom: space.md },
  hit: { backgroundColor: colors.hit, color: colors.text },
  footer: { color: colors.muted, marginTop: space.md },
});
