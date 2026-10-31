/** Design tokens. Light theme only, one teal accent, no animation (v1). */
export const colors = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F4', // rejected rows
  border: '#DDE2E8',
  text: '#101828',
  textMuted: '#4A5568',
  textFaint: '#6B7686',
  accent: '#0E7490', // the one teal
  onAccent: '#FFFFFF',
} as const;

/** Bubble tones match the Part 2 Bubble type exactly. */
export const tones = {
  blue: { bg: '#DCEFF5', fg: '#0B5C6E' },
  green: { bg: '#DDF5E3', fg: '#14633A' },
  grey: { bg: '#E3E7ED', fg: '#3F4B5C' },
  red: { bg: '#FBDADA', fg: '#8A1C1C' },
  amber: { bg: '#FDEBC8', fg: '#7A4A00' },
} as const;
export type Tone = keyof typeof tones;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, pill: 999 } as const;
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const },
  name: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  section: { fontSize: 15, fontWeight: '700' as const },
  bubble: { fontSize: 12, fontWeight: '700' as const },
} as const;
export const MIN_TOUCH = 48;
