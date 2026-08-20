# ADR-0003: Exact Allowlisted Model-search Ranker Registry

- Date: 2026-07-13
- Status: Accepted

## Context

The unified asset pipeline needs to rank model-search candidates with implementations whose identity, calibration, evidence mode, and maximum assurance are auditable. Callers need a safe way to inspect readiness without exposing adapter instances, endpoints, credentials, or provider-specific configuration. They also need deterministic failure behavior: selecting one ranker must never silently invoke another when the requested implementation is disallowed, missing, or unavailable.

Ranker implementations are an untrusted integration boundary. Candidate sets and execution time must be bounded, cancellation must propagate, and raw implementation output cannot be treated as a validated asset-contract assessment. Existing provider/model APIs already serve a separate cost-aware routing use case and must remain source-compatible.

## Decision

Add a separate model-search ranker module to `@plasius/ai-providers` with these rules:

- Descriptors contain a safe ranker ID, implementation version, calibration ID/version, display metadata, canonical `@plasius/asset-contracts` evidence mode, and assurance ceiling. A text-only descriptor cannot claim `high` assurance.
- A registry is created once from an explicit immutable allowlist, configured default, and at most 64 adapters. Explicit IDs resolve exactly. A missing, disallowed, or unavailable selected ranker returns a stable unavailable result with `substituted: false` and is never replaced.
- Readiness is normalized into immutable public projections. Thrown or malformed readiness fails closed as dependency-unavailable, without returning private adapter state. Registry construction captures each adapter's methods behind a frozen descriptor-consistent facade without freezing or otherwise mutating caller-owned objects.
- Invocations contain a canonical `ModelRequestSpec`, one to 20 immutable candidates, public canonical `mcp://models/...` PNG evidence, an absolute deadline, and an optional `AbortSignal` at execution time. Preview resources must be scoped to the same canonical catalog asset/version identity or staged resolution candidate; catalog identity is validated by the shared asset-ID and immutable asset-version factories, so moving aliases and wildcard labels fail closed. Untrusted arrays must be dense concrete data arrays and untrusted objects must contain only expected enumerable data properties; caller-overridden array iteration is never used for normalization.
- `invokeModelSearchRanker` applies the earlier of the caller's absolute deadline and a 30-second package maximum, propagates cancellation to the adapter, rechecks readiness, and validates the result. Adapters remain responsible for cooperatively stopping underlying network or compute work when the derived signal aborts.
- Adapter output crosses the boundary as `Promise<unknown>`. `createModelSearchRankerOutput` verifies exact invocation/ranker/request correlation, candidate membership and uniqueness, strict object keys/properties, dense records, and finite scores in the inclusive zero-to-one range. Empty or partial score sets are permitted as explicit abstention; every returned item must still correlate to one invocation candidate.
- Deterministic fakes cover ready, unavailable, throwing, cancelled, and malformed-output modes without network access or secrets.
- The existing provider registry and fake provider APIs remain unchanged. The ranker feature is exposed under `asset.pipeline.unified-ai-assets.enabled`; consuming applications evaluate the remote flag.

## Consequences

- Model-search orchestration can enumerate safe ranker readiness and retain auditable version/calibration evidence without learning provider secrets.
- Misconfiguration and dependency failures are explicit and fail closed; callers cannot accidentally gain an undeclared fallback path.
- A caller-selected request cannot be paired with another ranker's output, even when the output otherwise has valid candidate IDs and scores.
- Tests can exercise success, cancellation, deadline, availability, adapter failure, and hostile output deterministically.
- Application consumers use the bounded invocation helper before using scores; low-level adapter authors may use the parser directly in contract tests.
- Disabling `asset.pipeline.unified-ai-assets.enabled` is the rollback mechanism for new model-search work. The legacy provider/model selection path remains available because its API and feature flag are unchanged.
