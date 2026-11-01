import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatWords, previewText } from '../domain/jd';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { safeHttps } from '../utils/links';
import { Card } from './Card';

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
          <Text style={styles.title}>Job description</Text>
          {!!text && !!words && <Text style={styles.count}>{formatWords(words)}</Text>}
        </View>
        <IconButton glyph="✎" label="Edit job description" onPress={onEdit} />
        <IconButton glyph="⤢" label="View full job description" onPress={onView} disabled={!text} />
      </View>
      {text
        ? <Text numberOfLines={3} style={styles.preview}>{text}</Text>
        : <Text style={styles.empty}>No description yet. Tap the pencil to paste one.</Text>}
      {!!href && (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(href)} style={styles.link}>
          <Text style={styles.linkText}>Open posting</Text>
        </Pressable>
      )}
    </Card>
  );
}

function IconButton({ glyph, label, onPress, disabled }: { glyph: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} style={[styles.icon, disabled && styles.disabled]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  titleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm },
  title: { ...type.section, color: colors.text },
  count: { fontSize: 13, color: colors.textFaint },
  icon: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 20, color: colors.accent },
  disabled: { opacity: 0.4 },
  preview: { ...type.body, color: colors.textMuted },
  empty: { ...type.body, color: colors.textFaint },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { ...type.section, color: colors.accent },
});
