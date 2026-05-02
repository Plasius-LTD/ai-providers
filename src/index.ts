export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_PROVIDERS_PACKAGE = "@plasius/ai-providers";
export const AI_PROVIDERS_FEATURE_FLAG_ID = "ai.providers.enabled";
export const AI_PROVIDERS_ENV_PREFIX = "AI_PROVIDERS";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_PROVIDERS_PACKAGE,
  featureFlagId: AI_PROVIDERS_FEATURE_FLAG_ID,
  envPrefix: AI_PROVIDERS_ENV_PREFIX,
  summary: "Provider adapter contracts and implementations for the Plasius agentic AI package family.",
});
