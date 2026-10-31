import { RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { CompanyRow } from '../../src/components/CompanyRow';
import { useCompanies } from '../../src/hooks/useCompanies';
import { colors, MIN_TOUCH, radius, space, type } from '../../src/theme/tokens';
import type { Bundle } from '../../src/types/entities';

export default function Companies() {
  const router = useRouter();
  const openCompany = (companyId: string) => router.push({ pathname: '/company/[id]', params: { id: companyId } });
  const { active, rejected, total, loading, error, query, setQuery, refreshing, refresh, now } = useCompanies();

  const sections = [
    { title: 'Active', data: active },
    { title: 'Rejected', data: rejected },
  ].filter(s => s.data.length > 0);

  const header = (
    <View>
      <Text accessibilityRole="header" style={styles.title}>Companies</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search company, role or recruiter"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Search company, role or recruiter"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={styles.search}
      />
    </View>
  );

  // ASSUMPTION: empty and error wording is not in the screenshot.
  const emptyText = error ? 'Could not load companies.' : loading ? '' : total === 0 ? 'No companies yet.' : 'No companies match your search.';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Tabs.Screen options={{ headerShown: false }} />
      <SectionList<Bundle, { title: string; data: Bundle[] }>
        sections={sections}
        keyExtractor={b => b.company.id}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyText ? <Text style={styles.empty}>{emptyText}</Text> : undefined}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => <CompanyRow bundle={item} now={now} onPress={openCompany} />}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  title: { ...type.title, color: colors.text, marginTop: space.lg, marginBottom: space.md },
  search: {
    minHeight: MIN_TOUCH, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.lg, ...type.body, color: colors.text,
  },
  sectionHeader: {
    minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingBottom: space.sm,
  },
  sectionTitle: { ...type.section, color: colors.text },
  sectionCount: { ...type.body, color: colors.textFaint },
  empty: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xl },
});
