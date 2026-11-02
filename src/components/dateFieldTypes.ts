export interface DateFieldProps {
  label: string;
  mode: 'date' | 'time';
  /** "YYYY-MM-DD" or "HH:MM"; empty when not chosen. */
  value: string;
  onChange: (v: string) => void;
  error?: string;
  optional?: boolean;
}
