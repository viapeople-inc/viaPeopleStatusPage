const labels={operational:'Operational',degraded:'Degraded Performance',outage:'Service Disruption',maintenance:'Scheduled Maintenance',unknown:'Status Unavailable'};
const headlines={operational:'All Monitored Services Operational',degraded:'Some Services Are Experiencing Issues',outage:'A Service Disruption Has Been Detected',maintenance:'Maintenance In Progress',unknown:'Service Health Is Unverified'};
let snapshot;let failed=false;let loading=false;
const el=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
function render(){
 const age=Date.now()-Date.parse(snapshot?.generatedAt);
 const stale=failed || !Number.isFinite(age) || age< -60000 || age>900000;
 const status=stale?'unknown':snapshot.status;
 el('headline').textContent=headlines[status]||headlines.unknown;
 el('indicator').className=`indicator ${status in labels?status:'unknown'}`;
 el('summary-text').textContent=stale?'Current health could not be verified. Previous status is not confirmation of recovery.':status==='operational'?'The configured checks are reporting healthy.':status==='unknown'?'Some checks are unavailable or have not been configured.':status==='maintenance'?'Scheduled work is affecting the services shown below.':'Automated monitoring has detected potential customer impact. See service details below.';
 el('updated').textContent=Number.isFinite(age)?`Last Monitoring Update: ${new Date(snapshot.generatedAt).toLocaleString()}${stale?' · Update unavailable or stale':''}`:'No Monitoring Update Available';
 el('services').replaceChildren();
 for(const c of snapshot?.components||[]){const s=stale?'unknown':c.status;const row=make('div','','service');const text=make('div','');text.append(make('h3',c.name),make('p',c.description));row.append(text,make('span',labels[s]||labels.unknown,`badge ${s in labels?s:'unknown'}`));el('services').append(row);}
 if(!snapshot?.components?.length)el('services').append(make('p','Service health is currently unavailable.','empty'));
 el('history').replaceChildren();
 for(const h of (snapshot?.history||[]).slice(0,15)){const c=snapshot.components.find(c=>c.id===h.component);if(!c)continue;const row=make('div','','event');row.append(make('span',`${c.name}: ${labels[h.status]||labels.unknown}`),make('time',new Date(h.at).toLocaleString()));el('history').append(row);}
 if(!snapshot?.history?.length)el('history').append(make('p','No recorded status changes yet.','empty'));
}
async function refresh(){if(loading)return;loading=true;el('refresh').disabled=true;try{const r=await fetch(`status.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.components)||!(data.status in labels))throw Error();snapshot=data;failed=false;}catch{failed=true;}finally{loading=false;el('refresh').disabled=false;render();}}
el('refresh').onclick=refresh;el('theme').onclick=()=>{document.documentElement.classList.toggle('light');try{localStorage.setItem('status-theme',document.documentElement.classList.contains('light')?'light':'dark');}catch{}};
try{document.documentElement.classList.toggle('light',localStorage.getItem('status-theme')!=='dark');}catch{}
refresh();setInterval(refresh,60000);setInterval(render,15000);
