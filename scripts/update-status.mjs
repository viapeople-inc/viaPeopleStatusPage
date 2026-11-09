import {readFile,writeFile} from 'node:fs/promises';
import {evaluate} from './health.mjs';
const config=JSON.parse(await readFile('status-config.json','utf8'));
// Keep internal monitor identifiers out of the public repository and artifact.
const mapping=JSON.parse(process.env.STATUS_MONITOR_MAP || '{}');
for (const component of config.components) {
  const rules=mapping[component.id];
  if (!Array.isArray(rules) || !rules.length) throw Error('Configure private service monitor mappings');
  if (rules.some(r=>!Number.isSafeInteger(r.id) || r.id<=0 || !['degraded','outage'].includes(r.alert) || !['degraded','outage'].includes(r.warn))) throw Error('Invalid private monitor mapping');
  component.monitors=rules;
}
let previous={}; try {previous=JSON.parse(await readFile('docs/status.json','utf8'));} catch {}
const site=process.env.DD_SITE || 'datadoghq.com';
if (!['datadoghq.com','datadoghq.eu','us3.datadoghq.com','us5.datadoghq.com','ap1.datadoghq.com','ap2.datadoghq.com'].includes(site)) throw Error('Unsupported Datadog site');
if (!process.env.DD_API_KEY || !process.env.DD_APP_KEY) throw Error('Configure Datadog credentials before enabling publication');
const ids=[...new Set(config.components.flatMap(c=>c.monitors.map(m=>m.id)))];
const monitors=await Promise.all(ids.map(async id=>{
  try {
    const response=await fetch(`https://api.${site}/api/v1/monitor/${id}`,{headers:{'DD-API-KEY':process.env.DD_API_KEY,'DD-APPLICATION-KEY':process.env.DD_APP_KEY},signal:AbortSignal.timeout(15000)});
    if(!response.ok) {console.warn(`Monitor fetch failed: HTTP ${response.status}`); return {id,overall_state:'Unknown'};}
    const body=await response.json();
    return {id,overall_state:body.overall_state,deleted:body.deleted,draft_status:body.draft_status};
  } catch {console.warn('Monitor fetch unavailable');return {id,overall_state:'Unknown'};}
}));
// Only a fixed, customer-safe projection is ever written to the public repository.
await writeFile('docs/status.json',JSON.stringify(evaluate(config,monitors,previous),null,2)+'\n');
