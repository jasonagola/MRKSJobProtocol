# MRKS Job Protocol

`MRKS Job Protocol 1.0` is the language-neutral contract used to submit,
observe, recover, and cancel durable work across MRKS services.

The repository publishes two clients from the same tagged specification:

- Python: `mrks-job-protocol`
- TypeScript: `@mrks/job-protocol`

OpenAPI is authoritative. Generated language models and standalone JSON Schema
documents are checked in so consumers can pin and review the exact wire shape.

## Development

```bash
npm ci
python3 -m pip install -r requirements-dev.txt
npm run generate
npm test
python3 -m pytest python/tests
git diff --exit-code
```

## Protocol invariants

- Idempotency is scoped to the authenticated principal and job type.
- Only `running` jobs carry an execution lease.
- `waiting` is nonterminal and always has a typed reason.
- Durable events are cursor ordered; heartbeats are live and non-journaled.
- A lease expiry permits fenced reclaim. It does not prove semantic failure.
- Disconnecting an event stream never cancels a job.

Service-specific job inputs and results are advertised by the service's
`/v1/jobs/capabilities` resource and remain owned by that service.
