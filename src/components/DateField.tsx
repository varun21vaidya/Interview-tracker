import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { clock, dateText, fullDate } from '../domain/home';
import { parseStart } from '../domain/validation';
import { colors, MIN_TOUCH, radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import type { DateFieldProps } from './dateFieldTypes';

const pad = (n: number) => String(n).padStart(2, '0');

/** Native picker. The stored text stays YYYY-MM-DD and HH:MM, so validation and editing are unchanged. */
export function DateField({ label, mode, value, onChange, error, optional }: DateFieldProps) {
  const open = () => {
    const parsed = mode === 'date' ? parseStart(value, '') : parseStart(dateText(Date.now()), value);
    DateTimePickerAndroid.open({
      value: new Date(value && parsed ? parsed : Date.now()),
      mode,
      is24Hour: false,
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        onChange(mode === 'date'
          ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
          : `${pad(d.getHours())}:${pad(d.getMinutes())}`);
      },
    });
  };
  const shown = !value
    ? (mode === 'date' ? 'Choose date' : 'Choose time')
    : mode === 'date' ? fullDate(value) : clock(parseStart(dateText(Date.now()), value) ?? Date.now());
  const edge = error ? colors.danger : colors.control;
  return (
    <View style={styles.field}>
      <Text style={[type.section, { color: colors.text }]}>{label}</Text>
      <View style={[styles.box, { borderColor: edge, borderWidth: error ? 2 : 1 }]}>
        <Pressable
          accessibilityRole="button" accessibilityLabel={`${label}, ${shown}`} onPress={open}
          style={({ pressed }) => [styles.press, pressed && { backgroundColor: colors.pressed }]}
        >
          <Icon name={mode === 'date' ? 'calendar' : 'clock'} size={18} color={colors.muted} />
          <Text style={[type.body, { color: value ? colors.text : colors.muted, flexShrink: 1 }]}>{shown}</Text>
        </Pressable>
        {optional && !!value && <IconButton icon="x" label={`Clear ${label}`} onPress={() => onChange('')} />}
      </View>
      {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  box: { minHeight: MIN_TOUCH, backgroundColor: colors.raised, borderRadius: radius.input, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  press: { flex: 1, minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
});
