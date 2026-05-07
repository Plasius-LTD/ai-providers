# ADR-0002: Provider Registry and Fake Adapter Harness

- Date: 2026-05-07
- Status: Accepted

## Context

Agentic AI routing needs to compare provider options by capability, cost, cache eligibility, privacy policy, and operational readiness without binding downstream packages to live provider SDKs. Tests also need deterministic provider behavior so fallback and evaluation logic can run without API keys or external network calls.

## Decision

`@plasius/ai-providers` will own:

- provider descriptors for models, pricing, SLOs, cache policy, privacy policy, and MCP service bindings;
- readiness assessment that combines descriptors with resolved `@plasius/ai-config` provider configuration;
- a registry that returns capable providers in deterministic cost-aware order;
- a fake adapter that can simulate success, unavailability, and invocation failure.

The package will not own secret resolution, live provider SDK clients, persistent cache storage, or speech asset storage. Those remain in later layers that can consume this package boundary.

## Consequences

- Downstream routing, RAG, governance, and game-NPC packages can test fallback behavior before paid provider adapters exist.
- Provider credentials remain behind `@plasius/ai-config` redaction and environment controls.
- Cost-aware routing has a stable metadata source while still allowing provider-specific adapters to evolve independently.
- TTS cache implementations can reuse descriptor cache dimensions such as `voiceId` and `normalizedText` without coupling cache storage to provider invocation.
