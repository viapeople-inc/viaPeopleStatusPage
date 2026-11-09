export const rank = {operational:0, maintenance:1, unknown:2, degraded:3, outage:4};
export function evaluate(config, monitors, previous = {}, now = new Date()) {
  const timestamp = now.toISOString();
  const recent = Date.parse(previous.generatedAt) <= +now && +now-Date.parse(previous.generatedAt) < config.staleAfterSeconds*1000;
  const components = config.components.map(component => {
    const states = component.monitors.map(rule => {
      const monitor = monitors.find(m => m.id === rule.id);
      if (!monitor || monitor.deleted || monitor.draft_status === 'draft') return 'unknown';
      return ({OK:'operational',Alert:rule.alert,Warn:rule.warn})[monitor.overall_state] || 'unknown';
    });
    let status = states.length ? states.reduce((a,b)=>rank[a]>rank[b]?a:b) : 'unknown';
    const old = previous.components?.find(c=>c.id===component.id);
    let recoveryCount = 0;
    if (status === 'operational' && ['degraded','outage'].includes(old?.status)) {
      recoveryCount = (recent ? old.recoveryCount || 0 : 0) + 1;
      if (recoveryCount < config.recoverySamples) status = old.status;
    }
    const planned = config.maintenance.some(m => m.components.includes(component.id) && Date.parse(m.start)<=+now && +now<Date.parse(m.end));
    // Explicit public maintenance only; a muted Datadog monitor is not evidence of maintenance or recovery.
    if (planned) {status='maintenance'; recoveryCount=0;}
    return {id:component.id,name:component.name,description:component.description,status,recoveryCount};
  });
  const status = components.reduce((a,b)=>rank[a]>rank[b.status]?a:b.status,'operational');
  const history = (previous.history || []).filter(e=>e && typeof e.at==='string' && config.components.some(c=>c.id===e.component) && Object.hasOwn(rank,e.status)).map(e=>({at:e.at,component:e.component,status:e.status}));
  for (const c of components) if (previous.components?.find(p=>p.id===c.id)?.status !== c.status) history.unshift({at:timestamp,component:c.id,status:c.status});
  return {generatedAt:timestamp,staleAfterSeconds:config.staleAfterSeconds,status,components,history:history.slice(0,100)};
}
