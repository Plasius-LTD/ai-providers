# @plasius/ai-providers

[![npm version](https://img.shields.io/npm/v/@plasius/ai-providers.svg)](https://www.npmjs.com/package/@plasius/ai-providers)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/ai-providers/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/ai-providers/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/ai-providers)](https://codecov.io/gh/Plasius-LTD/ai-providers)
[![License](https://img.shields.io/github/license/Plasius-LTD/ai-providers)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Provider adapter contracts and implementations for the Plasius agentic AI package family.

## Scope

This package is part of the layered `@plasius/ai-*` package family. It owns provider adapter descriptors, readiness checks, registry selection, cache/privacy/SLO metadata, allowlisted model-search ranker contracts, and deterministic fake adapters for downstream routing and evaluation tests.

Provider environment resolution is intentionally delegated to `@plasius/ai-config`, so API keys, project IDs, endpoints, and break-glass controls stay behind audit-safe configuration objects.

## Install

```bash
npm install @plasius/ai-providers
```

## Usage

```ts
import {
  createAiProviderRegistry,
  createFakeAiProviderAdapter,
} from "@plasius/ai-providers";
import { resolveAiProviderConfig } from "@plasius/ai-config";

const adapter = createFakeAiProviderAdapter();
const config = resolveAiProviderConfig(
  {
    providerId: "fake-dev",
    providerKind: "custom",
    tier: "development",
    capabilities: ["chat", "reasoning", "tts"],
    settings: {
      enabled: "FAKE_AI_ENABLED",
    },
    defaults: {
      enabled: true,
    },
    dataPolicy: {
      allowedDataClasses: ["public", "internal"],
      allowProviderTraining: false,
    },
  },
  process.env
);

const registry = createAiProviderRegistry([adapter]);
const candidate = registry.selectFirstCapable(
  {
    requestId: "request-1",
    kind: "chat",
    input: "Summarise this scene.",
    dataClass: "public",
    estimatedUsage: {
      inputTokens: 128,
      outputTokens: 64,
    },
  },
  {
    "fake-dev": config,
  }
);

const response = candidate
  ? await candidate.adapter.invoke(
      {
        requestId: "request-1",
        kind: "chat",
        input: "Summarise this scene.",
        dataClass: "public",
      },
      candidate.config
    )
  : undefined;
```

## Provider Descriptors

Descriptors declare provider capabilities, models, SLOs, pricing, cache eligibility, privacy policy, and optional MCP service bindings. The registry sorts capable providers by estimated request cost first, then provider priority, then provider ID for deterministic fallback behavior.

Cache metadata supports later TTS and semantic-cache layers by exposing key dimensions such as `voiceId` and `normalizedText`; this package does not store generated speech or prompt data.

## Fake Providers

`createFakeAiProviderAdapter` is intended for router, governance, and eval tests. It can simulate successful providers, unavailable providers, and invocation failures without live provider keys or committed secrets.

## Model-search rankers

The model-search ranker registry is a separate, immutable contract surface. It does not alter the existing provider registry or its cost-aware selection behavior. Rankers declare safe public identity, implementation and calibration versions, evidence mode, and an assurance ceiling. Text-only rankers are prevented from claiming `high` assurance.

Selection is exact: the registry uses an explicit allowlist and configured default, but never replaces a requested ranker with another adapter. Missing, disallowed, unavailable, throwing, or malformed readiness is reported as unavailable. `listReadiness()` returns only normalized display metadata and status; adapter instances and private configuration are excluded.

```ts
import {
  createFakeModelSearchRankerAdapter,
  createModelSearchRankerInvocation,
  createModelSearchRankerRegistry,
  invokeModelSearchRanker,
} from "@plasius/ai-providers";

const adapter = createFakeModelSearchRankerAdapter({
  descriptor: {
    rankerId: "catalog-multimodal-v1",
    implementationVersion: "1.0.0",
    calibrationId: "catalog-2026-07",
    calibrationVersion: "1.0.0",
    displayName: "Catalog multimodal ranker",
    evidenceMode: "multimodal",
    assuranceCeiling: "high",
  },
});

const registry = createModelSearchRankerRegistry({
  allowlistedRankerIds: ["catalog-multimodal-v1"],
  defaultRankerId: "catalog-multimodal-v1",
  adapters: [adapter],
});

const selection = registry.resolve("catalog-multimodal-v1");
if (selection.status === "selected") {
  const invocation = createModelSearchRankerInvocation({
    invocationId: "rank-call-1",
    request: {
      query: "weathered oak chair",
      revision: 0,
      rankerId: selection.rankerId,
      hardConstraints: {},
      softPreferences: {},
      exclusions: [],
    },
    candidates: [
      {
        candidateId: "chair-a",
        contentHash: "a".repeat(64),
        searchableText: "weathered oak reading chair",
        previewResources: [
          {
            uri: "mcp://models/catalog/chair-a/versions/v1/previews/isometric.png",
            byteLength: 4096,
            sha256: "a".repeat(64),
            contentType: "image/png",
          },
        ],
      },
    ],
    deadlineEpochMs: Date.now() + 2_000,
  });

  // The helper enforces cancellation/deadline bounds and validates unknown output.
  const output = await invokeModelSearchRanker(selection, invocation);
  console.log(output.scores);
}
```

Registries accept at most 64 allowlisted IDs and 64 adapters. Array inputs must be dense data arrays; sparse/accessor arrays cannot bypass per-element validation. Every selection records `substituted: false`, and an explicit `ModelRequestSpec.rankerId` must match the selected ranker and returned output identity.

Invocations accept between one and 20 candidates, carry an absolute deadline, and accept an `AbortSignal` at execution. Preview evidence is restricted to immutable canonical `mcp://models/...` `image/png` resources created through `@plasius/asset-contracts`: either a matching catalog asset/version preview or matching staged resolution/candidate evidence. Catalog paths additionally use the canonical asset ID and immutable asset-version validators, rejecting moving aliases such as `latest` or `production` and wildcard labels while preserving valid staged-resolution evidence. This prevents one candidate ID from being ranked against another candidate's image. `invokeModelSearchRanker()` applies the earlier of the caller deadline and the package's 30-second maximum execution window, forwards cancellation through a derived signal, rechecks readiness, and validates the unknown adapter result. Real adapters should still stop their own network or compute work when that signal aborts.

Adapter results cross the implementation boundary as `Promise<unknown>`. Low-level adapter authors and tests may call `createModelSearchRankerOutput()` directly; it verifies invocation identity, exact caller-selected ranker identity, candidate membership and uniqueness, strict enumerable data properties, dense score records, and finite scores from zero to one. A ranker may return an empty or partial score subset to abstain; every returned score remains strictly correlated. Application orchestration should use `invokeModelSearchRanker()` so the deadline/cancellation boundary cannot be omitted.

Readiness listings include only normalized descriptor fields and stable status codes. Descriptor display text rejects direct URLs and common sensitive key/value assignments, but callers remain responsible for supplying deliberately public display copy rather than provider configuration or credentials.

The exported feature-flag identifier is `asset.pipeline.unified-ai-assets.enabled`. The consuming application is responsible for evaluating the remote flag before resolving or invoking a ranker. To roll back, disable that flag so new model-search work remains on the existing path; the legacy provider/model APIs continue to operate unchanged. No package-level registry mutation or alternate adapter fallback is required during rollback.

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run pack:check
```

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

Production package publication runs only from `.github/workflows/cd.yml` on
protected `main`. The job verifies that the prepared commit is still the
current main commit and has an exact successful `ci.yml` push result before it
mutates release state. Public package CI delegates to the repository-owned
`.github/workflows/ci-hosted.yml` at the same reviewed revision, runs on explicit
GitHub-hosted capacity with package-manager caching disabled, and rejects fork
pull requests at both workflow boundaries. npm publication remains isolated on
GitHub-hosted Node.js 24 with pinned npm 11.6.2, uses the protected `production` environment and
short-lived npm OIDC with provenance, and has no long-lived npm write-token
fallback. Rollback disables CD; it never rewrites published package history.
<!-- END PLASIUS RELEASE INTEGRITY -->
