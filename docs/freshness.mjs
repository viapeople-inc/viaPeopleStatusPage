export const validStatuses = ['operational', 'degraded', 'outage', 'maintenance', 'unknown'];
export function validSnapshot(value) {
  return value && Number.isFinite(Date.parse(value.generatedAt)) && validStatuses.includes(value.status) &&
    Array.isArray(value.components) && value.components.length > 0 && value.components.every(c => c &&
      typeof c.id === 'string' && typeof c.name === 'string' && typeof c.description === 'string' && validStatuses.includes(c.status)) &&
    (value.history === undefined || Array.isArray(value.history));
}
export function freshness(snapshot, now = Date.now()) {
  const age = now - Date.parse(snapshot?.generatedAt);
  const ttl = Math.min(900, Math.max(60, Number(snapshot?.staleAfterSeconds) || 900)) * 1000;
  const stale = !Number.isFinite(age) || age < -60000 || age > ttl;
  return {age, stale, delayed: !stale && age > Math.min(120000, ttl / 2)};
}
export function preferSnapshot(current, incoming) {
  if (!validSnapshot(incoming)) throw Error('Invalid status snapshot');
  return current && Date.parse(current.generatedAt) > Date.parse(incoming.generatedAt) ? current : incoming;
}
