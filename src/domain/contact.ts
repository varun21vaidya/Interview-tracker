/** "tel:" link for a phone number: keeps digits and a leading plus, drops spaces and punctuation. */
export const telUri = (phone: string) => `tel:${phone.trim().replace(/(?!^\+)[^\d]/g, '')}`;

export const firstName = (name?: string) => name?.trim().split(/\s+/)[0] || undefined;
