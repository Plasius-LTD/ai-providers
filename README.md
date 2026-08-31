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
