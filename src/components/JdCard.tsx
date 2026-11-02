import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatWords, previewText } from '../domain/jd';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { safeHttps } from '../utils/links';
import { Card } from './Card';
import { IconButton } from './IconButton';

interface Props {
  preview?: string; words?: number; link?: string;
  onEdit: () => void; onView: () => void;
}

/** Spec 3.3: short preview, word count in the header, icon-only Edit and View full screen. Never loads the full text. */
export function JdCard({ preview, words, link, onEdit, onView }: Props) {
  const text = previewText(preview);
  const href = safeHttps(link);
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={[type.section, { color: colors.text }]}>Job description</Text>
          {!!text && !!words && <Text style={[type.small, { color: colors.muted }]}>{formatWords(words)}</Text>}
        </View>
        <IconButton icon="edit-2" label="Edit job description" onPress={onEdit} />
        <IconButton icon="maximize-2" label="View full job description" onPress={onView} disabled={!text} />
      </View>
      {text
        ? <Text numberOfLines={3} style={[type.body, { color: colors.muted }]}>{text}</Text>
        : <Text style={[type.body, { color: colors.muted }]}>No description yet. Tap the pencil to paste one.</Text>}
      {!!href && (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(href)} style={styles.link}>
          <Text style={[type.section, { color: colors.accent }]}>Open posting</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  titleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
});
