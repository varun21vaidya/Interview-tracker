/** Design tokens. Light theme only, one teal accent, no entrance animation. */
export const colors = {
  ground: '#FFFFFF',
  surface: '#F1F5F5',       // tonal panel, no border
  raised: '#FFFFFF',        // inputs and secondary buttons on a panel
  pressed: '#E4EBEB',
  rule: '#E1E7E7',          // row dividers
  control: '#7F8A8A',       // input and secondary button edge; tests require 3:1
  text: '#1F201D',
  muted: '#5A5C5A',         // the only grey, placeholders included
  accent: '#0E7490',
  accentPressed: '#0B5F76',
  onAccent: '#FFFFFF',
  positive: '#247B50',
  positivePressed: '#1C6140',
  danger: '#B42318',
  dangerPressed: '#8F1B12',
  warning: '#92400E',
  disabledBg: '#E9EEEE',
  hit: '#FFE08A',           // find-in-JD highlight only
  scrim: 'rgba(31,32,29,0.45)',
} as const;

export const tones = {
  blue:  { bg: '#DCEFF5', fg: '#0B5C6E' },
  green: { bg: '#DCFAE5', fg: '#04250E' },
  grey:  { bg: '#E9EEEE', fg: '#3D3D3A' },
  red:   { bg: '#FDECEA', fg: '#7A1D14' },
  amber: { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A' },
} as const;
export type Tone = keyof typeof tones;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { inner: 8, input: 14, card: 22, pill: 999 } as const;

const sans = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
};
const serif = 'InstrumentSerif_400Regular';
export const FONT_FACES = { sans, serif };

// Custom fonts choose weight by family, so these never set fontWeight.
export const type = {
  display:    { fontFamily: serif, fontSize: 32, lineHeight: 38 },        // company name only
  title:      { fontFamily: sans.semibold, fontSize: 24, lineHeight: 30 },
  figure:     { fontFamily: sans.regular, fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] as const },
  name:       { fontFamily: sans.semibold, fontSize: 17, lineHeight: 23 },
  section:    { fontFamily: sans.semibold, fontSize: 15, lineHeight: 21 },
  body:       { fontFamily: sans.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: sans.medium, fontSize: 15, lineHeight: 22 },
  heading:    { fontFamily: sans.semibold, fontSize: 19, lineHeight: 26 }, // JD section headings
  reading:    { fontFamily: sans.regular, fontSize: 17, lineHeight: 26 }, // JD text
  small:      { fontFamily: sans.regular, fontSize: 13, lineHeight: 18 },
  bubble:     { fontFamily: sans.medium, fontSize: 12, lineHeight: 16 },
  button:     { fontFamily: sans.semibold, fontSize: 15, lineHeight: 20 },
} as const;
export const MIN_TOUCH = 48;
export const CONTENT_MAX = 640;   // tablets: centred column
