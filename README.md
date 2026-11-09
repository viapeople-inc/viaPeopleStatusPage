# viaPeople service status

Public GitHub Pages status page using the viaResources light/dark color tokens, system typography and viaPeople logo. No Datadog credentials, raw log messages, customer names, host names or SQL text are served to visitors.

## Deployment and activation

1. Review and merge the PR. The initial status is explicitly unknown, never a hardcoded healthy claim.
2. In this repository Settings → Secrets and variables → Actions, set `DD_API_KEY` and `DD_APP_KEY`. Use a dedicated Datadog application key with monitor read access (`monitors_read`); do not paste credentials into code. Set `DD_SITE` if not `datadoghq.com`.
3. In Settings → Pages, select **GitHub Actions** as the source. Preserve the existing `status.viapeople.net` custom domain and HTTPS settings. The workflow deploys the existing `docs` directory.
4. Run **Publish monitored status** manually on main. Check its successful Pages deployment and the public `status.json` timestamp. Verify both warning and recovery behavior in a nonproduction test before relying on it.
5. The workflow requests updates every five minutes. GitHub scheduled jobs may be delayed; this is not a real-time incident transport. For a strict sub-minute publication target, migrate the same evaluator to an independently hosted scheduled worker or authenticated webhook receiver with durable state. Do not run the publisher only on the production Tomcat nodes.

The browser polls once a minute and marks snapshots older than 15 minutes as unavailable. API failures, unknown, missing, skipped or draft monitors cannot establish health. Alerts are applied immediately; recovery after a degradation/outage requires two consecutive healthy observations with no stale gap. Datadog handles the underlying monitor evaluation windows. A successful API fetch is not an independent validation of a monitor's telemetry pipeline; configure source no-data monitors and test that behavior.

## Public component mapping

`status-config.json` is the explicit allowlist. Only customer-safe component names, descriptions, statuses and observation timestamps are published. Monitor messages and queries are never passed through. Status history retains the last 100 transitions using the last published JSON; a first run or failed restore starts a new history. History is an observation log, not an uptime percentage or incident SLA ledger.

* **Platform access:** existing public availability synthetic monitor 333754934. Alert becomes a service disruption. Its success establishes only the public entry point's reachability, not authenticated workflows.
* **Application performance:** existing slow request monitors 341944259 and 340971027. Alert or warning becomes degraded performance. These use completed request signals, so stalled requests may not appear promptly.
* **Review saving and submission:** intentionally unverified until dedicated validated workflow/commit monitors are mapped. Do not imply this service is healthy based only on the homepage.

Overall status prioritizes disruption, degradation, unknown, maintenance, then operational. Individual services always remain visible. A muted monitor does not become operational or automatically imply public maintenance.

For public maintenance, add an explicit window to `maintenance`, with ISO UTC `start`, `end`, and a `components` list such as `["access"]`. This marks only those services as maintenance for that interval and automatically expires. It does not schedule Datadog downtime. Keep Datadog notification downtime separately scoped to planned work. During a declared window that component is labeled maintenance even if its monitor is alerting; other components retain normal evaluation.

## November 9 monitoring review

Existing configuration was read from Datadog on November 9. Suggested thresholds below are starting points for validation, not claims of deployed changes.

| Signal | Finding | Recommended action |
| --- | --- | --- |
| Tomcat busy threads (297113148) | Warning 70%, critical 85%, averaged over five minutes; includes internal production and all connectors | Retain capacity warning. Add a fast saturation alert at >95% sustained two minutes, scoped to the public connector and B2B/B3B/B3G. Add a combined affected-node count to distinguish reduced capacity from widespread impact. Validate metric tags before deploying. |
| Java lock contention | No dedicated monitor in current inventory | Alert on `DIAGNOSTICS LOCK CONTENTION` in `source:viapeople-details`, using the verified `vp.body` field. Group by host and capture request ID, lock owner and thread stacks internally. Start with any occurrence in five minutes, then tune repetition. |
| Failed review commit | No dedicated monitor | Alert on `Failed to commit state changes` and relevant `HorizontalTableIO` SQL interruption errors. Validate against November 9 records, including requests 290046 and 290078. Keep raw details internal; map confirmed save failures to public review degradation. |
| Long query (297092022) | Warning 30 minutes, critical one hour | Add a separate application blocking-duration monitor at 30–60 seconds; do not simply lower the generic query threshold because background tasks can legitimately run longer. Capture head blocker, transaction age, SQL session, wait resource and application request correlation. |
| Blocked processes (296988624) | Critical 0.05 and warning 0.03 on a metric described as a process count | Verify metric type and scaling; these fractional thresholds may effectively alert on any blocking. Use sustained counts/duration and recovery thresholds grounded in observed samples. |
| Log error monitors | Several use `@level`, while incident records expose `vp.level` and `vp.body` | Replay queries against known incident logs and confirm whether a top-level level field actually exists. Correct field paths where necessary before trusting a green result. |
| Availability synthetic | Existing public entry point test | Add a controlled authenticated read journey and a dedicated test-tenant save/submission journey with cleanup. A landing page and a green F5 pool cannot establish that reviews can save. |
| Telemetry coverage | Existing JMX and collector heartbeat monitors | Keep them separate from customer availability. Check expected hosts explicitly; lost telemetry must not silently resolve a failure. |

Prioritize application lock alerts and failed commits, then fast saturation and controlled workflow checks. Monitor currently active requests/oldest request age as well as completed request durations. Capture blocked process reports with a bounded Extended Events session on DB5 and correlate application connection IDs to SQL session IDs; application IDs 45/52 are not SPIDs. Review enabling Query Store with a storage/performance budget. Validate these database changes with the DBA before applying.

Do not increase the 300-thread limit as the incident fix. The evidence identifies application/SQL blocking and possible lock-order inversion; the exact SQL dependency still needs reproduction. More threads may amplify database pressure.

## Local verification

`node --test tests/*.test.mjs`

`node --check docs/status.js`

To preview, serve `docs` with any local static server. The committed snapshot is unverified by design. Only the scheduled publisher creates live monitoring data. No real incident or recovery history is fabricated.
