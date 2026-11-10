import {readFile, writeFile} from 'node:fs/promises';
import {configure, collect} from './collect.mjs';
const config = JSON.parse(await readFile('status-config.json', 'utf8'));
const settings = configure(config);
let previous = {};
try { previous = JSON.parse(await readFile('docs/status.json', 'utf8')); } catch {}
await writeFile('docs/status.json', JSON.stringify(await collect(settings, previous), null, 2) + '\n');
