import {freshness, preferSnapshot} from './freshness.mjs';
const labels={operational:'Operational',degraded:'Degraded Performance',outage:'Service Disruption',maintenance:'Scheduled Maintenance',unknown:'Status Unavailable'};
const headlines={operational:'All Monitored Services Operational',degraded:'Some Services Are Experiencing Issues',outage:'A Service Disruption Has Been Detected',maintenance:'Maintenance In Progress',unknown:'Service Health Is Unverified'};
let snapshot;let failed=false;let loading=false;let endpoint='';let feedConfigured=false;
const el=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
function render(){
 const {age,stale,delayed}=freshness(snapshot);
 const status=stale?'unknown':snapshot.status;
 el('headline').textContent=stale&&snapshot?'Monitoring Updates Delayed':headlines[status]||headlines.unknown;
 el('indicator').className=`indicator ${status in labels?status:'unknown'}`;
 el('summary-text').textContent=stale?'Monitoring updates are delayed. Current service health cannot be confirmed.':(failed||delayed)?'Showing the last verified status while waiting for a monitoring update.':status==='operational'?'The configured checks are reporting healthy.':status==='unknown'?'Some checks are unavailable or have not been configured.':status==='maintenance'?'Scheduled work is affecting the services shown below.':'Automated monitoring has detected potential customer impact. See service details below.';
 el('updated').textContent=Number.isFinite(age)?`Last Monitoring Update: ${new Date(snapshot.generatedAt).toLocaleString()}${stale?' · Monitoring Delayed':failed?' · Refresh Interrupted — Retrying':delayed?' · Awaiting Next Update':''}`:'No Monitoring Update Available';
 el('services').replaceChildren();
 for(const c of snapshot?.components||[]){const s=stale?'unknown':c.status;const row=make('div','','service');const text=make('div','');text.append(make('h3',c.name),make('p',c.description));row.append(text,make('span',stale?`Last Verified: ${labels[c.status]||labels.unknown}`:labels[s]||labels.unknown,`badge ${s in labels?s:'unknown'}`));el('services').append(row);}
 if(!snapshot?.components?.length)el('services').append(make('p','Service health is currently unavailable.','empty'));
 const maintenance=Array.isArray(snapshot?.maintenance)?snapshot.maintenance:[];
 const visible=maintenance.filter(w=>w&& !['completed','canceled'].includes(w.phase));
 el('maintenance-section').hidden=!visible.length&&snapshot?.maintenanceFeedAvailable!==false;
 el('maintenance-windows').replaceChildren();
 if(snapshot?.maintenanceFeedAvailable===false)el('maintenance-windows').append(make('p','Maintenance schedule updates are unavailable. Previously announced windows may have changed.','empty'));
 const phases={scheduled:'Upcoming Maintenance',in_progress:'Maintenance In Progress',verifying:'Verifying Service Recovery',overrun:'Maintenance Window Ended — Recovery Not Verified'};
 for(const w of visible){const row=make('article','','maintenance-card');row.append(make('strong',stale||!w.scheduleVerified?'Maintenance Update Unverified':phases[w.phase]||'Maintenance Update'),make('h3',w.title),make('p',w.message),make('p',`${new Date(w.start).toLocaleString()} – ${new Date(w.end).toLocaleString()}`),make('p',w.impact==='interruption'?'Brief service interruptions are expected during this window.':'No service interruption is expected.'));el('maintenance-windows').append(row);}
 el('history').replaceChildren();
 for(const h of (snapshot?.history||[]).slice(0,15)){if(!h)continue;const c=snapshot.components.find(c=>c.id===h.component);if(!c)continue;const row=make('div','','event');row.append(make('span',`${c.name}: ${labels[h.status]||labels.unknown}`),make('time',new Date(h.at).toLocaleString()));el('history').append(row);}
 if(!snapshot?.history?.length)el('history').append(make('p','No recorded status changes yet.','empty'));
}
async function readSnapshot(url){
 const target=new URL(url,location.href);target.searchParams.set('t',Date.now());
 const r=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Feed unavailable');
 return preferSnapshot(snapshot,await r.json());
}
async function refresh(){
 if(loading)return;loading=true;el('refresh').disabled=true;
 try{
  if(!feedConfigured){
   try{
    const r=await fetch(`feed-config.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error();
    const cfg=await r.json();
    if(cfg.endpoint){const u=new URL(cfg.endpoint);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error();endpoint=u.href;}
    feedConfigured=true;
   }catch{} // Static publication remains usable; retry configuration next time.
  }
  if(endpoint){
   // Never fall back to an older static snapshot after a live-feed failure.
   // Keep the last observation only until the live feed's three-minute expiry.
   snapshot=await readSnapshot(endpoint);
  }else snapshot=await readSnapshot('status.json');
  failed=false;
 }catch{failed=true;}
 finally{loading=false;el('refresh').disabled=false;render();}
}
el('refresh').onclick=refresh;el('theme').onclick=()=>{document.documentElement.classList.toggle('light');try{localStorage.setItem('status-theme',document.documentElement.classList.contains('light')?'light':'dark');}catch{}};
try{document.documentElement.classList.toggle('light',localStorage.getItem('status-theme')!=='dark');}catch{}
refresh();setInterval(refresh,30000);setInterval(render,10000);
window.addEventListener('online',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});

