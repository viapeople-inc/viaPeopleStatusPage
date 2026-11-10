import test from 'node:test';
import assert from 'node:assert/strict';
import {freshness, preferSnapshot, validSnapshot} from '../docs/freshness.mjs';
import {configure, collect} from '../scripts/collect.mjs';
import {createCollector, createHandler} from '../scripts/live-status.mjs';
const base = new Date('2026-11-10T16:00:00Z');
const config = {staleAfterSeconds:180,recoverySamples:2,maintenance:[],components:[{id:'access',name:'Access',description:'Public access'}]};
const env = {DD_API_KEY:'private-api',DD_APP_KEY:'private-app',STATUS_MONITOR_MAP:JSON.stringify({access:[{id:123,alert:'outage',warn:'degraded'}]})};
const settings = configure(config,env);
const response = state => async () => ({ok:true,json:async()=>({overall_state:state,message:'PRIVATE',query:'private-host'})});
test('fresh snapshot survives refresh transport failure until its actual expiry',async()=>{
 const s=await collect(settings,{},response('OK'),()=>base);
 assert.equal(freshness(s,+base+30000).stale,false);
 assert.equal(freshness(s,+base+120000).delayed,true);
 assert.equal(freshness(s,+base+181000).stale,true);
 assert.equal(freshness(s,+base-120000).stale,true);
});
test('static feed expires after fifteen minutes; advertised TTL cannot extend it',async()=>{
 const s=await collect(settings,{},response('OK'),()=>base);
 s.staleAfterSeconds=999999;
 assert.equal(freshness(s,+base+901000).stale,true);
});
test('older and malformed payloads cannot replace a newer snapshot',async()=>{
 const current=await collect(settings,{},response('Alert'),()=>base);
 const old={...current,generatedAt:new Date(+base-60000).toISOString(),status:'operational'};
 assert.equal(preferSnapshot(current,old),current);
 assert.throws(()=>preferSnapshot(current,{status:'operational',components:[]}));
 assert.equal(validSnapshot({...current,components:[{}]}),false);
});
test('API errors become unknown and only public fields leave the collector',async()=>{
 const s=await collect(settings,{},async()=>({ok:false}),()=>base);
 assert.equal(s.status,'unknown');
 const healthy=await collect(settings,{},response('OK'),()=>base);
 for(const secret of ['private-api','private-app','PRIVATE','private-host','123']) assert.ok(!JSON.stringify(healthy).includes(secret));
});
test('overlapping collector ticks share one fetch and recovery takes distinct observations',async()=>{
 let calls=0,state='Alert',time=base;
 const c=createCollector(settings,{fetcher:async()=>{calls++;return {ok:true,json:async()=>({overall_state:state})};},now:()=>time});
 const a=c.tick(),b=c.tick();assert.equal(a,b);await a;assert.equal(calls,1);
 state='OK';time=new Date(+base+60000);await c.tick();assert.equal(c.snapshot().status,'outage');
 time=new Date(+base+120000);await c.tick();assert.equal(c.snapshot().status,'operational');
});
test('public endpoint is cached data only, never a viewer-triggered Datadog request',async()=>{
 const snapshot=await collect(settings,{},response('Alert'),()=>new Date());
 const handler=createHandler({snapshot:()=>snapshot});
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.code=code;},end(body){this.body=body;}};
 handler({method:'GET',url:'/status.json?t=1'},res);
 assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');
 assert.equal(res.headers['Access-Control-Allow-Origin'],'https://status.viapeople.net');
 assert.equal(JSON.parse(res.body).status,'outage');
 handler({method:'POST',url:'/status.json'},res);assert.equal(res.code,405);
});
