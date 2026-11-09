# sub_ms Behavior and Verification

## Release Identity

- Application version: `2.20.1-riyue-ms.2`.
- Upstream: `ranxi2001/sub2api v2.20.1` at
  `19555361324e8df0f4723cc564246a43100490a7`.
- Timing reference: `v2.19.4` at
  `7c57360065e6b181fbc0d5eb52cd037e7f437f1e`.
- Scope: usage presentation, HTTP usage TTFT compatibility, and API-key Fast
  billing. This repository publication does not deploy a running service.

## Usage Pages

Both `/usage` and `/admin/usage` share `UsageTable.vue`. The latency column
contains first token and total duration; the performance column contains TPS
and cache percentage. Filters, exports, pagination, column preferences, cache
visibility and administrator-only detailed traces retain their existing controls.
User pages open the same summary layout without fetching privileged traces.

The v2.19.4 color thresholds remain TTFT 10/30/60 seconds and duration
60/180/300 seconds. TPS/cache formulas are unchanged. The table selects persisted
`first_token_ms` and `duration_ms`, not `queue_timing` or `content_timing`.
For the screenshot regression, 876ms and 8.18s remain 876ms and 8.18s even when
queue-inclusive observations are 2.94s and 10.24s. Missing timers stay missing.
The details dialog restores the v2.19.4 nine-summary layout and separately
labels queue-inclusive measurements. No production history is rewritten.

HTTP native and passthrough Responses usage timers restore the v2.19.4 semantic
predicate, or the existing visible-output predicate when selected. This retains
legacy empty-delta/output-item and terminal-event behavior. It does **not** mean
every timer represents the first visible character. Native WS uses the unchanged
shared semantic helper. First-event and typed-semantic diagnostics remain
independent; they do not replace stored usage TTFT. Historical rows are not
rewritten. Framing, safety checks and retry protections remain from v2.20.1.

## API-Key Fast Billing

An ordinary OpenAI API-key account retains an effective outbound `priority` or
`fast` tier when a compatible upstream reports `default`. This is a request-tier
billing policy, **not evidence of actual upstream acceleration**. Operators must
communicate that distinction to their users.

The raw response and `UpstreamResponseServiceTier` are preserved. A mismatch
emits `billing.service_tier_resolved` with requested, observed and billed tiers,
`tier_source=outbound_request`, and `response_tier_non_authoritative=true`.

- Explicit `openai_response_tier_billing_enabled=true` takes precedence.
- Explicit Flex downgrades remain supported.
- Normal or policy-filtered requests are not promoted to Fast.
- Free Fast, custom prices and OAuth behavior are unchanged.
- Only new requests use this policy; historical charges are not recalculated.

## Regression Map

| Contract | Tests |
| --- | --- |
| Legacy HTTP timer and visible-output mode | `backend/internal/service/sub_ms_usage_contract_test.go`, `openai_sse_semantic_ttft_test.go` |
| Fast/default mismatch, response-billing opt-in, audit | `backend/internal/service/sub_ms_usage_contract_test.go`, `service_tier_billing_test.go` |
| Persisted tier and accounting | `backend/internal/service/openai_gateway_record_usage_test.go` |
| Shared layout, colors, permissions and missing metrics | `frontend/src/components/admin/usage/__tests__/`, `frontend/src/views/admin/__tests__/UsageView.spec.ts` |
| Built user/admin pages at four widths | `scripts/verify-usage-ui.cjs` |

## ms.2 Verification

The ms.2 regression suite includes both audience tables, the 876ms screenshot
case, missing values, user-only summary access, and the legacy details layout.
Release-specific raw results are kept in the private operations workspace.

## Original ms.1 Verification

The original release candidate was checked on 2026-11-09:

- 191 focused frontend tests passed; frontend production build/typecheck passed.
- 1,245 passing backend test events in the focused service, OpenAI and
  request-timing run. Counts include subtests, not just top-level tests.
- Expanded tests in the same three packages recorded 24,903 passing events and
  21 skips. Eight environment-related failures (fixture paths, DNS, Python) were
  re-run successfully after fixing the test environment. The initial expanded
  command did not exit cleanly; this is not a claim that all repository tests ran.
- Eight Playwright scenarios covered user/admin pages at 1440/768/390/320px.
  APIs were synthetic and external origins were blocked.
- An isolated actual-image rehearsal covered Responses/Chat, native/passthrough,
  streaming/nonstreaming, Fast/default charges and balance debits, response-tier
  opt-in, user/admin stored timers, revoked keys, mixed versions and rollback.
  No real-user credentials or paid provider requests were used.

This evidence describes a particular release candidate, not every future build
or provider. Local raw reports, deployment credentials and runtime snapshots are
not distributed. Reproducible source-level commands are in
[the build guide](docs/SUB_MS_BUILD.md).

## Compatibility and Packaging

This fork introduces no new database migration. Upgrading from an older upstream
release still applies that upstream's pending migrations. For the audited release
environment, `337_ai_ops_proposal_cancel.sql` was the pending migration; another
environment can have a different pending set. Never assume binary rollback also
rolls back a shared database.

The original deployed binary was built before the public repository commits and
recorded the upstream base as its commit. Repository preparation adds packaging,
portable verification and documentation; it does not replace that deployed image.
New source builds should embed their actual source SHA, version and build date.
The frozen original source archive and runtime evidence are retained privately.
