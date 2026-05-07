import { describe, expect, it } from "vitest";
import {
  type AiProviderConfigDefinition,
  resolveAiProviderConfig,
} from "@plasius/ai-config";

import {
  AI_PROVIDERS_ENV_PREFIX,
  AI_PROVIDERS_FEATURE_FLAG_ID,
  AI_PROVIDERS_PACKAGE,
  type AiProviderDescriptor,
  type AiProviderRequest,
  AiProviderInvocationError,
  assessAiProviderReadiness,
  createAiProviderRegistry,
  createFakeAiProviderAdapter,
  defineAiProviderDescriptor,
  estimateAiProviderCostUsd,
  packageDescriptor,
} from "../src/index.js";

const request: AiProviderRequest = {
  requestId: "req-1",
  kind: "chat",
  input: "hello",
  dataClass: "public",
  estimatedUsage: {
    requests: 1,
    inputTokens: 1_000,
    outputTokens: 500,
  },
};

describe("@plasius/ai-providers", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_PROVIDERS_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_PROVIDERS_FEATURE_FLAG_ID);
    expect(packageDescriptor.featureFlagId).toBe(
      "ai.cost-aware-routing.enabled"
    );
    expect(packageDescriptor.envPrefix).toBe(AI_PROVIDERS_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });

  it("defines frozen provider descriptors with cache and privacy metadata", () => {
    const descriptor = defineAiProviderDescriptor(baseDescriptor());

    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.models)).toBe(true);
    expect(Object.isFrozen(descriptor.models[0]?.capabilities)).toBe(true);
    expect(descriptor.cache).toMatchObject({
      cacheable: true,
      semanticCacheEligible: true,
    });
    expect(descriptor.privacy).toMatchObject({
      allowedDataClasses: ["public", "internal"],
      allowProviderTraining: false,
    });
  });

  it("rejects invalid provider descriptors before registration", () => {
    expect(() =>
      defineAiProviderDescriptor({
        ...baseDescriptor(),
        providerId: "OpenAI",
      })
    ).toThrow("Provider id must be lowercase kebab-case");

    expect(() =>
      defineAiProviderDescriptor({
        ...baseDescriptor(),
        models: [
          modelDescriptor("fake-fast"),
          modelDescriptor("fake-fast"),
        ],
      })
    ).toThrow('duplicate model "fake-fast"');
  });

  it("finds capable adapters from enabled resolved provider configs", async () => {
    const adapter = createFakeAiProviderAdapter();
    const registry = createAiProviderRegistry([adapter]);
    const config = resolveConfig("fake-dev", "true");

    const candidates = registry.findCapable(request, {
      "fake-dev": config,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.descriptor.providerId).toBe("fake-dev");
    expect(candidates[0]?.readiness.selectedModelId).toBe("fake-fast");

    const response = await candidates[0]?.adapter.invoke(request, config);
    expect(response?.output).toBe("fake:chat:hello");
    expect(response?.usage).toMatchObject({
      requests: 1,
      inputTokens: 1_000,
      outputTokens: 500,
    });
    expect(response?.costUsd).toBe(0);
    expect(response?.diagnostics).toEqual([]);
  });

  it("excludes disabled providers from registry candidates", () => {
    const adapter = createFakeAiProviderAdapter();
    const registry = createAiProviderRegistry([adapter]);
    const config = resolveConfig("fake-dev", "false");

    const readiness = adapter.canHandle(request, config);
    expect(readiness.supported).toBe(false);
    expect(readiness.diagnostics).toContainEqual(
      expect.objectContaining({ code: "provider-disabled" })
    );
    expect(registry.findCapable(request, new Map([["fake-dev", config]]))).toEqual(
      []
    );
  });

  it("reports blocked data classes and unsupported models", () => {
    const adapter = createFakeAiProviderAdapter();
    const config = resolveConfig("fake-dev", "true");
    const sensitiveReadiness = adapter.canHandle(
      {
        ...request,
        requestId: "req-sensitive",
        dataClass: "sensitive",
      },
      config
    );
    const modelReadiness = adapter.canHandle(
      {
        ...request,
        requestId: "req-model",
        modelId: "unknown-model",
      },
      config
    );

    expect(sensitiveReadiness.supported).toBe(false);
    expect(sensitiveReadiness.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "data-class-blocked" }),
      ])
    );
    expect(modelReadiness.supported).toBe(false);
    expect(modelReadiness.diagnostics).toContainEqual(
      expect.objectContaining({ code: "model-unsupported" })
    );
  });

  it("reports missing and mismatched configs as readiness diagnostics", () => {
    const descriptor = defineAiProviderDescriptor(baseDescriptor());
    const missingConfig = assessAiProviderReadiness(descriptor, request, undefined);
    const mismatchedConfig = assessAiProviderReadiness(
      descriptor,
      request,
      resolveConfig("other-ai", "true")
    );

    expect(missingConfig.enabled).toBe(false);
    expect(missingConfig.diagnostics).toContainEqual(
      expect.objectContaining({ code: "provider-config-missing" })
    );
    expect(mismatchedConfig.supported).toBe(false);
    expect(mismatchedConfig.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "provider-config-mismatch" }),
      ])
    );
  });

  it("surfaces adapter unavailability and invocation failures for fallback tests", async () => {
    const unavailable = createFakeAiProviderAdapter({
      failureMode: "unavailable",
      failureMessage: "synthetic outage",
    });
    const throwing = createFakeAiProviderAdapter({
      failureMode: "throw",
      failureMessage: "synthetic failure",
    });
    const config = resolveConfig("fake-dev", "true");

    expect(unavailable.canHandle(request, config).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "adapter-unavailable",
        message: "synthetic outage",
      })
    );

    await expect(throwing.invoke(request, config)).rejects.toMatchObject({
      name: "AiProviderInvocationError",
      providerId: "fake-dev",
      requestId: "req-1",
    } satisfies Partial<AiProviderInvocationError>);
  });

  it("orders capable providers by estimated request cost before priority", () => {
    const expensive = createFakeAiProviderAdapter({
      descriptor: baseDescriptor({
        providerId: "expensive-ai",
        priority: 1,
        pricing: {
          requestUsd: 0.001,
          inputTokenUsdPerMillion: 20,
          outputTokenUsdPerMillion: 30,
        },
        models: [modelDescriptor("expensive-fast")],
      }),
    });
    const cheap = createFakeAiProviderAdapter({
      descriptor: baseDescriptor({
        providerId: "cheap-ai",
        priority: 10,
        pricing: {
          requestUsd: 0.001,
          inputTokenUsdPerMillion: 1,
          outputTokenUsdPerMillion: 2,
        },
        models: [modelDescriptor("cheap-fast")],
      }),
    });
    const registry = createAiProviderRegistry([expensive, cheap]);

    const candidates = registry.findCapable(request, {
      "cheap-ai": resolveConfig("cheap-ai", "true"),
      "expensive-ai": resolveConfig("expensive-ai", "true"),
    });

    expect(candidates.map((candidate) => candidate.descriptor.providerId)).toEqual(
      ["cheap-ai", "expensive-ai"]
    );
    expect(candidates[0]?.estimatedCostUsd).toBeLessThan(
      candidates[1]?.estimatedCostUsd ?? Number.POSITIVE_INFINITY
    );
  });

  it("uses priority and provider id as deterministic fallback ordering", () => {
    const beta = createFakeAiProviderAdapter({
      descriptor: baseDescriptor({
        providerId: "beta-ai",
        priority: 10,
        pricing: undefined,
        models: [modelDescriptor("beta-fast")],
      }),
    });
    const alpha = createFakeAiProviderAdapter({
      descriptor: baseDescriptor({
        providerId: "alpha-ai",
        priority: 10,
        pricing: undefined,
        models: [modelDescriptor("alpha-fast")],
      }),
    });
    const preferred = createFakeAiProviderAdapter({
      descriptor: baseDescriptor({
        providerId: "preferred-ai",
        priority: 1,
        pricing: undefined,
        models: [modelDescriptor("preferred-fast")],
      }),
    });
    const registry = createAiProviderRegistry([beta, alpha, preferred]);

    const candidates = registry.findCapable(request, {
      "alpha-ai": resolveConfig("alpha-ai", "true"),
      "beta-ai": resolveConfig("beta-ai", "true"),
      "preferred-ai": resolveConfig("preferred-ai", "true"),
    });

    expect(candidates.map((candidate) => candidate.descriptor.providerId)).toEqual(
      ["preferred-ai", "alpha-ai", "beta-ai"]
    );
    expect(registry.selectFirstCapable(request, {})).toBeUndefined();
  });

  it("estimates provider cost from usage and model pricing", () => {
    const descriptor = defineAiProviderDescriptor(
      baseDescriptor({
        pricing: {
          requestUsd: 0.001,
          inputTokenUsdPerMillion: 3,
          outputTokenUsdPerMillion: 6,
          audioOutputUsdPerMinute: 0.25,
          characterUsdPerMillion: 15,
        },
      })
    );

    expect(
      estimateAiProviderCostUsd(descriptor, "fake-fast", {
        requests: 1,
        inputTokens: 1_000,
        outputTokens: 500,
        audioOutputSeconds: 60,
        characters: 2_000,
      })
    ).toBe(0.287);
  });

  it("keeps readiness assessment independent from live provider keys", () => {
    const descriptor = defineAiProviderDescriptor(baseDescriptor());
    const readiness = assessAiProviderReadiness(
      descriptor,
      {
        ...request,
        kind: "tts",
        metadata: {
          voiceId: "development-voice",
        },
      },
      resolveConfig("fake-dev", "true")
    );

    expect(readiness.supported).toBe(true);
    expect(readiness.selectedModelId).toBe("fake-fast");
    expect(JSON.stringify(readiness)).not.toContain("token");
  });

  it("supports MCP metadata and non-string fake outputs without provider calls", async () => {
    const adapter = createFakeAiProviderAdapter({
      descriptor: baseDescriptor({
        mcpServices: [
          {
            serviceId: "audit-log",
            scope: "call",
            required: true,
            metadata: {
              mode: "test",
            },
          },
        ],
      }),
      latencyMs: 7,
      confidence: 0.75,
      metadata: {
        fixture: true,
      },
    });
    const response = await adapter.invoke(
      {
        requestId: "req-object",
        kind: "moderation",
        input: {
          text: "hello",
        },
        dataClass: "public",
      },
      resolveConfig("fake-dev", "true")
    );

    expect(adapter.descriptor.mcpServices?.[0]?.metadata).toEqual({
      mode: "test",
    });
    expect(response.output).toEqual({
      kind: "moderation",
      requestId: "req-object",
    });
    expect(response).toMatchObject({
      confidence: 0.75,
      latencyMs: 7,
      metadata: {
        fixture: true,
      },
    });
  });

  it("allows fake response factories for downstream eval fixtures", async () => {
    const adapter = createFakeAiProviderAdapter({
      responseFactory: (providerRequest) => ({
        echoedRequestId: providerRequest.requestId,
      }),
    });

    await expect(
      adapter.invoke(request, resolveConfig("fake-dev", "true"))
    ).resolves.toMatchObject({
      output: {
        echoedRequestId: "req-1",
      },
    });
  });
});

function resolveConfig(providerId: string, enabled: string) {
  return resolveAiProviderConfig(configDefinition(providerId), {
    FAKE_ENABLED: enabled,
  });
}

function configDefinition(providerId: string): AiProviderConfigDefinition {
  return {
    providerId,
    providerKind: "custom",
    displayName: "Fake provider",
    tier: "development",
    capabilities: ["chat", "reasoning", "moderation", "stt", "tts", "mcp", "rag"],
    settings: {
      enabled: "FAKE_ENABLED",
    },
    defaults: {
      enabled: false,
    },
    dataPolicy: {
      allowedDataClasses: ["public", "internal"],
      dataResidency: "local",
      allowProviderTraining: false,
    },
  };
}

function baseDescriptor(
  overrides: Partial<AiProviderDescriptor> = {}
): AiProviderDescriptor {
  const capabilities = overrides.capabilities ?? [
    "chat",
    "reasoning",
    "moderation",
    "stt",
    "tts",
    "mcp",
    "rag",
  ];

  return {
    providerId: "fake-dev",
    providerKind: "custom",
    displayName: "Fake provider",
    tier: "development",
    capabilities,
    models: overrides.models ?? [modelDescriptor("fake-fast", capabilities)],
    priority: 100,
    pricing: {
      requestUsd: 0,
      inputTokenUsdPerMillion: 0,
      outputTokenUsdPerMillion: 0,
    },
    slo: {
      timeoutMs: 1_000,
      p50LatencyMs: 25,
      p95LatencyMs: 50,
      availabilityTarget: 1,
    },
    cache: {
      cacheable: true,
      semanticCacheEligible: true,
      defaultTtlSeconds: 300,
      keyDimensions: ["providerId", "modelId", "kind", "voiceId", "normalizedText"],
    },
    privacy: {
      allowedDataClasses: ["public", "internal"],
      dataResidency: "local",
      allowProviderTraining: false,
      retentionDays: 0,
    },
    ...overrides,
  };
}

function modelDescriptor(
  modelId: string,
  capabilities: AiProviderDescriptor["capabilities"] = ["chat", "reasoning"]
) {
  return {
    modelId,
    capabilities,
    tier: "development" as const,
    supportedDataClasses: ["public", "internal"] as const,
  };
}
