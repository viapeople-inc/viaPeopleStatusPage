import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {freshness,preferSnapshot} from '../docs/freshness.mjs';
test('browser retains fresh health through fetch failure, expires honestly, then recovers',async()=>{
 const nodes=new Map();
 const node=()=>({textContent:'',className:'',children:[],append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,documentElement:{classList:{toggle(){},contains(){return true;}}},addEventListener(){}};
 let time=Date.now(),fail=false;
 const snapshot={generatedAt:new Date(time).toISOString(),staleAfterSeconds:180,status:'operational',components:[{id:'a',name:'Access',description:'Access',status:'operational'}],history:[]};
 class Clock extends Date {static now(){return time;}}
 const context=vm.createContext({document,window:{addEventListener(){}},location:{href:'https://status.viapeople.net/'},localStorage:{getItem(){return 'light';}},setInterval(){},Date:Clock,URL,AbortSignal,freshness:(s)=>freshness(s,time),preferSnapshot,fetch:async url=>{
   if(String(url).includes('feed-config'))return {ok:true,json:async()=>({endpoint:''})};
   if(fail)throw Error('Network unavailable');return {ok:true,json:async()=>snapshot};
 }});
 const source=(await readFile(new URL('../docs/status.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
 vm.runInContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.get('headline').textContent,'All Monitored Services Operational');
 fail=true;await vm.runInContext('refresh()',context);
 assert.equal(nodes.get('headline').textContent,'All Monitored Services Operational');
 assert.match(nodes.get('updated').textContent,/Refresh Interrupted/);
 time+=181000;vm.runInContext('render()',context);
 assert.equal(nodes.get('headline').textContent,'Monitoring Updates Delayed');
 assert.equal(nodes.get('indicator').className,'indicator unknown');
 fail=false;snapshot.generatedAt=new Date(time).toISOString();snapshot.status='outage';snapshot.components[0].status='outage';
 await vm.runInContext('refresh()',context);
 assert.equal(nodes.get('headline').textContent,'A Service Disruption Has Been Detected');
});
