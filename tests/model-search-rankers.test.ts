import { describe, expect, it, vi } from "vitest";
import { createModelRequestSpec } from "@plasius/asset-contracts";

import {
  MODEL_SEARCH_RANKER_FAKE_MODES,
  MODEL_SEARCH_RANKER_FEATURE_FLAG_ID,
  MODEL_SEARCH_RANKER_MAX_CANDIDATES,
  MODEL_SEARCH_RANKER_MAX_EXECUTION_MS,
  MODEL_SEARCH_RANKER_MAX_REGISTRATIONS,
  createFakeModelSearchRankerAdapter,
  createModelSearchRankerInvocation,
  createModelSearchRankerOutput,
  createModelSearchRankerRegistry,
  defineModelSearchRankerDescriptor,
  invokeModelSearchRanker,
  toModelRankerRef,
  type ModelSearchRankerAdapter,
  type ModelSearchRankerDescriptor,
} from "../src/index.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("model-search ranker contracts", () => {
  it("defines safe immutable descriptors and canonical asset-contract ranker evidence", () => {
    const descriptor = defineModelSearchRankerDescriptor(baseDescriptor());

    expect(MODEL_SEARCH_RANKER_FEATURE_FLAG_ID).toBe(
      "asset.pipeline.unified-ai-assets.enabled"
    );
    expect(MODEL_SEARCH_RANKER_MAX_CANDIDATES).toBe(20);
    expect(MODEL_SEARCH_RANKER_MAX_REGISTRATIONS).toBe(64);
    expect(MODEL_SEARCH_RANKER_MAX_EXECUTION_MS).toBe(30_000);
    expect(MODEL_SEARCH_RANKER_FAKE_MODES).toEqual([
      "ready",
      "unavailable",
      "throwing",
      "cancelled",
      "malformed-output",
    ]);
    expect(descriptor).toEqual(baseDescriptor());
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(toModelRankerRef(descriptor)).toEqual({
      id: "catalog-multimodal-v1",
      version: "1.2.0",
      calibrationId: "catalog-model-search-2026-07",
      calibrationVersion: "3.0.0",
      evidenceMode: "multimodal",
      assuranceCeiling: "high",
    });
    expect(Object.isFrozen(toModelRankerRef(descriptor))).toBe(true);
    expect(JSON.stringify(descriptor)).not.toMatch(/endpoint|credential|secret/i);
  });

  it("fails closed on unsafe, malformed, or over-claiming descriptors", () => {
    expect(() =>
      defineModelSearchRankerDescriptor({
        ...baseDescriptor(),
        evidenceMode: "text-only",
        assuranceCeiling: "high",
      })
    ).toThrow(/text-only.*high|assurance ceiling/i);
    expect(() =>
      defineModelSearchRankerDescriptor({
        ...baseDescriptor(),
        displayName: "https://private.example/ranker",
      })
    ).toThrow(/displayName|URL/i);
    expect(() =>
      defineModelSearchRankerDescriptor({
        ...baseDescriptor(),
        summary: "credential=provider-secret",
      })
    ).toThrow(/summary|sensitive|credential/i);
    expect(() =>
      defineModelSearchRankerDescriptor({
        ...baseDescriptor(),
        rankerId: "NOT SAFE",
      })
    ).toThrow(/rankerId/i);
    expect(() =>
      defineModelSearchRankerDescriptor({
        ...baseDescriptor(),
        evidenceMode: "audio",
      })
    ).toThrow(/evidenceMode/i);
    expect(() =>
      defineModelSearchRankerDescriptor({
        ...baseDescriptor(),
        endpoint: "internal",
      })
    ).toThrow(/unexpected.*endpoint/i);
    expect(() =>
      defineModelSearchRankerDescriptor(
        new (class Descriptor {
          rankerId = "class-ranker";
        })()
      )
    ).toThrow(/plain object/i);
  });

  it("normalizes bounded correlated invocations and deeply freezes evidence", () => {
    const invocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-001",
      request: request("catalog-multimodal-v1"),
      candidates: [
        candidate("chair-a", HASH_A),
        {
          ...candidate("chair-b", HASH_B),
          previewResources: [
            {
              ...candidate("chair-b", HASH_B).previewResources[0],
              uri: "mcp://models/resolutions/resolution-1/candidates/chair-b/front.png",
            },
          ],
        },
      ],
      deadlineEpochMs: 4_102_444_800_000,
    });

    expect(invocation.candidates).toHaveLength(2);
    expect(invocation.request.rankerId).toBe("catalog-multimodal-v1");
    expect(Object.isFrozen(invocation)).toBe(true);
    expect(Object.isFrozen(invocation.request)).toBe(true);
    expect(Object.isFrozen(invocation.candidates)).toBe(true);
    expect(Object.isFrozen(invocation.candidates[0])).toBe(true);
    expect(Object.isFrozen(invocation.candidates[0]?.previewResources)).toBe(true);
    expect(Object.isFrozen(invocation.candidates[0]?.previewResources[0])).toBe(true);
  });

  it("does not freeze or mutate caller-owned invocation and output inputs", () => {
    const candidateInput = candidate("chair-a", HASH_A);
    const requestInput = {
      query: "a weathered oak reading chair",
      revision: 0,
      rankerId: "catalog-multimodal-v1",
      hardConstraints: {},
      softPreferences: {},
      exclusions: [],
    };
    const invocationInput = {
      invocationId: "rank-call-owned-input",
      request: requestInput,
      candidates: [candidateInput],
      deadlineEpochMs: 4_102_444_800_000,
    };
    const invocation = createModelSearchRankerInvocation(invocationInput);
    const rawOutput = {
      invocationId: invocation.invocationId,
      rankerId: "catalog-multimodal-v1",
      scores: [{ candidateId: "chair-a", score: 0.8 }],
    };
    const output = createModelSearchRankerOutput(
      rawOutput,
      invocation,
      "catalog-multimodal-v1"
    );

    expect(Object.isFrozen(invocationInput)).toBe(false);
    expect(Object.isFrozen(requestInput)).toBe(false);
    expect(Object.isFrozen(candidateInput)).toBe(false);
    expect(Object.isFrozen(rawOutput)).toBe(false);
    candidateInput.searchableText = "caller mutation";
    rawOutput.scores[0]!.score = 0.1;
    expect(invocation.candidates[0]?.searchableText).not.toBe("caller mutation");
    expect(output.scores[0]?.score).toBe(0.8);
  });

  it("rejects oversized, duplicate, unsafe, or structurally invalid invocations", () => {
    const valid = {
      invocationId: "rank-call-002",
      request: request(),
      candidates: [candidate("chair-a", HASH_A)],
      deadlineEpochMs: 4_102_444_800_000,
    };

    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: Array.from({ length: 21 }, (_, index) =>
          candidate(`chair-${index}`, hashFor(index))
        ),
      })
    ).toThrow(/one to 20|candidate/i);
    expect(() =>
      createModelSearchRankerInvocation({ ...valid, candidates: [] })
    ).toThrow(/one to 20|candidate/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [candidate("chair-a", HASH_A), candidate("chair-a", HASH_B)],
      })
    ).toThrow(/unique.*candidateId|duplicate/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [candidate("chair-a", "bad-hash")],
      })
    ).toThrow(/sha256|contentHash/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [
          {
            ...candidate("chair-a", HASH_A),
            previewResources: [
              {
                ...candidate("chair-a", HASH_A).previewResources[0],
                uri: "https://private.example/signed.png?token=secret",
              },
            ],
          },
        ],
      })
    ).toThrow(/mcp:\/\/models/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        deadlineEpochMs: Number.NaN,
      })
    ).toThrow(/deadlineEpochMs/i);
    for (const deadlineEpochMs of [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      0,
    ]) {
      expect(() =>
        createModelSearchRankerInvocation({ ...valid, deadlineEpochMs })
      ).toThrow(/deadlineEpochMs/i);
    }
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: new Array(1),
      })
    ).toThrow(/candidate.*dense|candidate.*element|sparse/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [
          {
            ...candidate("chair-a", HASH_A),
            previewResources: new Array(1),
          },
        ],
      })
    ).toThrow(/previewResources.*dense|previewResources.*element|sparse/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [
          {
            ...candidate("chair-a", HASH_A),
            previewResources: [
              {
                ...candidate("chair-a", HASH_A).previewResources[0],
                contentType: "image/svg+xml",
              },
            ],
          },
        ],
      })
    ).toThrow(/image\/png|content type/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [
          {
            ...candidate("chair-a", HASH_A),
            previewResources: [
              {
                ...candidate("chair-a", HASH_A).previewResources[0],
                uri: "mcp://models/catalog/chair-b/versions/v1/previews/isometric.png",
              },
            ],
          },
        ],
      })
    ).toThrow(/candidateId|scoped|candidate.*resource/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [
          {
            ...candidate("chair-a", HASH_A),
            previewResources: [
              {
                ...candidate("chair-a", HASH_A).previewResources[0],
                uri: "mcp://models/catalog/chair-a/previews/isometric.png",
              },
            ],
          },
        ],
      })
    ).toThrow(/version|immutable|scoped/i);
    expect(() =>
      createModelSearchRankerInvocation({
        ...valid,
        candidates: [
          {
            ...candidate("Chair-A", HASH_A),
            previewResources: [
              {
                ...candidate("Chair-A", HASH_A).previewResources[0],
                uri: "mcp://models/catalog/Chair-A/versions/v1/previews/isometric.png",
              },
            ],
          },
        ],
      })
    ).toThrow(/asset id|lowercase|kebab/i);
    expect(() =>
      createModelSearchRankerInvocation({ ...valid, extra: true })
    ).toThrow(/unexpected.*extra/i);
  });

  it("validates untrusted ranker output against the exact invocation and ranker", () => {
    const invocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-003",
      request: request("catalog-multimodal-v1"),
      candidates: [candidate("chair-a", HASH_A), candidate("chair-b", HASH_B)],
      deadlineEpochMs: 4_102_444_800_000,
    });
    const output = createModelSearchRankerOutput(
      {
        invocationId: "rank-call-003",
        rankerId: "catalog-multimodal-v1",
        scores: [
          { candidateId: "chair-b", score: 0.91 },
          { candidateId: "chair-a", score: 0.75 },
        ],
      },
      invocation,
      "catalog-multimodal-v1"
    );

    expect(output.scores).toEqual([
      { candidateId: "chair-b", score: 0.91 },
      { candidateId: "chair-a", score: 0.75 },
    ]);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.scores)).toBe(true);
    expect(Object.isFrozen(output.scores[0])).toBe(true);
    expect(
      createModelSearchRankerOutput(
        {
          invocationId: "rank-call-003",
          rankerId: "catalog-multimodal-v1",
          scores: [],
        },
        invocation,
        "catalog-multimodal-v1"
      ).scores
    ).toEqual([]);

    for (const malformed of [
      { ...output, invocationId: "wrong-call" },
      { ...output, rankerId: "other-ranker" },
      { ...output, scores: [{ candidateId: "foreign", score: 0.8 }] },
      {
        ...output,
        scores: [
          { candidateId: "chair-a", score: 0.8 },
          { candidateId: "chair-a", score: 0.7 },
        ],
      },
      { ...output, scores: [{ candidateId: "chair-a", score: Number.NaN }] },
      { ...output, scores: [{ candidateId: "chair-a", score: Number.POSITIVE_INFINITY }] },
      { ...output, scores: [{ candidateId: "chair-a", score: -0.01 }] },
      { ...output, scores: [{ candidateId: "chair-a", score: 1.01 }] },
    ]) {
      expect(() =>
        createModelSearchRankerOutput(
          malformed,
          invocation,
          "catalog-multimodal-v1"
        )
      ).toThrow();
    }
    expect(() =>
      createModelSearchRankerOutput(
        { ...output, extra: true },
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/unexpected.*extra/i);
    expect(() =>
      createModelSearchRankerOutput(
        {
          ...output,
          scores: [{ candidateId: "chair-a", score: 0.8, explanation: "trust me" }],
        },
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/unexpected.*explanation/i);
    const hiddenFieldScore = { candidateId: "chair-a", score: 0.8 };
    Object.defineProperty(hiddenFieldScore, "hidden", {
      value: "untrusted",
      enumerable: false,
    });
    expect(() =>
      createModelSearchRankerOutput(
        { ...output, scores: [hiddenFieldScore] },
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/unexpected.*hidden|non-element|data propert/i);
    expect(() =>
      createModelSearchRankerOutput(
        {
          invocationId: output.invocationId,
          rankerId: output.rankerId,
          get scores() {
            return [{ candidateId: "chair-a", score: 0.8 }];
          },
        },
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/scores.*data propert|accessor/i);
    expect(() =>
      createModelSearchRankerOutput(
        { ...output, scores: new Array(1) },
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/scores.*dense|scores.*element|sparse/i);
    const overriddenMapScores = [
      { candidateId: "chair-a", score: Number.NaN },
    ];
    Object.setPrototypeOf(
      overriddenMapScores,
      Object.assign(Object.create(Array.prototype) as object, {
        map: () => [],
      })
    );
    expect(() =>
      createModelSearchRankerOutput(
        { ...output, scores: overriddenMapScores },
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/finite number|score/i);
    expect(() =>
      createModelSearchRankerOutput(
        {
          invocationId: invocation.invocationId,
          rankerId: "catalog-vision-v1",
          scores: [{ candidateId: "chair-a", score: 0.8 }],
        },
        invocation,
        "catalog-vision-v1"
      )
    ).toThrow(/caller-selected|request.*ranker/i);
  });

  it("uses an immutable explicit allowlist and resolves explicit or default IDs exactly", () => {
    const defaultAdapter = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor(),
    });
    const alternateAdapter = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor({
        rankerId: "catalog-vision-v1",
        displayName: "Catalog vision ranker",
        evidenceMode: "vision",
      }),
    });
    const registry = createModelSearchRankerRegistry({
      allowlistedRankerIds: [
        "catalog-multimodal-v1",
        "catalog-vision-v1",
        "configured-but-missing",
      ],
      defaultRankerId: "catalog-multimodal-v1",
      adapters: [defaultAdapter, alternateAdapter],
    });

    const selectedDefault = registry.resolve();
    const selectedExplicit = registry.resolve("catalog-vision-v1");
    expect(selectedDefault).toMatchObject({
      status: "selected",
      source: "default",
      rankerId: "catalog-multimodal-v1",
      substituted: false,
    });
    expect(selectedExplicit).toMatchObject({
      status: "selected",
      source: "explicit",
      rankerId: "catalog-vision-v1",
      substituted: false,
    });
    expect(registry.resolve("configured-but-missing")).toEqual({
      status: "unavailable",
      source: "explicit",
      rankerId: "configured-but-missing",
      reasonCode: "ranker-not-registered",
      substituted: false,
    });
    expect(registry.resolve("not-approved")).toEqual({
      status: "unavailable",
      source: "explicit",
      rankerId: "not-approved",
      reasonCode: "ranker-not-allowlisted",
      substituted: false,
    });
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.allowlistedRankerIds)).toBe(true);
  });

  it("lists only safe allowlisted readiness projections without adapters or private metadata", () => {
    const ready = createFakeModelSearchRankerAdapter({ descriptor: baseDescriptor() });
    const unavailable = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor({
        rankerId: "catalog-vision-v1",
        displayName: "Catalog vision ranker",
        evidenceMode: "vision",
      }),
      mode: "unavailable",
    });
    const registry = createModelSearchRankerRegistry({
      allowlistedRankerIds: [
        "catalog-multimodal-v1",
        "catalog-vision-v1",
        "configured-but-missing",
      ],
      defaultRankerId: "catalog-multimodal-v1",
      adapters: [ready, unavailable],
    });

    const listing = registry.listReadiness();
    expect(listing).toEqual([
      expect.objectContaining({
        rankerId: "catalog-multimodal-v1",
        isDefault: true,
        status: "ready",
      }),
      expect.objectContaining({
        rankerId: "catalog-vision-v1",
        isDefault: false,
        status: "unavailable",
        reasonCode: "ranker-dependency-unavailable",
      }),
      {
        rankerId: "configured-but-missing",
        isDefault: false,
        status: "unavailable",
        reasonCode: "ranker-not-registered",
      },
    ]);
    expect(Object.isFrozen(listing)).toBe(true);
    expect(Object.isFrozen(listing[0])).toBe(true);
    expect(JSON.stringify(listing)).not.toMatch(/adapter|endpoint|credential|secret/i);
    expect(registry.resolve("catalog-vision-v1")).toMatchObject({
      status: "unavailable",
      rankerId: "catalog-vision-v1",
      reasonCode: "ranker-unavailable",
      readinessReasonCode: "ranker-dependency-unavailable",
    });
  });

  it("fails closed when adapter readiness throws or returns malformed private data", () => {
    const throwingReadiness: ModelSearchRankerAdapter = {
      descriptor: baseDescriptor(),
      readiness() {
        throw new Error("private dependency failure");
      },
      async rank() {
        return {};
      },
    };
    const malformedReadiness: ModelSearchRankerAdapter = {
      descriptor: baseDescriptor({
        rankerId: "catalog-vision-v1",
        displayName: "Catalog vision ranker",
        evidenceMode: "vision",
      }),
      readiness() {
        return {
          status: "ready",
          rankerId: "catalog-vision-v1",
          endpoint: "https://private.example",
        } as never;
      },
      async rank() {
        return {};
      },
    };
    const registry = createModelSearchRankerRegistry({
      allowlistedRankerIds: [
        "catalog-multimodal-v1",
        "catalog-vision-v1",
      ],
      defaultRankerId: "catalog-multimodal-v1",
      adapters: [throwingReadiness, malformedReadiness],
    });

    expect(registry.resolve()).toEqual({
      status: "unavailable",
      source: "default",
      rankerId: "catalog-multimodal-v1",
      reasonCode: "ranker-unavailable",
      substituted: false,
      readinessReasonCode: "ranker-dependency-unavailable",
    });
    expect(registry.listReadiness()).toEqual([
      {
        rankerId: "catalog-multimodal-v1",
        isDefault: true,
        descriptor: baseDescriptor(),
        status: "unavailable",
        reasonCode: "ranker-dependency-unavailable",
      },
      {
        rankerId: "catalog-vision-v1",
        isDefault: false,
        descriptor: baseDescriptor({
          rankerId: "catalog-vision-v1",
          displayName: "Catalog vision ranker",
          evidenceMode: "vision",
        }),
        status: "unavailable",
        reasonCode: "ranker-dependency-unavailable",
      },
    ]);
    expect(JSON.stringify(registry.listReadiness())).not.toMatch(
      /private|endpoint/i
    );
  });

  it("rejects ambiguous or unsafe registry configuration", () => {
    const adapter = createFakeModelSearchRankerAdapter({ descriptor: baseDescriptor() });

    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: [],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: [],
      })
    ).toThrow(/allowlist/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: ["catalog-multimodal-v1", "catalog-multimodal-v1"],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: [adapter],
      })
    ).toThrow(/unique|duplicate/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: Array.from(
          { length: MODEL_SEARCH_RANKER_MAX_REGISTRATIONS + 1 },
          (_unused, index) => `ranker-${index}`
        ),
        defaultRankerId: "ranker-0",
        adapters: [],
      })
    ).toThrow(/allowlist.*(?:at most|between 1 and) 64/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: ["catalog-vision-v1"],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: [],
      })
    ).toThrow(/default.*allowlist/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: ["catalog-multimodal-v1"],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: [adapter, adapter],
      })
    ).toThrow(/duplicate.*adapter/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: ["some-other-ranker"],
        defaultRankerId: "some-other-ranker",
        adapters: [adapter],
      })
    ).toThrow(/adapter.*allowlist/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: new Array(1),
        defaultRankerId: "catalog-multimodal-v1",
        adapters: [],
      })
    ).toThrow(/allowlist.*dense|allowlist.*element|sparse/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: ["catalog-multimodal-v1"],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: new Array(1),
      })
    ).toThrow(/adapters.*dense|adapters.*element|sparse/i);
    expect(() =>
      createModelSearchRankerRegistry({
        allowlistedRankerIds: ["catalog-multimodal-v1"],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: Array.from(
          { length: MODEL_SEARCH_RANKER_MAX_REGISTRATIONS + 1 },
          () => adapter
        ),
      })
    ).toThrow(/adapters.*(?:at most|one to|between 0 and) 64/i);
  });

  it("snapshots adapters without freezing or trusting caller-owned objects", async () => {
    const descriptorInput = baseDescriptor();
    const mutableAdapter = {
      descriptor: descriptorInput,
      readiness: () => ({
        status: "ready" as const,
        rankerId: "catalog-multimodal-v1",
      }),
      rank: async (invocation: ReturnType<typeof createModelSearchRankerInvocation>) => ({
        invocationId: invocation.invocationId,
        rankerId: "catalog-multimodal-v1",
        scores: invocation.candidates.map(({ candidateId }) => ({
          candidateId,
          score: 0.8,
        })),
      }),
    };
    const adapters = [mutableAdapter];
    const allowlistedRankerIds = ["catalog-multimodal-v1"];
    const registry = createModelSearchRankerRegistry({
      allowlistedRankerIds,
      defaultRankerId: "catalog-multimodal-v1",
      adapters,
    });
    const selection = registry.resolve();

    expect(selection.status).toBe("selected");
    if (selection.status !== "selected") {
      throw new Error("Expected selected test ranker.");
    }
    expect(Object.isFrozen(selection.adapter)).toBe(true);
    expect(selection.adapter.descriptor).toBe(selection.descriptor);
    expect(Object.isFrozen(descriptorInput)).toBe(false);
    expect(Object.isFrozen(adapters)).toBe(false);
    expect(Object.isFrozen(allowlistedRankerIds)).toBe(false);

    (descriptorInput as { displayName: string }).displayName =
      "Caller-mutated name";
    mutableAdapter.rank = async () => {
      throw new Error("Caller replaced rank implementation");
    };
    adapters.length = 0;
    allowlistedRankerIds[0] = "caller-mutated-ranker";

    expect(selection.descriptor.displayName).toBe("Catalog multimodal ranker");
    const invocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-snapshot",
      request: request("catalog-multimodal-v1"),
      candidates: [candidate("chair-a", HASH_A)],
      deadlineEpochMs: Date.now() + 2_000,
    });
    await expect(invokeModelSearchRanker(selection, invocation)).resolves.toMatchObject({
      scores: [{ candidateId: "chair-a", score: 0.8 }],
    });
  });

  it("rejects forged adapter substitution before invoking it", async () => {
    const selectedAdapter = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor(),
    });
    const substitutedAdapter = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor({
        rankerId: "catalog-vision-v1",
        displayName: "Catalog vision ranker",
        evidenceMode: "vision",
      }),
    });
    const registry = createModelSearchRankerRegistry({
      allowlistedRankerIds: ["catalog-multimodal-v1"],
      defaultRankerId: "catalog-multimodal-v1",
      adapters: [selectedAdapter],
    });
    const selection = registry.resolve();
    if (selection.status !== "selected") {
      throw new Error("Expected selected test ranker.");
    }
    const invocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-forged-adapter",
      request: request("catalog-multimodal-v1"),
      candidates: [candidate("chair-a", HASH_A)],
      deadlineEpochMs: Date.now() + 2_000,
    });

    await expect(
      invokeModelSearchRanker(
        { ...selection, adapter: substitutedAdapter },
        invocation
      )
    ).rejects.toThrow(/adapter.*descriptor|exact.*ranker/i);
    expect(substitutedAdapter.getInvocations()).toEqual([]);
  });

  it("observes cancellation raised while readiness is rechecked", async () => {
    const cancellation = new AbortController();
    let readinessCalls = 0;
    const adapter: ModelSearchRankerAdapter = {
      descriptor: baseDescriptor(),
      readiness: () => {
        readinessCalls += 1;
        if (readinessCalls === 2) {
          cancellation.abort();
        }
        return {
          status: "ready",
          rankerId: "catalog-multimodal-v1",
        };
      },
      rank: async () => await new Promise<never>(() => undefined),
    };
    const registry = createModelSearchRankerRegistry({
      allowlistedRankerIds: ["catalog-multimodal-v1"],
      defaultRankerId: "catalog-multimodal-v1",
      adapters: [adapter],
    });
    const selection = registry.resolve();
    if (selection.status !== "selected") {
      throw new Error("Expected selected test ranker.");
    }
    const invocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-readiness-cancel",
      request: request("catalog-multimodal-v1"),
      candidates: [candidate("chair-a", HASH_A)],
      deadlineEpochMs: Date.now() + 25,
    });

    await expect(
      invokeModelSearchRanker(selection, invocation, {
        signal: cancellation.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("enforces cancellation and the bounded deadline around non-cooperative adapters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    try {
      const observedSignals: AbortSignal[] = [];
      const hangingAdapter: ModelSearchRankerAdapter = {
        descriptor: baseDescriptor(),
        readiness: () => ({
          status: "ready",
          rankerId: "catalog-multimodal-v1",
        }),
        rank: async (_invocation, options) => {
          if (options?.signal !== undefined) {
            observedSignals.push(options.signal);
          }
          return await new Promise<never>(() => undefined);
        },
      };
      const registry = createModelSearchRankerRegistry({
        allowlistedRankerIds: ["catalog-multimodal-v1"],
        defaultRankerId: "catalog-multimodal-v1",
        adapters: [hangingAdapter],
      });
      const selection = registry.resolve();
      if (selection.status !== "selected") {
        throw new Error("Expected selected test ranker.");
      }
      const invocation = createModelSearchRankerInvocation({
        invocationId: "rank-call-bounded",
        request: request("catalog-multimodal-v1"),
        candidates: [candidate("chair-a", HASH_A)],
        deadlineEpochMs: Date.now() + MODEL_SEARCH_RANKER_MAX_EXECUTION_MS * 2,
      });
      const timed = invokeModelSearchRanker(selection, invocation);
      const timedAssertion = expect(timed).rejects.toMatchObject({
        code: "ranker-deadline-exceeded",
      });

      await vi.advanceTimersByTimeAsync(MODEL_SEARCH_RANKER_MAX_EXECUTION_MS);
      await timedAssertion;
      expect(observedSignals[0]?.aborted).toBe(true);

      const cancellation = new AbortController();
      const cancelled = invokeModelSearchRanker(selection, {
        ...invocation,
        invocationId: "rank-call-cancelled-boundary",
        deadlineEpochMs: Date.now() + 2_000,
      }, { signal: cancellation.signal });
      const cancelledAssertion = expect(cancelled).rejects.toMatchObject({
        name: "AbortError",
      });
      cancellation.abort();
      await cancelledAssertion;
      expect(observedSignals[1]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("provides deterministic ready, unavailable, throwing, cancelled, and malformed fakes", async () => {
    const invocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-fakes",
      request: request("catalog-multimodal-v1"),
      candidates: [candidate("chair-a", HASH_A), candidate("chair-b", HASH_B)],
      deadlineEpochMs: 4_102_444_800_000,
    });
    const ready = createFakeModelSearchRankerAdapter({ descriptor: baseDescriptor() });
    const unavailable = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor(),
      mode: "unavailable",
    });
    const throwing = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor(),
      mode: "throwing",
    });
    const cancelled = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor(),
      mode: "cancelled",
    });
    const malformed = createFakeModelSearchRankerAdapter({
      descriptor: baseDescriptor(),
      mode: "malformed-output",
    });

    const readyOutput = await ready.rank(invocation);
    expect(
      createModelSearchRankerOutput(
        readyOutput,
        invocation,
        "catalog-multimodal-v1"
      ).scores
    ).toEqual([
      { candidateId: "chair-a", score: 1 },
      { candidateId: "chair-b", score: 0.95 },
    ]);
    expect(ready.getInvocations()).toEqual([invocation]);
    expect(Object.isFrozen(ready.getInvocations())).toBe(true);
    expect(unavailable.readiness()).toMatchObject({ status: "unavailable" });
    await expect(unavailable.rank(invocation)).rejects.toMatchObject({
      code: "ranker-unavailable",
    });
    await expect(throwing.rank(invocation)).rejects.toMatchObject({
      code: "ranker-failure",
    });
    await expect(cancelled.rank(invocation)).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(malformed.rank(invocation)).resolves.toBeDefined();
    await expect(malformed.rank(invocation)).resolves.not.toBeNull();
    expect(() =>
      createModelSearchRankerOutput(
        malformed.lastOutput(),
        invocation,
        "catalog-multimodal-v1"
      )
    ).toThrow(/candidate|score|output/i);
  });

  it("makes fake execution deadline and AbortSignal aware", async () => {
    const ready = createFakeModelSearchRankerAdapter({ descriptor: baseDescriptor() });
    const active = new AbortController();
    const futureInvocation = createModelSearchRankerInvocation({
      invocationId: "rank-call-signal",
      request: request("catalog-multimodal-v1"),
      candidates: [candidate("chair-a", HASH_A)],
      deadlineEpochMs: 4_102_444_800_000,
    });

    await expect(ready.rank(futureInvocation, { signal: active.signal })).resolves.toBeDefined();
    active.abort();
    await expect(ready.rank(futureInvocation, { signal: active.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(
      ready.rank(
        createModelSearchRankerInvocation({
          ...futureInvocation,
          invocationId: "rank-call-expired",
          deadlineEpochMs: 1,
        })
      )
    ).rejects.toMatchObject({ code: "ranker-deadline-exceeded" });
    await expect(
      ready.rank(futureInvocation, { signal: {} as AbortSignal })
    ).rejects.toThrow(/AbortSignal/i);
  });
});

function baseDescriptor(
  overrides: Partial<ModelSearchRankerDescriptor> = {}
): ModelSearchRankerDescriptor {
  return {
    rankerId: "catalog-multimodal-v1",
    implementationVersion: "1.2.0",
    calibrationId: "catalog-model-search-2026-07",
    calibrationVersion: "3.0.0",
    displayName: "Catalog multimodal ranker",
    summary: "Ranks safe hosted catalog evidence for model search.",
    evidenceMode: "multimodal",
    assuranceCeiling: "high",
    ...overrides,
  };
}

function request(rankerId?: string) {
  return createModelRequestSpec({
    query: "a weathered oak reading chair",
    revision: 0,
    ...(rankerId === undefined ? {} : { rankerId }),
    hardConstraints: {
      maxTriangles: 80_000,
    },
    softPreferences: {
      materials: ["oak", "linen"],
    },
    exclusions: ["office chair"],
  });
}

function candidate(candidateId: string, contentHash: string) {
  return {
    candidateId,
    contentHash,
    searchableText: `${candidateId} oak chair linen`,
    previewResources: [
      {
        uri: `mcp://models/catalog/${candidateId}/versions/v1/previews/isometric.png`,
        byteLength: 4096,
        sha256: contentHash,
        contentType: "image/png",
      },
    ],
  };
}

function hashFor(index: number): string {
  return index.toString(16).padStart(64, "0");
}

function assertAdapter(_adapter: ModelSearchRankerAdapter): void {
  // Compile-time compatibility helper retained for adapter surface verification.
}

void assertAdapter;
