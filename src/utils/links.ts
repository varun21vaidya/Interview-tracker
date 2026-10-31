/** Only https links are ever opened or copied as links (Part 2 section 7). */
export const safeHttps = (u?: string | null) => (u && /^https:\/\/\S+$/i.test(u) ? u : null);
