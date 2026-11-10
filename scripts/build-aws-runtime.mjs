import {readFile,writeFile} from 'node:fs/promises';
const template=JSON.parse(await readFile('deploy/aws/runtime.json','utf8'));
const health=(await readFile('scripts/health.mjs','utf8')).replaceAll('export ','');
const collect=(await readFile('scripts/collect.mjs','utf8')).replace("import {evaluate} from './health.mjs';",'').replaceAll('export ','');
const maintenance=(await readFile('scripts/maintenance.mjs','utf8')).replaceAll('export ','');
const config=await readFile('status-config.json','utf8');
const handler=await readFile('deploy/aws/handler.cjs','utf8');
template.Resources.Collector.Properties.Code.ZipFile=health+'\n'+collect+'\n'+maintenance+'\nconst PUBLIC_CONFIG='+config+';\n'+handler;
await writeFile('deploy/aws/runtime.json',JSON.stringify(template,null,2)+'\n');
