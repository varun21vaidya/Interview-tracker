/** Only https links are ever opened or copied as links (Part 2 section 7). */
export const safeHttps = (u?: string | null) => (u && /^https:\/\/\S+$/i.test(u) ? u : null);

/**
 * Plain address only. Stricter than the spec regex: no ? & # % , ; < > " ' or backslash, so a stored value
 * can never add cc/bcc/subject parameters or extra recipients to the mailto link.
 */
const PART = String.raw`[^\s@?&#%,;<>"'\\]+`;
const EMAIL_RE = new RegExp(`^${PART}@${PART}\\.${PART}$`);
export const isEmail = (e: string) => e.length <= 254 && EMAIL_RE.test(e);

/** mailto: link. The address is used only if it passes isEmail, otherwise To stays empty. */
export const mailUri = (to: string, subject: string, body: string) =>
  `mailto:${isEmail(to) ? to : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
