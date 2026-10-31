const subs = new Set<() => void>();
export const onChange = (f: () => void) => (subs.add(f), () => { subs.delete(f); });
export const emitChange = () => subs.forEach(f => f());
