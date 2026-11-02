import { colors as c, tones } from '../src/theme/tokens';
const lum = (h: string) => {
  const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const pairs: [string, string, string][] = [
  ['text on panel', c.text, c.surface], ['muted on panel', c.muted, c.surface],
  ['muted on white', c.muted, c.ground], ['muted on disabled', c.muted, c.disabledBg],
  ['accent on panel', c.accent, c.surface], ['on accent', c.onAccent, c.accent],
  ['on positive', c.onAccent, c.positive], ['on danger', c.onAccent, c.danger],
  ['danger on panel', c.danger, c.surface],
  ...Object.entries(tones).map(([k, t]): [string, string, string] => [`tone ${k}`, t.fg, t.bg]),
];
test.each(pairs)('%s reaches 4.5:1', (_n, a, b) => expect(ratio(a, b)).toBeGreaterThanOrEqual(4.5));
test('control edge reaches 3:1', () => {
  expect(ratio(c.control, c.ground)).toBeGreaterThanOrEqual(3);
  expect(ratio(c.control, c.surface)).toBeGreaterThanOrEqual(3);
});
