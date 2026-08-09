# @plasius/ai-providers

Provider adapter contracts and implementations for the Plasius agentic AI package family.

## Scope

This package is part of the layered `@plasius/ai-*` package family. It owns provider adapter descriptors, readiness checks, registry selection, cache/privacy/SLO metadata, and deterministic fake adapters for downstream routing and evaluation tests.

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
mutates release state. Public package CI runs on GitHub-hosted capacity so it
cannot execute on company-managed runners. npm publication runs on
GitHub-hosted Node.js 24 with
npm 11.5.1 or newer, uses the protected `production` environment and
short-lived npm OIDC with provenance, and has no long-lived npm write-token
fallback. Rollback disables CD; it never rewrites published package history.
<!-- END PLASIUS RELEASE INTEGRITY -->
