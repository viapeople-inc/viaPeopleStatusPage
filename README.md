# viaPeople service status

Public status page using the viaResources light/dark theme, typography and viaPeople logo. Only service names, descriptions, statuses and timestamps are published. Credentials, monitor identifiers, internal infrastructure details and raw telemetry stay out of the public artifact.

## Activation

Set GitHub Actions secrets `DD_API_KEY`, `DD_APP_KEY` (dedicated monitor-read access) and `STATUS_MONITOR_MAP`. The mapping is a JSON object keyed by the component IDs in `status-config.json`. Each value is an array of rules with a numeric `id`, an `alert` status and a `warn` status. Allowed rule statuses are `degraded` and `outage`. Do not commit the real mapping or credentials. Set repository variable `DD_SITE` if different from `datadoghq.com`.

Select GitHub Actions in Pages settings. Retain the custom domain and HTTPS. Run **Publish monitored status** on main and verify a successful deployment and current timestamp.

## Health behavior

The public entry point test establishes reachability only. Application performance combines responsiveness, capacity and telemetry coverage. Save failure monitoring can flag degradation, but absence of errors does not establish successful writes: `requiresPositiveCheck` keeps reviews unverified until a dedicated authenticated save test is configured and mapped.

Missing, unknown, skipped or draft monitors never establish health. Fresh detected failures appear immediately; recovery requires two healthy observations. Explicit maintenance windows in `status-config.json` contain UTC `start`, `end` and component IDs; they expire automatically. A muted Datadog alert does not imply maintenance or health. Maintenance labeling is separate from Datadog notification downtime.

Updates are requested every five minutes. GitHub schedules can be delayed. The page refreshes every minute; snapshots older than fifteen minutes are marked unavailable. A missing credential or mapping stops publication; old data then expires visibly. Source API errors publish unknown status. Monitor evaluation windows still apply.

History retains the latest 100 observed transitions from the previous published snapshot. Failed history restore starts a new history; no uptime SLA or historical incident record is fabricated.

## Follow-up monitoring

Use a dedicated test tenant and disposable review cycle for authenticated save checks. Assert persisted data after reloading, not only an HTTP response or success message. Establish reset/cleanup before enabling repeated writes. Add bounded database blocking capture and validate units and application filters before enabling duration alerts. Generic long queries may be legitimate background work.

## Validation

Run `node --test tests/*.test.mjs` and `node --check docs/status.js`. The committed snapshot is unknown by design. The scheduled publisher creates fresh monitoring data.
