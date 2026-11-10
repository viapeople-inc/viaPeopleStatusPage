import {createServer} from 'node:http';
import {readFile, writeFile, rename, mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {configure, collect} from './collect.mjs';
import {freshness, validSnapshot} from '../docs/freshness.mjs';

export function createCollector(settings, {initial = {}, fetcher = fetch, now = () => new Date(), persist = async () => {}} = {}) {
  let snapshot = initial, inFlight;
  return {
    snapshot: () => snapshot,
    tick() {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        snapshot = await collect(settings, snapshot, fetcher, now);
        try { await persist(snapshot); } catch { console.error('Status history persistence failed'); }
        return snapshot;
      })().finally(() => { inFlight = undefined; });
      return inFlight;
    }
  };
}
export function createHandler(collector, origin = 'https://status.viapeople.net') {
  return (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405, {Allow: 'GET, HEAD'}); return res.end();}
    const path = (req.url || '').split('?')[0];
    if (!['/status.json', '/healthz'].includes(path)) {res.writeHead(404); return res.end();}
    const snapshot = collector.snapshot();
    const ready = validSnapshot(snapshot) && !freshness(snapshot).stale;
    if (path === '/healthz') {res.writeHead(ready ? 200 : 503); return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ready}));}
    if (!validSnapshot(snapshot)) {res.writeHead(503); return res.end('{"error":"Monitoring is starting"}');}
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : JSON.stringify(snapshot));
  };
}
async function main() {
  const config = JSON.parse(await readFile('status-config.json', 'utf8'));
  const settings = configure({...config, staleAfterSeconds: 180});
  const stateFile = process.env.STATUS_STATE_FILE || 'data/status.json';
  let initial = {};
  try {const saved = JSON.parse(await readFile(stateFile, 'utf8')); if (validSnapshot(saved)) initial = saved;} catch {}
  const collector = createCollector(settings, {initial, persist: async snapshot => {
    await mkdir(dirname(stateFile), {recursive: true});
    await writeFile(stateFile + '.tmp', JSON.stringify(snapshot));
    await rename(stateFile + '.tmp', stateFile);
  }});
  // Re-evaluate and sanitize saved state before exposing it publicly.
  await collector.tick();
  const server = createServer(createHandler(collector));
  server.listen(Number(process.env.PORT || 8080), process.env.HOST || '127.0.0.1');
  const timer = setInterval(() => collector.tick().catch(() => console.error('Status collection failed')), 60000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {clearInterval(timer); server.close();});
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error('Live status service could not start; check configuration'); process.exitCode = 1;
});
