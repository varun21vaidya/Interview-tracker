import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { telUri } from '../domain/contact';
import type { NextModel } from '../domain/home';
import { useLayout } from '../hooks/useLayout';
import { colors, space, type } from '../theme/tokens';
import { ActionRow } from './ActionRow';
import { Bubble } from './Bubble';
import { Button } from './Button';
import { Card } from './Card';

interface Props { model: NextModel; onOpen?: (companyId: string) => void }

export function NextCard({ model, onOpen }: Props) {
  const { link, phone, recruiterName } = model;
  const { compact } = useLayout();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card outlined style={styles.card}>
      <View style={styles.top}>
        <View style={styles.chips}>
          {model.chips.map(c => <Bubble key={c} text={c} tone="grey" />)}
        </View>
        <Text style={[type.figure, { color: colors.accent }]} accessibilityLabel={`Starts ${model.countdown}`}>{model.countdown}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${model.name}`} onPress={() => onOpen?.(model.companyId)} disabled={!onOpen}>
        <Text maxFontSizeMultiplier={1.6} style={[type.display, { color: colors.text }]} numberOfLines={3}>{model.name}</Text>
      </Pressable>
      <View>
        <Text style={[type.body, { color: colors.text }]}>{model.title}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{model.timeText}</Text>
      </View>

      {!!link && (
        <ActionRow>
          <Button label="Join" icon="video" onPress={() => Linking.openURL(link)} />
          <Button label={copied ? 'Copied' : 'Copy link'} variant="secondary" onPress={copy} />
        </ActionRow>
      )}

      {(recruiterName || phone) && (
        <>
          <View style={styles.rule} />
          <View style={compact ? styles.recruiterStack : styles.recruiter}>
            <View style={styles.grow}>
              {!!recruiterName && <Text style={[type.name, { color: colors.text }]}>{recruiterName}</Text>}
              <Text style={[type.body, { color: colors.muted }]}>{['Recruiter', phone].filter(Boolean).join(' · ')}</Text>
            </View>
            {!!phone && (
              <View style={compact ? undefined : styles.callWrap}>
                <Button label="Call" variant="secondary" onPress={() => Linking.openURL(telUri(phone))} />
              </View>
            )}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, flexShrink: 1 },
  rule: { height: 1, backgroundColor: colors.rule },
  recruiter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  recruiterStack: { gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  callWrap: { minWidth: 96 },
});
