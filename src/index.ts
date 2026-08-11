import type {
  AiDataClass,
  AiProviderCapability,
  AiProviderKind,
  AiProviderTier,
  AiResolvedProviderConfig,
} from "@plasius/ai-config";

export * from "./model-search-rankers.js";

export type {
  AiDataClass,
  AiProviderCapability,
  AiProviderConfigDefinition,
  AiProviderKind,
  AiProviderTier,
  AiResolvedProviderConfig,
} from "@plasius/ai-config";

export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_PROVIDERS_PACKAGE = "@plasius/ai-providers";
export const AI_PROVIDERS_FEATURE_FLAG_ID = "ai.cost-aware-routing.enabled";
export const AI_PROVIDERS_ENV_PREFIX = "AI_PROVIDERS";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_PROVIDERS_PACKAGE,
  featureFlagId: AI_PROVIDERS_FEATURE_FLAG_ID,
  envPrefix: AI_PROVIDERS_ENV_PREFIX,
  summary: "Provider adapter contracts and implementations for the Plasius agentic AI package family.",
});

export type AiProviderRequestKind = AiProviderCapability;
export type AiProviderMetadata = Readonly<Record<string, unknown>>;
export type AiProviderConfigLookup =
  | ReadonlyMap<string, AiResolvedProviderConfig>
  | Readonly<Record<string, AiResolvedProviderConfig | undefined>>;

export interface AiProviderPricing {
  readonly requestUsd?: number;
  readonly inputTokenUsdPerMillion?: number;
  readonly outputTokenUsdPerMillion?: number;
  readonly audioInputUsdPerMinute?: number;
  readonly audioOutputUsdPerMinute?: number;
  readonly characterUsdPerMillion?: number;
}

export interface AiProviderSlo {
  readonly timeoutMs: number;
  readonly p50LatencyMs?: number;
  readonly p95LatencyMs?: number;
  readonly availabilityTarget?: number;
}

export interface AiProviderCachePolicy {
  readonly cacheable: boolean;
  readonly semanticCacheEligible?: boolean;
  readonly defaultTtlSeconds?: number;
  readonly keyDimensions?: readonly string[];
}

export interface AiProviderPrivacyPolicy {
  readonly allowedDataClasses: readonly AiDataClass[];
  readonly dataResidency?: string;
  readonly allowProviderTraining?: boolean;
  readonly retentionDays?: number;
}

export interface AiProviderModelDescriptor {
  readonly modelId: string;
  readonly providerModelId?: string;
  readonly displayName?: string;
  readonly capabilities: readonly AiProviderCapability[];
  readonly tier?: AiProviderTier;
  readonly contextWindowTokens?: number;
  readonly outputTokenLimit?: number;
  readonly supportedDataClasses?: readonly AiDataClass[];
  readonly pricing?: AiProviderPricing;
  readonly slo?: AiProviderSlo;
  readonly cache?: AiProviderCachePolicy;
  readonly privacy?: AiProviderPrivacyPolicy;
  readonly metadata?: AiProviderMetadata;
}

export interface AiMcpServiceBinding {
  readonly serviceId: string;
  readonly scope: "provider" | "call";
  readonly required?: boolean;
  readonly metadata?: AiProviderMetadata;
}

export interface AiProviderDescriptor {
  readonly providerId: string;
  readonly providerKind: AiProviderKind;
  readonly displayName?: string;
  readonly tier: AiProviderTier;
  readonly capabilities: readonly AiProviderCapability[];
  readonly models: readonly AiProviderModelDescriptor[];
  readonly priority?: number;
  readonly pricing?: AiProviderPricing;
  readonly slo?: AiProviderSlo;
  readonly cache: AiProviderCachePolicy;
  readonly privacy: AiProviderPrivacyPolicy;
  readonly mcpServices?: readonly AiMcpServiceBinding[];
  readonly tags?: readonly string[];
  readonly metadata?: AiProviderMetadata;
}

export interface AiProviderUsage {
  readonly requests?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly audioInputSeconds?: number;
  readonly audioOutputSeconds?: number;
  readonly characters?: number;
}

export interface AiProviderRequest {
  readonly requestId: string;
  readonly kind: AiProviderRequestKind;
  readonly input: unknown;
  readonly dataClass: AiDataClass;
  readonly modelId?: string;
  readonly deadlineMs?: number;
  readonly estimatedUsage?: AiProviderUsage;
  readonly mcpServices?: readonly AiMcpServiceBinding[];
  readonly metadata?: AiProviderMetadata;
}

export interface AiProviderDiagnostic {
  readonly severity: "warning" | "error";
  readonly code:
    | "provider-config-missing"
    | "provider-config-mismatch"
    | "provider-disabled"
    | "provider-config-error"
    | "capability-unsupported"
    | "model-unsupported"
    | "data-class-blocked"
    | "adapter-unavailable"
    | "adapter-failure";
  readonly message: string;
  readonly metadata?: AiProviderMetadata;
}

export interface AiProviderReadiness {
  readonly providerId: string;
  readonly enabled: boolean;
  readonly supported: boolean;
  readonly selectedModelId?: string;
  readonly estimatedCostUsd?: number;
  readonly diagnostics: readonly AiProviderDiagnostic[];
}

export interface AiProviderResponse {
  readonly requestId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly kind: AiProviderRequestKind;
  readonly output: unknown;
  readonly confidence?: number;
  readonly cacheHit?: boolean;
  readonly usage?: AiProviderUsage;
  readonly latencyMs?: number;
  readonly costUsd?: number;
  readonly diagnostics: readonly AiProviderDiagnostic[];
  readonly metadata?: AiProviderMetadata;
}

export interface AiProviderAdapter {
  readonly descriptor: AiProviderDescriptor;
  canHandle(
    request: AiProviderRequest,
    config: AiResolvedProviderConfig | undefined
  ): AiProviderReadiness;
  invoke(
    request: AiProviderRequest,
    config: AiResolvedProviderConfig
  ): Promise<AiProviderResponse>;
}

export interface AiProviderCandidate {
  readonly adapter: AiProviderAdapter;
  readonly descriptor: AiProviderDescriptor;
  readonly config: AiResolvedProviderConfig;
  readonly readiness: AiProviderReadiness;
  readonly estimatedCostUsd?: number;
}

export interface AiProviderRegistry {
  register(adapter: AiProviderAdapter): AiProviderRegistry;
  get(providerId: string): AiProviderAdapter | undefined;
  list(): readonly AiProviderAdapter[];
  listDescriptors(): readonly AiProviderDescriptor[];
  findCapable(
    request: AiProviderRequest,
    configs: AiProviderConfigLookup
  ): readonly AiProviderCandidate[];
  selectFirstCapable(
    request: AiProviderRequest,
    configs: AiProviderConfigLookup
  ): AiProviderCandidate | undefined;
}

export type FakeAiProviderFailureMode = "none" | "unavailable" | "throw";

export interface FakeAiProviderAdapterOptions {
  readonly descriptor?: AiProviderDescriptor;
  readonly failureMode?: FakeAiProviderFailureMode;
  readonly failureMessage?: string;
  readonly responseFactory?: (request: AiProviderRequest) => unknown;
  readonly usage?: AiProviderUsage;
  readonly latencyMs?: number;
  readonly confidence?: number;
  readonly metadata?: AiProviderMetadata;
}

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/u;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;
const DEFAULT_FAKE_CAPABILITIES: readonly AiProviderCapability[] = Object.freeze([
  "chat",
  "reasoning",
  "embedding",
  "moderation",
  "stt",
  "tts",
  "mcp",
  "rag",
]);

export class AiProviderInvocationError extends Error {
  readonly providerId: string;
  readonly requestId: string;
  readonly diagnostics: readonly AiProviderDiagnostic[];

  constructor(
    message: string,
    options: {
      readonly providerId: string;
      readonly requestId: string;
      readonly diagnostics: readonly AiProviderDiagnostic[];
    }
  ) {
    super(message);
    this.name = "AiProviderInvocationError";
    this.providerId = options.providerId;
    this.requestId = options.requestId;
    this.diagnostics = freezeArray(options.diagnostics);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function defineAiProviderDescriptor(
  descriptor: AiProviderDescriptor
): AiProviderDescriptor {
  validateProviderDescriptor(descriptor);

  return Object.freeze({
    ...descriptor,
    capabilities: freezeArray(descriptor.capabilities),
    models: freezeArray(descriptor.models.map(normalizeModelDescriptor)),
    pricing: normalizePricing(descriptor.pricing),
    slo: normalizeSlo(descriptor.slo),
    cache: normalizeCachePolicy(descriptor.cache),
    privacy: normalizePrivacyPolicy(descriptor.privacy),
    mcpServices: normalizeMcpServices(descriptor.mcpServices),
    tags: descriptor.tags ? freezeArray(descriptor.tags) : undefined,
    metadata: freezeMetadata(descriptor.metadata),
  });
}

export function createAiProviderRegistry(
  initialAdapters: readonly AiProviderAdapter[] = []
): AiProviderRegistry {
  const adapters = new Map<string, AiProviderAdapter>();

  const registry: AiProviderRegistry = {
    register(adapter: AiProviderAdapter): AiProviderRegistry {
      const providerId = adapter.descriptor.providerId;
      defineAiProviderDescriptor(adapter.descriptor);

      if (adapters.has(providerId)) {
        throw new Error(`Provider "${providerId}" is already registered.`);
      }

      adapters.set(providerId, adapter);
      return registry;
    },
    get(providerId: string): AiProviderAdapter | undefined {
      return adapters.get(providerId);
    },
    list(): readonly AiProviderAdapter[] {
      return freezeArray([...adapters.values()]);
    },
    listDescriptors(): readonly AiProviderDescriptor[] {
      return freezeArray([...adapters.values()].map((adapter) => adapter.descriptor));
    },
    findCapable(
      request: AiProviderRequest,
      configs: AiProviderConfigLookup
    ): readonly AiProviderCandidate[] {
      const candidates: AiProviderCandidate[] = [];

      for (const adapter of adapters.values()) {
        const config = getProviderConfig(configs, adapter.descriptor.providerId);
        const readiness = adapter.canHandle(request, config);

        if (!config || !readiness.supported) {
          continue;
        }

        const estimatedCostUsd =
          readiness.estimatedCostUsd ??
          estimateAiProviderCostUsd(
            adapter.descriptor,
            readiness.selectedModelId,
            request.estimatedUsage
          );

        candidates.push(
          Object.freeze({
            adapter,
            descriptor: adapter.descriptor,
            config,
            readiness,
            estimatedCostUsd,
          })
        );
      }

      return freezeArray(candidates.sort(compareCandidates));
    },
    selectFirstCapable(
      request: AiProviderRequest,
      configs: AiProviderConfigLookup
    ): AiProviderCandidate | undefined {
      return registry.findCapable(request, configs)[0];
    },
  };

  for (const adapter of initialAdapters) {
    registry.register(adapter);
  }

  return registry;
}

export function assessAiProviderReadiness(
  descriptor: AiProviderDescriptor,
  request: AiProviderRequest,
  config: AiResolvedProviderConfig | undefined
): AiProviderReadiness {
  const diagnostics: AiProviderDiagnostic[] = [];

  if (!config) {
    diagnostics.push(
      createDiagnostic(
        "provider-config-missing",
        `No resolved provider config was supplied for "${descriptor.providerId}".`
      )
    );
  } else {
    if (config.providerId !== descriptor.providerId) {
      diagnostics.push(
        createDiagnostic(
          "provider-config-mismatch",
          `Resolved config "${config.providerId}" does not match provider "${descriptor.providerId}".`,
          { configProviderId: config.providerId }
        )
      );
    }

    if (config.providerKind !== descriptor.providerKind) {
      diagnostics.push(
        createDiagnostic(
          "provider-config-mismatch",
          `Resolved config kind "${config.providerKind}" does not match provider kind "${descriptor.providerKind}".`,
          { configProviderKind: config.providerKind }
        )
      );
    }

    if (!config.enabled) {
      diagnostics.push(
        createDiagnostic(
          "provider-disabled",
          `Provider "${descriptor.providerId}" is disabled.`
        )
      );
    }

    for (const configDiagnostic of config.diagnostics) {
      diagnostics.push(
        createDiagnostic(
          "provider-config-error",
          configDiagnostic.message,
          {
            sourceCode: configDiagnostic.code,
            envVar: configDiagnostic.envVar,
          },
          configDiagnostic.severity
        )
      );
    }

    if (!config.capabilities.includes(request.kind)) {
      diagnostics.push(
        createDiagnostic(
          "capability-unsupported",
          `Resolved config for "${descriptor.providerId}" does not enable "${request.kind}".`
        )
      );
    }

    if (!isAiDataClassAllowed(request.dataClass, config.dataPolicy.allowedDataClasses)) {
      diagnostics.push(
        createDiagnostic(
          "data-class-blocked",
          `Resolved config for "${descriptor.providerId}" does not allow "${request.dataClass}" data.`
        )
      );
    }
  }

  if (!descriptor.capabilities.includes(request.kind)) {
    diagnostics.push(
      createDiagnostic(
        "capability-unsupported",
        `Provider "${descriptor.providerId}" does not support "${request.kind}".`
      )
    );
  }

  if (!isAiDataClassAllowed(request.dataClass, descriptor.privacy.allowedDataClasses)) {
    diagnostics.push(
      createDiagnostic(
        "data-class-blocked",
        `Provider "${descriptor.providerId}" does not allow "${request.dataClass}" data.`
      )
    );
  }

  const requestedModel = request.modelId
    ? findAiProviderModel(descriptor, request.modelId)
    : undefined;
  const selectedModel =
    requestedModel ?? selectAiProviderModel(descriptor, request);

  if (request.modelId && !requestedModel) {
    diagnostics.push(
      createDiagnostic(
        "model-unsupported",
        `Provider "${descriptor.providerId}" does not expose model "${request.modelId}".`
      )
    );
  }

  if (requestedModel && !requestedModel.capabilities.includes(request.kind)) {
    diagnostics.push(
      createDiagnostic(
        "capability-unsupported",
        `Model "${requestedModel.modelId}" does not support "${request.kind}".`
      )
    );
  }

  if (
    requestedModel?.supportedDataClasses &&
    !isAiDataClassAllowed(request.dataClass, requestedModel.supportedDataClasses)
  ) {
    diagnostics.push(
      createDiagnostic(
        "data-class-blocked",
        `Model "${requestedModel.modelId}" does not allow "${request.dataClass}" data.`
      )
    );
  }

  if (!selectedModel && !request.modelId) {
    diagnostics.push(
      createDiagnostic(
        "model-unsupported",
        `Provider "${descriptor.providerId}" has no model for "${request.kind}" and "${request.dataClass}".`
      )
    );
  }

  const estimatedCostUsd = estimateAiProviderCostUsd(
    descriptor,
    selectedModel?.modelId,
    request.estimatedUsage
  );
  const readiness = {
    providerId: descriptor.providerId,
    enabled: config?.enabled ?? false,
    supported: !hasBlockingDiagnostic(diagnostics),
    selectedModelId: selectedModel?.modelId,
    estimatedCostUsd,
    diagnostics: freezeArray(diagnostics),
  };

  return Object.freeze(readiness);
}

export function createFakeAiProviderAdapter(
  options: FakeAiProviderAdapterOptions = {}
): AiProviderAdapter {
  const descriptor = defineAiProviderDescriptor(
    options.descriptor ?? createDefaultFakeDescriptor()
  );
  const failureMode = options.failureMode ?? "none";
  const canHandle = (
    request: AiProviderRequest,
    config: AiResolvedProviderConfig | undefined
  ): AiProviderReadiness => {
    const readiness = assessAiProviderReadiness(descriptor, request, config);

    if (failureMode !== "unavailable") {
      return readiness;
    }

    return withReadinessDiagnostic(
      readiness,
      createDiagnostic(
        "adapter-unavailable",
        options.failureMessage ??
          `Fake provider "${descriptor.providerId}" is unavailable.`
      )
    );
  };

  return Object.freeze({
    descriptor,
    canHandle,
    async invoke(
      request: AiProviderRequest,
      config: AiResolvedProviderConfig
    ): Promise<AiProviderResponse> {
      const readiness = canHandle(request, config);

      if (!readiness.supported) {
        throw new AiProviderInvocationError(
          `Provider "${descriptor.providerId}" cannot handle request "${request.requestId}".`,
          {
            providerId: descriptor.providerId,
            requestId: request.requestId,
            diagnostics: readiness.diagnostics,
          }
        );
      }

      if (failureMode === "throw") {
        const diagnostic = createDiagnostic(
          "adapter-failure",
          options.failureMessage ??
            `Fake provider "${descriptor.providerId}" failed during invocation.`
        );
        throw new AiProviderInvocationError(diagnostic.message, {
          providerId: descriptor.providerId,
          requestId: request.requestId,
          diagnostics: [diagnostic],
        });
      }

      const usage = freezeUsage(options.usage ?? createDefaultUsage(request));
      const costUsd = estimateAiProviderCostUsd(
        descriptor,
        readiness.selectedModelId,
        usage
      );

      return Object.freeze({
        requestId: request.requestId,
        providerId: descriptor.providerId,
        modelId: readiness.selectedModelId ?? descriptor.models[0]?.modelId ?? "fake-model",
        kind: request.kind,
        output: options.responseFactory
          ? options.responseFactory(request)
          : createDefaultFakeOutput(request),
        confidence: options.confidence ?? 0.99,
        cacheHit: false,
        usage,
        latencyMs: options.latencyMs ?? descriptor.slo?.p50LatencyMs ?? 25,
        costUsd,
        diagnostics: freezeArray([]),
        metadata: freezeMetadata(options.metadata),
      });
    },
  });
}

export function findAiProviderModel(
  descriptor: AiProviderDescriptor,
  modelId: string
): AiProviderModelDescriptor | undefined {
  return descriptor.models.find((model) => model.modelId === modelId);
}

export function selectAiProviderModel(
  descriptor: AiProviderDescriptor,
  request: AiProviderRequest
): AiProviderModelDescriptor | undefined {
  if (request.modelId) {
    return findAiProviderModel(descriptor, request.modelId);
  }

  return descriptor.models.find((model) => modelSupportsRequest(model, request));
}

export function isAiDataClassAllowed(
  dataClass: AiDataClass,
  allowedDataClasses: readonly AiDataClass[]
): boolean {
  return allowedDataClasses.includes(dataClass);
}

export function estimateAiProviderCostUsd(
  descriptor: AiProviderDescriptor,
  modelId: string | undefined,
  usage: AiProviderUsage | undefined
): number | undefined {
  if (!usage) {
    return undefined;
  }

  const model = modelId ? findAiProviderModel(descriptor, modelId) : undefined;
  const pricing = model?.pricing ?? descriptor.pricing;
  if (!pricing) {
    return undefined;
  }

  const cost =
    priceForUnit(usage.requests, pricing.requestUsd) +
    priceForMillion(usage.inputTokens, pricing.inputTokenUsdPerMillion) +
    priceForMillion(usage.outputTokens, pricing.outputTokenUsdPerMillion) +
    priceForMinute(usage.audioInputSeconds, pricing.audioInputUsdPerMinute) +
    priceForMinute(usage.audioOutputSeconds, pricing.audioOutputUsdPerMinute) +
    priceForMillion(usage.characters, pricing.characterUsdPerMillion);

  return roundUsd(cost);
}

function validateProviderDescriptor(descriptor: AiProviderDescriptor): void {
  if (!PROVIDER_ID_PATTERN.test(descriptor.providerId)) {
    throw new Error("Provider id must be lowercase kebab-case and between 2 and 63 characters.");
  }

  if (descriptor.capabilities.length === 0) {
    throw new Error(`Provider "${descriptor.providerId}" must declare at least one capability.`);
  }

  if (descriptor.privacy.allowedDataClasses.length === 0) {
    throw new Error(`Provider "${descriptor.providerId}" must declare allowed data classes.`);
  }

  if (descriptor.models.length === 0) {
    throw new Error(`Provider "${descriptor.providerId}" must expose at least one model.`);
  }

  const seenModels = new Set<string>();
  for (const model of descriptor.models) {
    if (!MODEL_ID_PATTERN.test(model.modelId)) {
      throw new Error(`Model id "${model.modelId}" must be lowercase and URL-safe.`);
    }

    if (seenModels.has(model.modelId)) {
      throw new Error(`Provider "${descriptor.providerId}" exposes duplicate model "${model.modelId}".`);
    }

    seenModels.add(model.modelId);

    if (model.capabilities.length === 0) {
      throw new Error(`Model "${model.modelId}" must declare at least one capability.`);
    }

    for (const capability of model.capabilities) {
      if (!descriptor.capabilities.includes(capability)) {
        throw new Error(
          `Model "${model.modelId}" declares capability "${capability}" outside the provider descriptor.`
        );
      }
    }
  }
}

function createDefaultFakeDescriptor(): AiProviderDescriptor {
  return {
    providerId: "fake-dev",
    providerKind: "custom",
    displayName: "Fake development provider",
    tier: "development",
    capabilities: DEFAULT_FAKE_CAPABILITIES,
    priority: 100,
    pricing: {
      requestUsd: 0,
      inputTokenUsdPerMillion: 0,
      outputTokenUsdPerMillion: 0,
      characterUsdPerMillion: 0,
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
    models: [
      {
        modelId: "fake-fast",
        displayName: "Fake fast model",
        capabilities: DEFAULT_FAKE_CAPABILITIES,
        tier: "development",
        contextWindowTokens: 8_192,
        outputTokenLimit: 2_048,
        supportedDataClasses: ["public", "internal"],
      },
    ],
    tags: ["fake", "test"],
  };
}

function createDefaultUsage(request: AiProviderRequest): AiProviderUsage {
  if (request.estimatedUsage) {
    return request.estimatedUsage;
  }

  if (typeof request.input === "string") {
    return {
      requests: 1,
      inputTokens: Math.max(1, Math.ceil(request.input.length / 4)),
      outputTokens: 8,
      characters: request.input.length,
    };
  }

  return {
    requests: 1,
    inputTokens: 1,
    outputTokens: 1,
  };
}

function createDefaultFakeOutput(request: AiProviderRequest): unknown {
  if (typeof request.input === "string") {
    return `fake:${request.kind}:${request.input}`;
  }

  return Object.freeze({
    kind: request.kind,
    requestId: request.requestId,
  });
}

function modelSupportsRequest(
  model: AiProviderModelDescriptor,
  request: AiProviderRequest
): boolean {
  return (
    model.capabilities.includes(request.kind) &&
    (!model.supportedDataClasses ||
      isAiDataClassAllowed(request.dataClass, model.supportedDataClasses))
  );
}

function getProviderConfig(
  configs: AiProviderConfigLookup,
  providerId: string
): AiResolvedProviderConfig | undefined {
  const maybeMap = configs as { readonly get?: unknown };
  if (typeof maybeMap.get === "function") {
    return (configs as ReadonlyMap<string, AiResolvedProviderConfig>).get(providerId);
  }

  return (configs as Readonly<Record<string, AiResolvedProviderConfig | undefined>>)[providerId];
}

function compareCandidates(
  left: AiProviderCandidate,
  right: AiProviderCandidate
): number {
  const leftCost = left.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
  const rightCost = right.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
  if (leftCost !== rightCost) {
    return leftCost < rightCost ? -1 : 1;
  }

  const leftPriority = left.descriptor.priority ?? Number.MAX_SAFE_INTEGER;
  const rightPriority = right.descriptor.priority ?? Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.descriptor.providerId.localeCompare(right.descriptor.providerId);
}

function createDiagnostic(
  code: AiProviderDiagnostic["code"],
  message: string,
  metadata?: AiProviderMetadata,
  severity: AiProviderDiagnostic["severity"] = "error"
): AiProviderDiagnostic {
  return Object.freeze({
    severity,
    code,
    message,
    metadata: freezeMetadata(metadata),
  });
}

function withReadinessDiagnostic(
  readiness: AiProviderReadiness,
  diagnostic: AiProviderDiagnostic
): AiProviderReadiness {
  const diagnostics = freezeArray([...readiness.diagnostics, diagnostic]);

  return Object.freeze({
    ...readiness,
    supported: !hasBlockingDiagnostic(diagnostics),
    diagnostics,
  });
}

function hasBlockingDiagnostic(
  diagnostics: readonly AiProviderDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function priceForUnit(
  units: number | undefined,
  unitPrice: number | undefined
): number {
  return units && unitPrice ? units * unitPrice : 0;
}

function priceForMillion(
  units: number | undefined,
  pricePerMillion: number | undefined
): number {
  return units && pricePerMillion ? (units / 1_000_000) * pricePerMillion : 0;
}

function priceForMinute(
  seconds: number | undefined,
  pricePerMinute: number | undefined
): number {
  return seconds && pricePerMinute ? (seconds / 60) * pricePerMinute : 0;
}

function roundUsd(cost: number): number {
  return Math.round(cost * 1_000_000_000) / 1_000_000_000;
}

function normalizeModelDescriptor(
  model: AiProviderModelDescriptor
): AiProviderModelDescriptor {
  return Object.freeze({
    ...model,
    capabilities: freezeArray(model.capabilities),
    supportedDataClasses: model.supportedDataClasses
      ? freezeArray(model.supportedDataClasses)
      : undefined,
    pricing: normalizePricing(model.pricing),
    slo: normalizeSlo(model.slo),
    cache: model.cache ? normalizeCachePolicy(model.cache) : undefined,
    privacy: model.privacy ? normalizePrivacyPolicy(model.privacy) : undefined,
    metadata: freezeMetadata(model.metadata),
  });
}

function normalizePricing(pricing: AiProviderPricing | undefined): AiProviderPricing | undefined {
  return pricing ? Object.freeze({ ...pricing }) : undefined;
}

function normalizeSlo(slo: AiProviderSlo | undefined): AiProviderSlo | undefined {
  return slo ? Object.freeze({ ...slo }) : undefined;
}

function normalizeCachePolicy(policy: AiProviderCachePolicy): AiProviderCachePolicy {
  return Object.freeze({
    ...policy,
    keyDimensions: policy.keyDimensions ? freezeArray(policy.keyDimensions) : undefined,
  });
}

function normalizePrivacyPolicy(policy: AiProviderPrivacyPolicy): AiProviderPrivacyPolicy {
  return Object.freeze({
    ...policy,
    allowedDataClasses: freezeArray(policy.allowedDataClasses),
  });
}

function normalizeMcpServices(
  services: readonly AiMcpServiceBinding[] | undefined
): readonly AiMcpServiceBinding[] | undefined {
  if (!services) {
    return undefined;
  }

  return freezeArray(
    services.map((service) =>
      Object.freeze({
        ...service,
        metadata: freezeMetadata(service.metadata),
      })
    )
  );
}

function freezeUsage(usage: AiProviderUsage): AiProviderUsage {
  return Object.freeze({ ...usage });
}

function freezeMetadata(metadata: AiProviderMetadata | undefined): AiProviderMetadata | undefined {
  return metadata ? Object.freeze({ ...metadata }) : undefined;
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}
