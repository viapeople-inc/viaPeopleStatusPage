import {writeFile} from 'node:fs/promises';
const endpoint = process.env.STATUS_FEED_URL || '';
if (endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/status.json'))
    throw Error('STATUS_FEED_URL must be a public HTTPS status.json endpoint without credentials or query parameters');
}
await writeFile('docs/feed-config.json', JSON.stringify({endpoint}) + '\n');
