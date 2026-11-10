import {evaluate} from './health.mjs';
export function configure(config, env = process.env) {
  const mapping = JSON.parse(env.STATUS_MONITOR_MAP || '{}');
  const components = config.components.map(component => {
    const rules = mapping[component.id];
    if (!Array.isArray(rules) || !rules.length || rules.some(r => !Number.isSafeInteger(r.id) ||
      r.id <= 0 || !['degraded', 'outage'].includes(r.alert) || !['degraded', 'outage'].includes(r.warn)))
      throw Error('Configure valid private service monitor mappings');
    return {...component, monitors: rules};
  });
  const site = env.DD_SITE || 'datadoghq.com';
  if (!['datadoghq.com','datadoghq.eu','us3.datadoghq.com','us5.datadoghq.com','ap1.datadoghq.com','ap2.datadoghq.com'].includes(site)) throw Error('Unsupported Datadog site');
  if (!env.DD_API_KEY || !env.DD_APP_KEY) throw Error('Configure Datadog credentials');
  return {config: {...config, components}, site, headers: {'DD-API-KEY': env.DD_API_KEY, 'DD-APPLICATION-KEY': env.DD_APP_KEY}};
}
export async function collect(settings, previous = {}, fetcher = fetch, now = () => new Date()) {
  const ids = [...new Set(settings.config.components.flatMap(c => c.monitors.map(m => m.id)))];
  const monitors = await Promise.all(ids.map(async id => {
    try {
      const response = await fetcher(`https://api.${settings.site}/api/v1/monitor/${id}`, {
        headers: settings.headers, signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) return {id, overall_state: 'Unknown'};
      const body = await response.json();
      return {id, overall_state: body.overall_state, deleted: body.deleted, draft_status: body.draft_status};
    } catch { return {id, overall_state: 'Unknown'}; }
  }));
  return evaluate(settings.config, monitors, previous, now());
}
