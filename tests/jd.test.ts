import {
  countWords, findMatches, formatWords, headingOf, jumpTargets, LINK_ERROR, matchSegments, MAX_JD_CHARS, prepareJd, previewText, TEXT_ERROR, toBlocks,
} from '../src/domain/jd';

// Same shape as the Umbrella sample: five headings, each followed by one long line of text.
const UMBRELLA = ['About', 'Responsibilities', 'Requirements', 'Nice to have', 'Benefits']
  .map(h => `${h}\nWe build reliable distributed systems and own services from design through production`)
  .join('\n\n');

describe('words', () => {
  it('counts words', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  \n ')).toBe(0);
    expect(countWords('one  two\nthree')).toBe(3);
  });
  it('formats with a thousands separator', () => {
    expect(formatWords(1850)).toBe('1,850 words');
    expect(formatWords(1)).toBe('1 word');
    expect(formatWords(1234567)).toBe('1,234,567 words');
  });
  it('collapses whitespace in a preview', () => expect(previewText(' a\n\n b  c ')).toBe('a b c'));
});

describe('headingOf', () => {
  it('matches the five headings, case and colon tolerant', () => {
    expect(headingOf('About')).toBe('About');
    expect(headingOf('RESPONSIBILITIES:')).toBe('Responsibilities');
    expect(headingOf('## Requirements')).toBe('Requirements');
    expect(headingOf('Nice-to-haves')).toBe('Nice to have');
    expect(headingOf('Benefits')).toBe('Benefits');
  });
  it('rejects a trailing period, long lines and other text', () => {
    expect(headingOf('About.')).toBeNull();
    expect(headingOf('Requirements are listed below in full detail')).toBeNull();
    expect(headingOf('About 5 years of experience in distributed systems.')).toBeNull();
    expect(headingOf('Salary')).toBeNull();
    expect(headingOf('')).toBeNull();
  });
});

describe('blocks and jump chips', () => {
  it('the Umbrella-style text gives five chips in order', () => {
    const jumps = jumpTargets(toBlocks(UMBRELLA));
    expect(jumps.map(j => j.label)).toEqual(['About', 'Responsibilities', 'Requirements', 'Nice to have', 'Benefits']);
    expect(jumps.map(j => j.index)).toEqual([0, 1, 2, 3, 4]);
  });
  it('no headings means no chips', () => {
    expect(jumpTargets(toBlocks('Just a long paragraph.\n\nAnd another one.'))).toEqual([]);
    expect(jumpTargets(toBlocks(''))).toEqual([]);
  });
  it('a heading starts its own block even without a blank line, and repeats give one chip', () => {
    const blocks = toBlocks('Intro line\nRequirements\n- a\n- b\n\nBenefits\nx\nRequirements\ny');
    expect(blocks.map(b => b.heading)).toEqual([undefined, 'Requirements', 'Benefits', 'Requirements']);
    expect(blocks[1].body).toBe('- a\n- b');
    expect(jumpTargets(blocks).map(j => [j.label, j.index])).toEqual([['Requirements', 1], ['Benefits', 2]]);
  });
});

describe('find', () => {
  it('splits into plain and matching pieces, case-insensitive and literal', () => {
    expect(matchSegments('Build builds', 'build')).toEqual([
      { text: 'Build', hit: true }, { text: ' ', hit: false }, { text: 'build', hit: true }, { text: 's', hit: false },
    ]);
    expect(matchSegments('a.b axb', 'a.b').filter(s => s.hit)).toHaveLength(1); // "." is not a wildcard
    expect(matchSegments('x', '  ')).toEqual([{ text: 'x', hit: false }]);
  });
  it('counts matches and finds the first block', () => {
    const blocks = toBlocks(UMBRELLA);
    expect(findMatches(blocks, 'zzz')).toEqual({ total: 0, first: -1 });
    expect(findMatches(blocks, '')).toEqual({ total: 0, first: -1 });
    expect(findMatches(blocks, 'distributed').total).toBe(5);
    expect(findMatches(blocks, 'benefits')).toEqual({ total: 1, first: 4 });
  });
});

describe('prepareJd', () => {
  it('computes words from the saved text', () => {
    expect(prepareJd('  a b c  ', '').value).toEqual({ text: 'a b c', words: 3, link: null });
  });
  it('blank text clears the description', () => {
    expect(prepareJd('  ', '').value).toEqual({ text: null, words: null, link: null });
  });
  it('accepts an https link and rejects anything else', () => {
    expect(prepareJd('x', ' https://jobs.example/1 ').value.link).toBe('https://jobs.example/1');
    for (const bad of ['http://x.com', 'javascript:alert(1)', 'jobs.example', 'https://']) {
      const r = prepareJd('x', bad);
      expect(r.error).toBe(LINK_ERROR);
      expect(r.value.link).toBeNull();
    }
  });
  it('rejects text and links over the size caps', () => {
    expect(prepareJd('a'.repeat(MAX_JD_CHARS), '').error).toBeUndefined();
    expect(prepareJd('a'.repeat(MAX_JD_CHARS + 1), '').error).toBe(TEXT_ERROR);
    expect(prepareJd('x', 'https://a.example/' + 'a'.repeat(2100)).error).toBe(LINK_ERROR);
  });
});
