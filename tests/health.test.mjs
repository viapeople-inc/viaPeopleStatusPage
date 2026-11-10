import test from 'node:test';import assert from 'node:assert/strict';import {evaluate} from '../scripts/health.mjs';
const now=new Date('2026-11-09T18:00:00Z');const config={staleAfterSeconds:900,recoverySamples:2,maintenance:[],components:[{id:'access',name:'Platform access',description:'Public entry point',monitors:[{id:1,alert:'outage',warn:'degraded'}]}]};
const check=(state,prev={},time=now,c=config)=>evaluate(c,[{id:1,overall_state:state}],prev,time);
test('failure surfaces immediately and has no private payload',()=>{const r=evaluate(config,[{id:1,overall_state:'Alert',message:'private client data',query:'internal host'}],{},now);assert.equal(r.status,'outage');assert.ok(!JSON.stringify(r).includes('private client'));assert.ok(!JSON.stringify(r).includes('internal host'));});
test('requires two healthy observations before resolving',()=>{const down=check('Alert');const first=check('OK',down,new Date(+now+300000));assert.equal(first.status,'outage');const second=check('OK',first,new Date(+now+600000));assert.equal(second.status,'operational');});
test('stale recovery observations do not count',()=>{let r=check('Alert');r=check('OK',r,new Date(+now+300000));r=check('OK',r,new Date(+now+1800000));assert.equal(r.status,'outage');assert.equal(r.components[0].recoveryCount,1);});
test('missing, unknown, skipped and no data are never healthy',()=>{for(const s of ['No Data','Unknown','Skipped',undefined])assert.equal(check(s).status,'unknown');assert.equal(evaluate(config,[],{},now).status,'unknown');});
test('empty monitor mapping is explicitly unknown',()=>assert.equal(evaluate({...config,components:[{...config.components[0],monitors:[]}]},[],{},now).status,'unknown'));
test('muted alerts remain affected',()=>assert.equal(evaluate(config,[{id:1,overall_state:'Alert',options:{silenced:{'*':null}}}],{},now).status,'outage'));
test('maintenance affects only explicit time and component',()=>{const c={...config,maintenance:[{components:['access'],start:'2026-11-09T17:00:00Z',end:'2026-11-09T19:00:00Z'}]};assert.equal(check('Alert',{},now,c).status,'maintenance');assert.equal(check('Alert',{},new Date('2026-11-09T20:00:00Z'),c).status,'outage');});
test('draft monitors do not establish health',()=>assert.equal(evaluate(config,[{id:1,overall_state:'OK',draft_status:'draft'}],{},now).status,'unknown'));

test('error-only coverage flags failures but cannot prove successful saves',()=>{const c={...config,components:[{...config.components[0],requiresPositiveCheck:true}]};assert.equal(check('OK',{},now,c).status,'unknown');assert.equal(check('Alert',{},now,c).status,'outage');});


test('internal slow-request alert alone does not degrade public service',()=>{
 const c={...config,components:[{...config.components[0],monitors:[{id:1,alert:'degraded',warn:'degraded'},{id:2,alert:'degraded',warn:'degraded'}]}]};
 const monitors=[{id:1,overall_state:'Alert',internalOnly:true},{id:2,overall_state:'OK'}];
 assert.equal(evaluate(c,monitors,{},now).status,'operational');
 assert.equal(evaluate(c,[monitors[0],{id:2,overall_state:'Alert'}],{},now).status,'degraded');
 assert.equal(evaluate(c,[monitors[0],{id:2,overall_state:'Unknown'}],{},now).status,'unknown');
 assert.equal(evaluate(config,[monitors[0]],{},now).status,'unknown');
});
