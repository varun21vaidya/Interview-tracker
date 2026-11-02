import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { telUri } from '../domain/contact';
import type { PreviousModel, WaitingModel } from '../domain/home';
import { colors, MIN_TOUCH, space, type } from '../theme/tokens';
import { ActionRow } from './ActionRow';
import { Button } from './Button';
import { RowHead } from './RowHead';

interface WaitingProps {
  model: WaitingModel;
  onOpen: (companyId: string) => void;
  onEmail: (model: WaitingModel) => void;
  onPinged: (model: WaitingModel) => void;
}

/** One entry per company with a pending result: a row inside the Waiting panel. No suggestions and no overdue colours. */
export function WaitingCard({ model, onOpen, onEmail, onPinged }: WaitingProps) {
  const bubbles = model.ping ? [model.pending, model.ping] : [model.pending];
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[model.name, model.line, model.pending.text, model.ping?.text].filter(Boolean).join(', ')}
        onPress={() => onOpen(model.companyId)}
        style={({ pressed }) => [styles.head, pressed && { backgroundColor: colors.pressed }]}
      >
        <RowHead
          main={(
            <>
              <Text style={[type.name, { color: colors.text }]}>{model.name}</Text>
              <Text style={[type.body, { color: colors.muted }]}>{model.line}</Text>
            </>
          )}
          bubbles={bubbles}
        />
      </Pressable>
      <ActionRow>
        <Button label="Email follow-up" onPress={() => onEmail(model)} />
        {!!model.phone && <Button label="Call" variant="secondary" onPress={() => Linking.openURL(telUri(model.phone!))} />}
      </ActionRow>
      <Button label="Mark as pinged" variant="secondary" onPress={() => onPinged(model)} />
    </View>
  );
}

/** The last round with its result bubble, same layout as the waiting header. */
export function PreviousCard({ model, onOpen }: { model: PreviousModel; onOpen: (companyId: string) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[model.name, model.line, model.bubble.text].join(', ')}
      onPress={() => onOpen(model.companyId)}
      style={({ pressed }) => [styles.head, styles.previous, pressed && { backgroundColor: colors.pressed }]}
    >
      <RowHead
        main={(
          <>
            <Text style={[type.name, { color: colors.text }]}>{model.name}</Text>
            <Text style={[type.body, { color: colors.muted }]}>{model.line}</Text>
          </>
        )}
        bubbles={[model.bubble]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  head: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingVertical: space.xs },
  previous: { paddingVertical: space.sm },
});
