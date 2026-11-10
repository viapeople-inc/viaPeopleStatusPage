# Activate the live status feed

This is an optional deployment, not automatically provisioned by the PR. The existing GitHub Pages scheduled publisher remains the fallback until a live endpoint is configured.

Run one Node.js 22 service independently of the Enterprise App and DB5, preferably on existing cloud infrastructure. Do not run multiple replicas without a shared state and leader strategy. It polls Datadog every 60 seconds regardless of visitor count. The public endpoint only reads its cached, sanitized projection. Monitor evaluation windows still contribute detection latency. Recovery requires two separate healthy polls. Source API failures produce unknown, not green. A stalled collector expires after three minutes.

1. Deploy this repository to `/opt/viapeople-status`; install Node.js 22 and a dedicated `status-feed` system user. Review the executable path in `status-feed.service`.
2. Supply `DD_API_KEY`, `DD_APP_KEY`, `STATUS_MONITOR_MAP`, and optional `DD_SITE` through a protected `/etc/viapeople-status.env` file (root-owned mode 0600), using the existing private mapping and a monitor-read application key. Never put secrets in the repository, public JSON, browser, or URLs.
3. Install the supplied systemd unit and start the service. Persist `/var/lib/viapeople-status`; startup re-evaluates saved history before publishing it.
4. Put an HTTPS reverse proxy in front of loopback port 8080. Expose only `/status.json` to browsers. Do not cache it. Its allowed browser origin is `https://status.viapeople.net`. Use `/healthz` internally for collector freshness; it is not a platform health check.
5. Verify two timestamp changes approximately one minute apart, redacted content, CORS, and error/timeout behavior. A successful HTTP request alone does not confirm platform health.
6. Set the status-page repository variable `STATUS_FEED_URL` to the verified HTTPS URL ending `/status.json`, without query parameters. Run **Publish monitored status** once. No keys are published by this setting.
7. Check the deployed page fetches this URL every 30 seconds, refreshes when returning to the tab, and expires it after three minutes if the collector stops.

Rollback: clear `STATUS_FEED_URL` and publish once to return to scheduled static snapshots. Do not stop the live service before switching readers. Static snapshots retain the fifteen-minute expiry; scheduled GitHub Actions cannot guarantee real-time collection.

Host and endpoint deployment are prerequisites. Merging this PR alone does not enable one-minute collection. Check the next scheduled static publication separately after any workflow changes.
