import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const template=JSON.parse(readFileSync(new URL('../deploy/aws/runtime.json',import.meta.url)));
const code=template.Resources.Collector.Properties.Code.ZipFile;
function harness(previous, fail=false){
 const writes=[]; let calls=0;
 class GetObjectCommand {constructor(input){this.input=input;this.kind='get';}}
 class PutObjectCommand {constructor(input){this.input=input;this.kind='put';}}
 class S3Client {async send(command){if(command.kind==='get'){if(!previous){const e=Error();e.name='NoSuchKey';throw e;}return {Body:{transformToString:async()=>JSON.stringify(previous)}};}writes.push(JSON.parse(command.input.Body));return {};}}
 const context={exports:{},require:()=>({S3Client,GetObjectCommand,PutObjectCommand}),process:{env:{STATUS_BUCKET:'test',DD_API_KEY:'secret-api',DD_APP_KEY:'secret-app',STATUS_MONITOR_MAP:JSON.stringify({access:[{id:1,alert:'outage',warn:'degraded'}],performance:[{id:2,alert:'degraded',warn:'degraded'}]})}},AbortSignal,console:{log(){}},fetch:async()=>{calls++;return {ok:!fail,json:async()=>({overall_state:'OK',privateData:'never publish'})};}};
 vm.runInNewContext(code,context);
 return {run:context.exports.handler,writes,calls:()=>calls};
}
test('AWS cold start publishes only sanitized fresh status',async()=>{const h=harness();await h.run();assert.equal(h.writes[0].status,'operational');assert.equal(h.writes[0].staleAfterSeconds,180);assert(!JSON.stringify(h.writes).includes('secret'));assert(!JSON.stringify(h.writes).includes('privateData'));});
test('duplicate schedule cannot count as recovery',async()=>{const h=harness({generatedAt:new Date().toISOString(),status:'outage'});assert.equal((await h.run()).skipped,true);assert.equal(h.calls(),0);assert.equal(h.writes.length,0);});
test('Datadog errors publish unknown, never healthy',async()=>{const h=harness(null,true);await h.run();assert.equal(h.writes[0].status,'unknown');});
test('AWS bundled collector matches shared source',()=>{const health=readFileSync(new URL('../scripts/health.mjs',import.meta.url),'utf8').replaceAll('export ','');const collect=readFileSync(new URL('../scripts/collect.mjs',import.meta.url),'utf8').replace("import {evaluate} from './health.mjs';",'').replaceAll('export ','');assert(code.includes(health));assert(code.includes(collect));});
