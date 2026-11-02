import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CompanyRow } from '../../src/components/CompanyRow';
import { IconButton } from '../../src/components/IconButton';
import { InlineError } from '../../src/components/InlineError';
import { Screen } from '../../src/components/Screen';
import { Skeleton } from '../../src/components/Skeleton';
import { TextField } from '../../src/components/TextField';
import { useCompanies } from '../../src/hooks/useCompanies';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, radius, space, type } from '../../src/theme/tokens';
import type { Bundle } from '../../src/types/entities';

export default function Companies() {
  const router = useRouter();
  const { gutter, contentWidth } = useLayout();
  const openCompany = (companyId: string) => router.push({ pathname: '/company/[id]', params: { id: companyId } });
  const { active, rejected, total, loading, error, query, setQuery, refreshing, refresh, now } = useCompanies();

  const sections = [
    { title: 'Active', data: active },
    { title: 'Rejected', data: rejected },
  ].filter(s => s.data.length > 0);

  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>Companies</Text>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search company, role or recruiter"
        accessibilityLabel="Search company, role or recruiter"
        icon="search"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        trailing={query ? <IconButton icon="x" label="Clear search" onPress={() => setQuery('')} /> : undefined}
      />
    </View>
  );

  // ASSUMPTION: empty and error wording is not in the screenshot.
  const emptyText = loading ? '' : total === 0 ? 'No companies yet.' : 'No companies match your search.';
  const empty = error
    ? <View style={styles.empty}><InlineError message="Could not load companies." onRetry={refresh} /></View>
    : loading
      ? <View style={styles.empty}><Skeleton height={72} round={radius.card} /></View>
      : <View style={[styles.empty, styles.emptyPanel]}><Text style={[type.body, { color: colors.muted }]}>{emptyText}</Text></View>;

  return (
    <Screen edges={['top']}>
      <SectionList<Bundle, { title: string; data: Bundle[] }>
        sections={sections}
        keyExtractor={b => b.company.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={[type.section, { color: colors.text }]}>{section.title}</Text>
            <Text style={[type.small, { color: colors.muted, fontVariant: ['tabular-nums'] }]}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={[styles.cell, index === 0 && styles.cellFirst, index === section.data.length - 1 && styles.cellLast]}>
            {index > 0 && <View style={styles.rule} />}
            <CompanyRow bundle={item} now={now} onPress={openCompany} />
          </View>
        )}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.xl, width: contentWidth, alignSelf: 'center' }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginTop: space.lg },
  sectionHeader: {
    minHeight: 40, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingTop: space.md, paddingBottom: space.sm,
  },
  cell: { backgroundColor: colors.surface, paddingHorizontal: space.lg },
  cellFirst: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: space.xs },
  cellLast: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, paddingBottom: space.xs },
  rule: { height: 1, backgroundColor: colors.rule },
  empty: { marginTop: space.lg },
  emptyPanel: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg },
});
