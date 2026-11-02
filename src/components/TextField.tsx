import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

interface Props extends TextInputProps {
  label?: string; error?: string; lines?: number; icon?: IconName; trailing?: ReactNode;
}

const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

/** Label above, 1px edge, 2px accent on focus (padding drops by 1 so the layout stays put), danger on error. */
export function TextField({ label, error, lines, icon, trailing, multiline, style, onFocus, onBlur, ...rest }: Props) {
  const [focus, setFocus] = useState(false);
  const thick = focus || !!error;
  const edge = error ? colors.danger : focus ? colors.accent : colors.control;
  const multi = multiline || !!lines;
  return (
    <View style={styles.field}>
      {!!label && <Text style={[type.section, { color: colors.text }]}>{label}</Text>}
      <View
        style={[
          styles.box,
          { borderColor: edge, borderWidth: thick ? 2 : 1, paddingHorizontal: thick ? space.md - 1 : space.md },
          multi && { minHeight: (lines ?? 4) * 22 + 24, alignItems: 'flex-start' },
        ]}
      >
        {!!icon && <Icon name={icon} size={18} color={colors.muted} />}
        <TextInput
          accessibilityLabel={label ?? rest.accessibilityLabel}
          accessibilityHint={error}
          placeholderTextColor={colors.muted}
          multiline={multi}
          textAlignVertical={multi ? 'top' : 'center'}
          onFocus={e => { setFocus(true); onFocus?.(e); }}
          onBlur={e => { setFocus(false); onBlur?.(e); }}
          style={[type.body, styles.input, multi && styles.multi, NO_OUTLINE, style]}
          {...rest}
        />
        {trailing}
      </View>
      {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  box: {
    minHeight: MIN_TOUCH, backgroundColor: colors.raised, borderRadius: radius.input,
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
  },
  input: { flex: 1, minWidth: 0, color: colors.text, paddingVertical: space.sm },
  multi: { alignSelf: 'stretch', paddingVertical: 12 },
});
