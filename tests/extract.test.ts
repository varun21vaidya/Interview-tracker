import { extract, keywordMatcher, stripHtml } from '../src/domain/extract';

describe('extract links', () => {
  it('finds a Google Meet link', () => {
    expect(extract('Join: https://meet.google.com/abc-defg-hij now').link).toBe('https://meet.google.com/abc-defg-hij');
  });
  it('finds a Zoom link', () => {
    expect(extract('https://acme.zoom.us/j/84012345678?pwd=AbC123').link).toBe('https://acme.zoom.us/j/84012345678?pwd=AbC123');
  });
  it('finds a Teams link', () => {
    const u = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=x';
    expect(extract(`Join ${u}`).link).toBe(u);
  });
  it('returns no link for plain text', () => {
    expect(extract('Bring your ID').link).toBeUndefined();
  });
  it('ignores non-https meeting links', () => {
    expect(extract('http://meet.google.com/abc-defg-hij').link).toBeUndefined();
  });
});

describe('extract phone', () => {
  it('finds "+91 90000 00000"', () => {
    expect(extract('Call me on +91 90000 00000 please').phone).toBe('+91 90000 00000');
  });
  it('does not treat a Zoom meeting ID in the URL as a phone', () => {
    expect(extract('https://us02web.zoom.us/j/84012345678?pwd=x').phone).toBeUndefined();
  });
  it('does not treat a spoken "Meeting ID" digit run inside a URL as a phone, but keeps a real number beside it', () => {
    expect(extract('https://acme.zoom.us/j/84012345678 or call +91 90000 00000').phone).toBe('+91 90000 00000');
  });
  it('ignores short digit runs', () => {
    expect(extract('Room 12, floor 3, 10:30').phone).toBeUndefined();
  });
});

describe('extract html and emails', () => {
  it('strips HTML before extracting', () => {
    const html = '<p>Join <b>https://meet.google.com/abc-defg-hij</b></p><br>Call <b>+91 90000 00000</b>';
    const x = extract(html);
    expect(x.link).toBe('https://meet.google.com/abc-defg-hij');
    expect(x.phone).toBe('+91 90000 00000');
  });
  it('known limit (spec behaviour): a link only inside an href is lost', () => {
    expect(extract('<a href="https://meet.google.com/abc-defg-hij">here</a>').link).toBeUndefined();
  });
  it('stripHtml removes tags', () => {
    expect(stripHtml('<b>a</b>').trim()).toBe('a');
  });
  it('collects emails', () => {
    expect(extract('Write to hr@acme.com or jo.b+x@mail.acme.co.in').emails).toEqual(['hr@acme.com', 'jo.b+x@mail.acme.co.in']);
  });
});

describe('keywordMatcher', () => {
  const kw = keywordMatcher(['interview', 'round', 'screening', 'technical', 'HR', 'recruiter']);
  it('"HR round" matches', () => {
    expect(kw('HR round')).toBe(true);
  });
  it('"three" does not match HR', () => {
    expect(kw('three')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(kw('Technical INTERVIEW')).toBe(true);
  });
  it('escapes regex characters in keywords', () => {
    expect(keywordMatcher(['c++'])('c++')).toBe(false); // \b cannot follow "+", documented limitation
    expect(keywordMatcher(['a.b'])('axb')).toBe(false);
    expect(keywordMatcher(['a.b'])('a.b')).toBe(true);
  });
  it('no keywords matches nothing', () => {
    expect(keywordMatcher([])('interview')).toBe(false);
  });
});

describe('recruiter contact from a signature', () => {
  const sig = `Hi,
Your HR round is booked. Join: https://meet.google.com/abc-defg-hij
Join by phone: PIN: 123 456 789#
Regards,
Priya Nair | Talent Acquisition
Mobile: +91-98765-43210
priya.nair@acme.com`;
  it('takes the labelled mobile, not the dial-in PIN', () => {
    expect(extract(sig).phone).toBe('+91-98765-43210');
    expect(extract(sig).contactEmail).toBe('priya.nair@acme.com');
  });
  it('reads common Indian formats', () => {
    expect(extract('Ph: 098765 43210').phone).toBe('098765 43210');
    expect(extract('Call (+91) 98765 43210').phone).toBeTruthy();
    expect(extract('M 9876543210').phone).toBe('9876543210');
  });
  it('ignores dates and times', () => {
    expect(extract('2026-10-23 10:30 to 11:30').phone).toBeUndefined();
  });
  it('decodes HTML and keeps signature lines apart', () => {
    expect(extract('<p>Regards</p><p>Tel:&nbsp;+91 90000 00000</p>').phone).toBe('+91 90000 00000');
  });
  it('skips system addresses and de-duplicates', () => {
    const x = extract('noreply@calendar.google.com HR@Acme.com hr@acme.com');
    expect(x.emails).toEqual(['noreply@calendar.google.com', 'HR@Acme.com']);
    expect(x.contactEmail).toBe('hr@acme.com');
  });
});
