import {readFile,writeFile} from 'node:fs/promises';
const configured = JSON.parse(await readFile('live-feed.json','utf8'));
// An unset/empty GitHub variable uses the checked-in public endpoint.
const selected = process.env.STATUS_FEED_URL || configured.endpoint || '';
if (selected) {
  const url = new URL(selected);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/status.json'))
    throw Error('STATUS_FEED_URL must be a public HTTPS status.json endpoint without credentials or query parameters');
}
await writeFile('docs/feed-config.json', JSON.stringify({endpoint:selected}) + '\n');
