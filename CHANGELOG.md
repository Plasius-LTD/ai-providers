# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Added**
  - Added immutable, explicitly allowlisted model-search ranker descriptors, exact registry selection, safe readiness projections, package-enforced deadline/cancellation invocation, strict output contracts, and deterministic ready/unavailable/throwing/cancelled/malformed fakes.
  - (placeholder)

- **Changed**
  - Raised the runtime `@plasius/ai-config` baseline to `^0.1.9` and refreshed the compatible development toolchain.
  - Added `@plasius/asset-contracts@^0.3.1` as the canonical model request, resource, evidence-mode, assurance, and immutable asset-version contract dependency.
  - Restored exact-main npm publication on a GitHub-hosted runner through
    short-lived OIDC, with an enforced Node/npm runtime and no long-lived
    write-token fallback.
  - Routed same-repository package CI through an exact-revision hosted reusable
    workflow with package-manager caching disabled, duplicate fork guards, and
    a public-package integrity check. Fork pull requests remain excluded.
  - (placeholder)

- **Fixed**
  - Rejected sparse/accessor or overridden-iteration contract inputs, bound adapter registrations, correlated explicit request rankers and candidate preview resources, rejected forged adapter substitutions before invocation, snapshotted mutable adapters without mutating caller input, made non-substitution explicit in every selection result, and rechecked invocation deadlines after adapter readiness work.
  - Rejected moving catalog-version aliases and wildcard labels while retaining valid exact catalog versions and staged-resolution preview evidence.
  - (placeholder)

- **Security**
  - Restricted ranker preview evidence to canonical MCP PNG resources and rejected direct URLs or common sensitive key/value assignments from public descriptor display metadata.
  - Bound catalog preview evidence to the canonical immutable asset-version validator.
  - (placeholder)

## [0.1.9] - 2026-07-12

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed the lockfile to consume `@plasius/ai-config@0.1.8` and the latest stable compatible development toolchain releases.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.8] - 2026-06-28

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed `@plasius/ai-config` to `^0.1.7` and updated development dependency baselines to `@types/node@26.0.1`, `@typescript-eslint/*@8.62.0`, `eslint@10.6.0`, `globals@17.7.0`, and `vitest@4.1.9`.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.7] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.6] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.3] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed dependencies to the latest stable published versions.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.2] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.1] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - Extended CD public npm visibility verification to tolerate slower registry propagation after first publish.

- **Security**
  - (placeholder)

## [0.1.0] - 2026-05-07

- Added initial public package scaffold with governance, legal, docs, build, test, and pack-check baselines.
- Added provider descriptors, cost/cache/privacy/SLO metadata contracts, registry selection, readiness diagnostics, and deterministic fake provider adapters.
- Added the `@plasius/ai-config` runtime dependency for shared provider configuration and data-policy contracts.


[0.1.0]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.0
[0.1.1]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.2
[0.1.3]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.3
[0.1.6]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.6
[0.1.7]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.7
[0.1.8]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.8
[0.1.9]: https://github.com/Plasius-LTD/ai-providers/releases/tag/v0.1.9
