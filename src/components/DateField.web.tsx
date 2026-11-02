import { TextField } from './TextField';
import type { DateFieldProps } from './dateFieldTypes';

/** The native picker has no web support, so web keeps typed text with the same stored format. */
export function DateField({ label, mode, value, onChange, error }: DateFieldProps) {
  return (
    <TextField
      label={label} value={value} onChangeText={onChange} error={error}
      placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:MM'} keyboardType="numbers-and-punctuation"
    />
  );
}
