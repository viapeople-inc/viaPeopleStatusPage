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

## AWS deployment in viaResources

The production live feed uses account `069066994138`, region `us-east-1`, stacks `viapeople-status-bootstrap` and `viapeople-status-live`.

* EventBridge Scheduler invokes Lambda every minute. Reserved concurrency is one; duplicate invocations less than 45 seconds apart are skipped.
* Lambda uses the same `collect.mjs` and `health.mjs` logic as the static publisher. Run `node scripts/build-aws-runtime.mjs` after modifying either source, then run `node --test tests/*.test.mjs` before deploying the template.
* Only sanitized snapshots are written to a private encrypted S3 bucket. CloudFront OAC can read only `status.json`; caching is disabled. Raw monitor responses and credentials never enter the public bucket.
* The bootstrap role accepts GitHub OIDC only from this repository's main branch and can write only the dedicated secret. `Provision live feed credentials` transfers existing GitHub credentials without logging them. After rotating them, rerun that workflow and redeploy the collector so CloudFormation refreshes dynamic references.
* CloudWatch retains collector logs for seven days; failed async invocations and schedule delivery failures go to an encrypted SQS dead letter queue. Check Lambda errors, schedule failures, queue depth and snapshot age when troubleshooting.
* Snapshot TTL is 180 seconds; failed Datadog reads become unknown. Recovery still requires two distinct healthy samples. The monitor's own evaluation window adds to detection time.
* The status site reads the public endpoint from `live-feed.json` at build time, with `STATUS_FEED_URL` taking precedence. For rollback, clear the endpoint in `live-feed.json` and republish before stopping the AWS collector.

CloudFormation templates manage only these status resources. Existing viaResources ECS services and Enterprise App infrastructure are unchanged.

## Public performance policy

The low-volume `slow_request_10s` monitor remains an internal Datadog alert and does not independently degrade the public status. The collector identifies it from its query without exposing that query. Other configured monitors continue to apply, including the broader slow-request threshold, Java lock contention and exhausted web threads. Unavailable monitor reads remain unknown, and an empty public monitor set never implies health. Recovery still requires two healthy observations.
