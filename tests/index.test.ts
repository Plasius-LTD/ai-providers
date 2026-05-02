import { describe, expect, it } from "vitest";

import {
  AI_PROVIDERS_ENV_PREFIX,
  AI_PROVIDERS_FEATURE_FLAG_ID,
  AI_PROVIDERS_PACKAGE,
  packageDescriptor,
} from "../src/index.js";

describe("@plasius/ai-providers", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_PROVIDERS_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_PROVIDERS_FEATURE_FLAG_ID);
    expect(packageDescriptor.envPrefix).toBe(AI_PROVIDERS_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });
});
