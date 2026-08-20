import {
  MODEL_MATCH_ASSURANCE_BANDS,
  MODEL_RANKER_EVIDENCE_MODES,
  UNIFIED_ASSET_PIPELINE_FEATURE_FLAG_ID,
  assertAssetId,
  assertImmutableAssetVersion,
  createModelRequestSpec,
  createModelResourceRef,
  type ModelMatchAssurance,
  type ModelRankerEvidenceMode,
  type ModelRankerRef,
  type ModelRequestSpec,
  type ModelResourceRef,
} from "@plasius/asset-contracts";

/** Feature flag that gates use of the unified asset pipeline ranker registry. */
export const MODEL_SEARCH_RANKER_FEATURE_FLAG_ID =
  UNIFIED_ASSET_PIPELINE_FEATURE_FLAG_ID;

/** Maximum candidates accepted by one model-search ranker invocation. */
export const MODEL_SEARCH_RANKER_MAX_CANDIDATES = 20 as const;

/** Maximum allowlisted registrations or adapters accepted by one registry. */
export const MODEL_SEARCH_RANKER_MAX_REGISTRATIONS = 64 as const;

/** Package-enforced upper bound for one ranker execution. */
export const MODEL_SEARCH_RANKER_MAX_EXECUTION_MS = 30_000 as const;

/** Deterministic fake modes available to adapter consumers and tests. */
export const MODEL_SEARCH_RANKER_FAKE_MODES = Object.freeze([
  "ready",
  "unavailable",
  "throwing",
  "cancelled",
  "malformed-output",
] as const);

/** A deterministic behavior exposed by the fake ranker adapter. */
export type ModelSearchRankerFakeMode =
  (typeof MODEL_SEARCH_RANKER_FAKE_MODES)[number];

/** Public, non-secret identity and calibration metadata for a ranker. */
export interface ModelSearchRankerDescriptor {
  readonly rankerId: string;
  readonly implementationVersion: string;
  readonly calibrationId: string;
  readonly calibrationVersion: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly evidenceMode: ModelRankerEvidenceMode;
  readonly assuranceCeiling: ModelMatchAssurance;
}

/** Public-safe candidate evidence passed to a model-search ranker. */
export interface ModelSearchRankerCandidate {
  readonly candidateId: string;
  readonly contentHash: string;
  readonly searchableText: string;
  readonly previewResources: readonly ModelResourceRef[];
}

/** Bounded, deadline-aware model-search ranker invocation. */
export interface ModelSearchRankerInvocation {
  readonly invocationId: string;
  readonly request: ModelRequestSpec;
  readonly candidates: readonly ModelSearchRankerCandidate[];
  readonly deadlineEpochMs: number;
}

/** One normalized score returned for a candidate in the invocation. */
export interface ModelSearchRankerScore {
  readonly candidateId: string;
  readonly score: number;
}

/** Strictly correlated output accepted from a model-search ranker. */
export interface ModelSearchRankerOutput {
  readonly invocationId: string;
  readonly rankerId: string;
  readonly scores: readonly ModelSearchRankerScore[];
}

/** Cancellation options passed across the adapter boundary. */
export interface ModelSearchRankerCallOptions {
  readonly signal?: AbortSignal;
}

/** Stable reasons an adapter can report while unavailable. */
export type ModelSearchRankerUnavailableReasonCode =
  | "ranker-disabled"
  | "ranker-not-configured"
  | "ranker-dependency-unavailable"
  | "ranker-capacity-unavailable";

/** Ready state returned by an adapter for its exact declared ranker. */
export interface ReadyModelSearchRankerReadiness {
  readonly status: "ready";
  readonly rankerId: string;
}

/** Unavailable state returned by an adapter for its exact declared ranker. */
export interface UnavailableModelSearchRankerReadiness {
  readonly status: "unavailable";
  readonly rankerId: string;
  readonly reasonCode: ModelSearchRankerUnavailableReasonCode;
}

/** Safe synchronous readiness projection exposed by ranker adapters. */
export type ModelSearchRankerReadiness =
  | ReadyModelSearchRankerReadiness
  | UnavailableModelSearchRankerReadiness;

/** Adapter boundary for a specific model-search ranker implementation. */
export interface ModelSearchRankerAdapter {
  readonly descriptor: ModelSearchRankerDescriptor;
  readiness(): ModelSearchRankerReadiness;
  rank(
    invocation: ModelSearchRankerInvocation,
    options?: ModelSearchRankerCallOptions
  ): Promise<unknown>;
}

/** Stable failures raised by bounded invocation and deterministic fake adapters. */
export type ModelSearchRankerInvocationErrorCode =
  | "ranker-unavailable"
  | "ranker-failure"
  | "ranker-deadline-exceeded";

/** Typed adapter failure with a stable machine-readable code. */
export class ModelSearchRankerInvocationError extends Error {
  readonly code: ModelSearchRankerInvocationErrorCode;

  constructor(code: ModelSearchRankerInvocationErrorCode, message: string) {
    super(message);
    this.name = "ModelSearchRankerInvocationError";
    this.code = code;
  }
}

/** Why exact registry resolution could not return the requested ranker. */
export type ModelSearchRankerResolutionUnavailableReason =
  | "ranker-not-allowlisted"
  | "ranker-not-registered"
  | "ranker-unavailable";

/** Whether registry resolution used an explicit identifier or the configured default. */
export type ModelSearchRankerResolutionSource = "explicit" | "default";

/** Exact ready adapter selected by the immutable registry. */
export interface SelectedModelSearchRanker {
  readonly status: "selected";
  readonly source: ModelSearchRankerResolutionSource;
  readonly rankerId: string;
  readonly substituted: false;
  readonly descriptor: ModelSearchRankerDescriptor;
  readonly adapter: ModelSearchRankerAdapter;
  readonly readiness: ReadyModelSearchRankerReadiness;
}

/** Fail-closed registry result; callers must never substitute another adapter. */
export interface UnavailableModelSearchRankerSelection {
  readonly status: "unavailable";
  readonly source: ModelSearchRankerResolutionSource;
  readonly rankerId: string;
  readonly reasonCode: ModelSearchRankerResolutionUnavailableReason;
  readonly substituted: false;
  readonly readinessReasonCode?: ModelSearchRankerUnavailableReasonCode;
}

/** Exact result of resolving a model-search ranker. */
export type ModelSearchRankerSelection =
  | SelectedModelSearchRanker
  | UnavailableModelSearchRankerSelection;

/** Public readiness item for one allowlisted, registered ranker. */
export interface RegisteredModelSearchRankerListing {
  readonly rankerId: string;
  readonly isDefault: boolean;
  readonly descriptor: ModelSearchRankerDescriptor;
  readonly status: "ready" | "unavailable";
  readonly reasonCode?: ModelSearchRankerUnavailableReasonCode;
}

/** Public readiness item for an allowlisted ranker without a local adapter. */
export interface MissingModelSearchRankerListing {
  readonly rankerId: string;
  readonly isDefault: boolean;
  readonly status: "unavailable";
  readonly reasonCode: "ranker-not-registered";
}

/** Public-safe immutable registry listing item. */
export type ModelSearchRankerListing =
  | RegisteredModelSearchRankerListing
  | MissingModelSearchRankerListing;

/** Immutable exact-resolution registry for allowlisted model-search rankers. */
export interface ModelSearchRankerRegistry {
  readonly allowlistedRankerIds: readonly string[];
  readonly defaultRankerId: string;
  resolve(rankerId?: string): ModelSearchRankerSelection;
  listReadiness(): readonly ModelSearchRankerListing[];
}

/** Additional inspection methods exposed only by deterministic fake adapters. */
export interface FakeModelSearchRankerAdapter extends ModelSearchRankerAdapter {
  getInvocations(): readonly ModelSearchRankerInvocation[];
  lastOutput(): unknown;
}

const TOKEN_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$/u;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const URL_LIKE_PATTERN = /(?:https?:\/\/|\bwww\.)/iu;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(?:api[-_ ]?key|authorization|credential|endpoint|password|secret|token)\s*[:=]\s*\S+/iu;
const MAX_DISPLAY_NAME_LENGTH = 128;
const MAX_SUMMARY_LENGTH = 512;
const MAX_SEARCHABLE_TEXT_LENGTH = 2_048;
const MAX_PREVIEW_RESOURCES = 4;
const ADAPTER_UNAVAILABLE_REASONS = Object.freeze([
  "ranker-disabled",
  "ranker-not-configured",
  "ranker-dependency-unavailable",
  "ranker-capacity-unavailable",
] as const);

/** Validate and deeply freeze public ranker identity and calibration metadata. */
export function defineModelSearchRankerDescriptor(
  input: unknown
): ModelSearchRankerDescriptor {
  const record = assertRecord(input, "ModelSearchRankerDescriptor");
  assertAllowedKeys(
    record,
    [
      "rankerId",
      "implementationVersion",
      "calibrationId",
      "calibrationVersion",
      "displayName",
      "summary",
      "evidenceMode",
      "assuranceCeiling",
    ],
    "ModelSearchRankerDescriptor"
  );
  const descriptor: ModelSearchRankerDescriptor = {
    rankerId: requiredToken(record.rankerId, "ModelSearchRankerDescriptor.rankerId"),
    implementationVersion: requiredVersion(
      record.implementationVersion,
      "ModelSearchRankerDescriptor.implementationVersion"
    ),
    calibrationId: requiredToken(
      record.calibrationId,
      "ModelSearchRankerDescriptor.calibrationId"
    ),
    calibrationVersion: requiredVersion(
      record.calibrationVersion,
      "ModelSearchRankerDescriptor.calibrationVersion"
    ),
    displayName: requiredSafeText(
      record.displayName,
      "ModelSearchRankerDescriptor.displayName",
      MAX_DISPLAY_NAME_LENGTH
    ),
    ...(record.summary === undefined
      ? {}
      : {
          summary: requiredSafeText(
            record.summary,
            "ModelSearchRankerDescriptor.summary",
            MAX_SUMMARY_LENGTH
          ),
        }),
    evidenceMode: requiredEnum(
      record.evidenceMode,
      MODEL_RANKER_EVIDENCE_MODES,
      "ModelSearchRankerDescriptor.evidenceMode"
    ),
    assuranceCeiling: requiredEnum(
      record.assuranceCeiling,
      MODEL_MATCH_ASSURANCE_BANDS,
      "ModelSearchRankerDescriptor.assuranceCeiling"
    ),
  };
  if (
    descriptor.evidenceMode === "text-only" &&
    descriptor.assuranceCeiling === "high"
  ) {
    throw new Error(
      "ModelSearchRankerDescriptor text-only evidence cannot declare a high assurance ceiling."
    );
  }
  return deepFreeze(descriptor);
}

/** Convert safe descriptor evidence into the canonical asset-contract ranker reference. */
export function toModelRankerRef(
  descriptorInput: ModelSearchRankerDescriptor
): ModelRankerRef {
  const descriptor = defineModelSearchRankerDescriptor(descriptorInput);
  return deepFreeze({
    id: descriptor.rankerId,
    version: descriptor.implementationVersion,
    calibrationId: descriptor.calibrationId,
    calibrationVersion: descriptor.calibrationVersion,
    evidenceMode: descriptor.evidenceMode,
    assuranceCeiling: descriptor.assuranceCeiling,
  });
}

/** Validate, normalize, and deeply freeze a bounded model-search invocation. */
export function createModelSearchRankerInvocation(
  input: unknown
): ModelSearchRankerInvocation {
  const record = assertRecord(input, "ModelSearchRankerInvocation");
  assertAllowedKeys(
    record,
    ["invocationId", "request", "candidates", "deadlineEpochMs"],
    "ModelSearchRankerInvocation"
  );
  assertBoundedDenseArray(
    record.candidates,
    "ModelSearchRankerInvocation candidates",
    1,
    MODEL_SEARCH_RANKER_MAX_CANDIDATES
  );
  const candidates = mapDenseArray(record.candidates, (candidate, index) =>
    createCandidate(candidate, index)
  );
  assertUnique(
    candidates.map((candidate) => candidate.candidateId),
    "ModelSearchRankerInvocation candidates must have unique candidateId values."
  );
  const deadlineEpochMs = requiredPositiveSafeInteger(
    record.deadlineEpochMs,
    "ModelSearchRankerInvocation.deadlineEpochMs"
  );
  return deepFreeze({
    invocationId: requiredToken(
      record.invocationId,
      "ModelSearchRankerInvocation.invocationId"
    ),
    request: createModelRequestSpec(record.request),
    candidates,
    deadlineEpochMs,
  });
}

/** Parse untrusted adapter output against the exact invocation and ranker identity. */
export function createModelSearchRankerOutput(
  input: unknown,
  expectedInvocationInput: ModelSearchRankerInvocation,
  expectedRankerIdInput: string
): ModelSearchRankerOutput {
  const expectedInvocation = createModelSearchRankerInvocation(
    expectedInvocationInput
  );
  const expectedRankerId = requiredToken(
    expectedRankerIdInput,
    "Expected model-search rankerId"
  );
  if (
    expectedInvocation.request.rankerId !== undefined &&
    expectedInvocation.request.rankerId !== expectedRankerId
  ) {
    throw new Error(
      "Expected model-search rankerId must match the caller-selected request rankerId."
    );
  }
  const record = assertRecord(input, "ModelSearchRankerOutput");
  assertAllowedKeys(
    record,
    ["invocationId", "rankerId", "scores"],
    "ModelSearchRankerOutput"
  );
  if (record.invocationId !== expectedInvocation.invocationId) {
    throw new Error(
      "ModelSearchRankerOutput.invocationId must match the expected invocation."
    );
  }
  if (record.rankerId !== expectedRankerId) {
    throw new Error(
      "ModelSearchRankerOutput.rankerId must match the expected ranker."
    );
  }
  assertBoundedDenseArray(
    record.scores,
    "ModelSearchRankerOutput.scores",
    0,
    expectedInvocation.candidates.length
  );
  const candidateIds = new Set(
    expectedInvocation.candidates.map((candidate) => candidate.candidateId)
  );
  const scores = mapDenseArray(record.scores, (value, index) => {
    const score = assertRecord(value, `ModelSearchRankerOutput.scores[${index}]`);
    assertAllowedKeys(
      score,
      ["candidateId", "score"],
      `ModelSearchRankerOutput.scores[${index}]`
    );
    const candidateId = requiredToken(
      score.candidateId,
      `ModelSearchRankerOutput.scores[${index}].candidateId`
    );
    if (!candidateIds.has(candidateId)) {
      throw new Error(
        `ModelSearchRankerOutput.scores[${index}].candidateId is not part of the expected invocation.`
      );
    }
    return {
      candidateId,
      score: requiredFiniteNumber(
        score.score,
        `ModelSearchRankerOutput.scores[${index}].score`,
        0,
        1
      ),
    };
  });
  assertUnique(
    scores.map((score) => score.candidateId),
    "ModelSearchRankerOutput scores must have unique candidateId values."
  );
  return deepFreeze({
    invocationId: expectedInvocation.invocationId,
    rankerId: expectedRankerId,
    scores,
  });
}

/** Create an immutable exact-resolution registry from an explicit allowlist. */
export function createModelSearchRankerRegistry(
  input: unknown
): ModelSearchRankerRegistry {
  const record = assertRecord(input, "ModelSearchRankerRegistry");
  assertAllowedKeys(
    record,
    ["allowlistedRankerIds", "defaultRankerId", "adapters"],
    "ModelSearchRankerRegistry"
  );
  const allowlistedRankerIds = requiredTokenList(
    record.allowlistedRankerIds,
    "ModelSearchRankerRegistry.allowlistedRankerIds",
    1,
    MODEL_SEARCH_RANKER_MAX_REGISTRATIONS
  );
  const defaultRankerId = requiredToken(
    record.defaultRankerId,
    "ModelSearchRankerRegistry.defaultRankerId"
  );
  if (!allowlistedRankerIds.includes(defaultRankerId)) {
    throw new Error(
      "ModelSearchRankerRegistry default ranker must be in the explicit allowlist."
    );
  }
  assertBoundedDenseArray(
    record.adapters,
    "ModelSearchRankerRegistry.adapters",
    0,
    MODEL_SEARCH_RANKER_MAX_REGISTRATIONS
  );
  const adapters = new Map<
    string,
    {
      readonly adapter: ModelSearchRankerAdapter;
      readonly descriptor: ModelSearchRankerDescriptor;
    }
  >();
  const adapterInputs = mapDenseArray(
    record.adapters,
    (candidateAdapter) => candidateAdapter
  );
  for (const candidateAdapter of adapterInputs) {
    const callerAdapter = assertAdapter(candidateAdapter);
    const descriptor = defineModelSearchRankerDescriptor(
      callerAdapter.descriptor
    );
    if (!allowlistedRankerIds.includes(descriptor.rankerId)) {
      throw new Error(
        `ModelSearchRankerRegistry adapter ${descriptor.rankerId} is not in the allowlist.`
      );
    }
    if (adapters.has(descriptor.rankerId)) {
      throw new Error(
        `ModelSearchRankerRegistry contains a duplicate adapter for ${descriptor.rankerId}.`
      );
    }
    const adapter = createAdapterFacade(callerAdapter, descriptor);
    adapters.set(descriptor.rankerId, { adapter, descriptor });
  }

  const resolve = (rankerIdInput?: string): ModelSearchRankerSelection => {
    const source: ModelSearchRankerResolutionSource =
      rankerIdInput === undefined ? "default" : "explicit";
    const rankerId =
      rankerIdInput === undefined
        ? defaultRankerId
        : requiredToken(rankerIdInput, "ModelSearchRankerRegistry rankerId");
    if (!allowlistedRankerIds.includes(rankerId)) {
      return Object.freeze({
        status: "unavailable",
        source,
        rankerId,
        reasonCode: "ranker-not-allowlisted",
        substituted: false,
      });
    }
    const registered = adapters.get(rankerId);
    if (registered === undefined) {
      return Object.freeze({
        status: "unavailable",
        source,
        rankerId,
        reasonCode: "ranker-not-registered",
        substituted: false,
      });
    }
    const readiness = readAdapterReadiness(
      registered.adapter,
      registered.descriptor.rankerId
    );
    if (readiness.status === "unavailable") {
      return Object.freeze({
        status: "unavailable",
        source,
        rankerId,
        reasonCode: "ranker-unavailable",
        substituted: false,
        readinessReasonCode: readiness.reasonCode,
      });
    }
    return Object.freeze({
      status: "selected",
      source,
      rankerId,
      substituted: false,
      descriptor: registered.descriptor,
      adapter: registered.adapter,
      readiness,
    });
  };

  const listReadiness = (): readonly ModelSearchRankerListing[] =>
    deepFreeze(
      allowlistedRankerIds.map((rankerId) => {
        const registered = adapters.get(rankerId);
        if (registered === undefined) {
          return {
            rankerId,
            isDefault: rankerId === defaultRankerId,
            status: "unavailable" as const,
            reasonCode: "ranker-not-registered" as const,
          };
        }
        const readiness = readAdapterReadiness(
          registered.adapter,
          registered.descriptor.rankerId
        );
        if (readiness.status === "unavailable") {
          return {
            rankerId,
            isDefault: rankerId === defaultRankerId,
            descriptor: registered.descriptor,
            status: "unavailable" as const,
            reasonCode: readiness.reasonCode,
          };
        }
        return {
          rankerId,
          isDefault: rankerId === defaultRankerId,
          descriptor: registered.descriptor,
          status: "ready" as const,
        };
      })
    );

  return Object.freeze({
    allowlistedRankerIds,
    defaultRankerId,
    resolve,
    listReadiness,
  });
}

/**
 * Invoke one exact selected ranker through a package-enforced deadline and
 * cancellation boundary, then validate its untrusted output.
 */
export async function invokeModelSearchRanker(
  selectionInput: SelectedModelSearchRanker,
  invocationInput: ModelSearchRankerInvocation,
  options?: ModelSearchRankerCallOptions
): Promise<ModelSearchRankerOutput> {
  const selection = normalizeSelectedRanker(selectionInput);
  const invocation = createModelSearchRankerInvocation(invocationInput);
  if (
    invocation.request.rankerId !== undefined &&
    invocation.request.rankerId !== selection.rankerId
  ) {
    throw new Error(
      "Model-search invocation request rankerId must match the exact selected ranker."
    );
  }
  const signal = readAbortSignal(options);
  if (signal?.aborted === true) {
    throw createAbortError("Model-search ranker invocation was cancelled.");
  }
  const now = Date.now();
  if (invocation.deadlineEpochMs <= now) {
    throw createDeadlineError();
  }
  const readiness = readAdapterReadiness(
    selection.adapter,
    selection.rankerId
  );
  if (isAbortSignalAborted(signal)) {
    throw createAbortError("Model-search ranker invocation was cancelled.");
  }
  if (readiness.status === "unavailable") {
    throw new ModelSearchRankerInvocationError(
      "ranker-unavailable",
      "Model-search ranker is unavailable."
    );
  }

  const effectiveDurationMs = Math.min(
    invocation.deadlineEpochMs - now,
    MODEL_SEARCH_RANKER_MAX_EXECUTION_MS
  );
  const effectiveDeadlineEpochMs = now + effectiveDurationMs;
  const executionController = new AbortController();
  let rejectBoundary: (reason: Error) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => {
    rejectBoundary = reject;
  });
  const abortExecution = (): void => {
    rejectBoundary(
      createAbortError("Model-search ranker invocation was cancelled.")
    );
    executionController.abort();
  };
  signal?.addEventListener("abort", abortExecution, { once: true });
  const timeout = setTimeout(() => {
    rejectBoundary(createDeadlineError());
    executionController.abort();
  }, effectiveDurationMs);
  const adapterResult = Promise.resolve().then(() =>
    selection.adapter.rank(invocation, {
      signal: executionController.signal,
    })
  );

  let rawOutput: unknown;
  try {
    rawOutput = await Promise.race([adapterResult, boundary]);
    if (isAbortSignalAborted(signal)) {
      throw createAbortError("Model-search ranker invocation was cancelled.");
    }
    if (effectiveDeadlineEpochMs <= Date.now()) {
      throw createDeadlineError();
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortExecution);
  }
  return createModelSearchRankerOutput(
    rawOutput,
    invocation,
    selection.rankerId
  );
}

/** Create a deterministic fake adapter for ready and failure-path contract tests. */
export function createFakeModelSearchRankerAdapter(
  input: unknown
): FakeModelSearchRankerAdapter {
  const record = assertRecord(input, "FakeModelSearchRankerAdapter");
  assertAllowedKeys(
    record,
    ["descriptor", "mode"],
    "FakeModelSearchRankerAdapter"
  );
  const descriptor = defineModelSearchRankerDescriptor(record.descriptor);
  const mode =
    record.mode === undefined
      ? "ready"
      : requiredEnum(
          record.mode,
          MODEL_SEARCH_RANKER_FAKE_MODES,
          "FakeModelSearchRankerAdapter.mode"
        );
  const invocations: ModelSearchRankerInvocation[] = [];
  let latestOutput: unknown;

  const readiness = (): ModelSearchRankerReadiness =>
    mode === "unavailable"
      ? Object.freeze({
          status: "unavailable",
          rankerId: descriptor.rankerId,
          reasonCode: "ranker-dependency-unavailable",
        })
      : Object.freeze({
          status: "ready",
          rankerId: descriptor.rankerId,
        });

  const rank = async (
    invocationInput: ModelSearchRankerInvocation,
    options?: ModelSearchRankerCallOptions
  ): Promise<unknown> => {
    const invocation = createModelSearchRankerInvocation(invocationInput);
    const signal = readAbortSignal(options);
    if (signal?.aborted === true) {
      throw createAbortError("Model-search ranker invocation was cancelled.");
    }
    if (invocation.deadlineEpochMs <= Date.now()) {
      throw new ModelSearchRankerInvocationError(
        "ranker-deadline-exceeded",
        "Model-search ranker invocation deadline has expired."
      );
    }
    invocations.push(invocation);

    if (mode === "unavailable") {
      throw new ModelSearchRankerInvocationError(
        "ranker-unavailable",
        "Model-search ranker is unavailable."
      );
    }
    if (mode === "throwing") {
      throw new ModelSearchRankerInvocationError(
        "ranker-failure",
        "Model-search ranker failed."
      );
    }
    if (mode === "cancelled") {
      throw createAbortError("Model-search ranker invocation was cancelled.");
    }
    if (mode === "malformed-output") {
      latestOutput = deepFreeze({
        invocationId: invocation.invocationId,
        rankerId: descriptor.rankerId,
        scores: [{ candidateId: "foreign-candidate", score: Number.NaN }],
      });
      return latestOutput;
    }
    latestOutput = createModelSearchRankerOutput(
      {
        invocationId: invocation.invocationId,
        rankerId: descriptor.rankerId,
        scores: invocation.candidates.map((candidate, index) => ({
          candidateId: candidate.candidateId,
          score: Math.max(0, 1 - index * 0.05),
        })),
      },
      invocation,
      descriptor.rankerId
    );
    return latestOutput;
  };

  return Object.freeze({
    descriptor,
    readiness,
    rank,
    getInvocations: (): readonly ModelSearchRankerInvocation[] =>
      Object.freeze([...invocations]),
    lastOutput: (): unknown => latestOutput,
  });
}

function createCandidate(
  input: unknown,
  index: number
): ModelSearchRankerCandidate {
  const fieldName = `ModelSearchRankerInvocation.candidates[${index}]`;
  const record = assertRecord(input, fieldName);
  assertAllowedKeys(
    record,
    ["candidateId", "contentHash", "searchableText", "previewResources"],
    fieldName
  );
  assertBoundedDenseArray(
    record.previewResources,
    `${fieldName}.previewResources`,
    0,
    MAX_PREVIEW_RESOURCES
  );
  const candidateId = requiredToken(
    record.candidateId,
    `${fieldName}.candidateId`
  );
  const previewResources = mapDenseArray(
    record.previewResources,
    (resource, resourceIndex) => {
      const normalized = createModelResourceRef(resource);
      if (normalized.contentType !== "image/png") {
        throw new Error(
          `${fieldName}.previewResources[${resourceIndex}] must use canonical image/png review evidence.`
        );
      }
      assertCandidatePreviewResourceScope(
        normalized.uri,
        candidateId,
        `${fieldName}.previewResources[${resourceIndex}]`
      );
      return normalized;
    }
  );
  assertUnique(
    previewResources.map((resource) => resource.uri),
    `${fieldName}.previewResources must have unique uri values.`
  );
  return deepFreeze({
    candidateId,
    contentHash: requiredSha256(record.contentHash, `${fieldName}.contentHash`),
    searchableText: requiredSafeText(
      record.searchableText,
      `${fieldName}.searchableText`,
      MAX_SEARCHABLE_TEXT_LENGTH
    ),
    previewResources,
  });
}

function assertCandidatePreviewResourceScope(
  uri: string,
  candidateId: string,
  fieldName: string
): void {
  const segments = uri.slice("mcp://models/".length).split("/");
  const catalogVersionPreviewShape =
    segments.length >= 6 &&
    segments[0] === "catalog" &&
    segments[1] === candidateId &&
    segments[2] === "versions" &&
    (segments[4] === "previews" || segments[4] === "views");
  if (catalogVersionPreviewShape) {
    assertAssetId(candidateId);
    assertImmutableAssetVersion(segments[3]);
    return;
  }
  const stagedCandidatePreview =
    segments.length >= 5 &&
    segments[0] === "resolutions" &&
    segments[2] === "candidates" &&
    segments[3] === candidateId &&
    (segments[4] === "views" || segments.at(-1)?.endsWith(".png") === true);
  if (!stagedCandidatePreview) {
    throw new Error(
      `${fieldName} must be immutable catalog-version or staged-resolution review evidence scoped to candidateId ${candidateId}.`
    );
  }
}

function assertAdapter(input: unknown): ModelSearchRankerAdapter {
  if (input === null || typeof input !== "object") {
    throw new Error("ModelSearchRankerRegistry adapter must be an object.");
  }
  const adapter = input as Partial<ModelSearchRankerAdapter>;
  if (
    adapter.descriptor === undefined ||
    typeof adapter.readiness !== "function" ||
    typeof adapter.rank !== "function"
  ) {
    throw new Error(
      "ModelSearchRankerRegistry adapter must expose descriptor, readiness, and rank."
    );
  }
  return adapter as ModelSearchRankerAdapter;
}

function createAdapterFacade(
  adapter: ModelSearchRankerAdapter,
  descriptor: ModelSearchRankerDescriptor
): ModelSearchRankerAdapter {
  const readiness = adapter.readiness.bind(adapter);
  const rank = adapter.rank.bind(adapter);
  return Object.freeze({
    descriptor,
    readiness: (): ModelSearchRankerReadiness => readiness(),
    rank: (
      invocation: ModelSearchRankerInvocation,
      options?: ModelSearchRankerCallOptions
    ): Promise<unknown> => rank(invocation, options),
  });
}

function normalizeSelectedRanker(
  input: SelectedModelSearchRanker
): SelectedModelSearchRanker {
  const record = assertRecord(input, "SelectedModelSearchRanker");
  assertAllowedKeys(
    record,
    [
      "status",
      "source",
      "rankerId",
      "substituted",
      "descriptor",
      "adapter",
      "readiness",
    ],
    "SelectedModelSearchRanker"
  );
  if (record.status !== "selected" || record.substituted !== false) {
    throw new Error(
      "SelectedModelSearchRanker must represent an exact, non-substituted selection."
    );
  }
  const source = requiredEnum(
    record.source,
    ["explicit", "default"] as const,
    "SelectedModelSearchRanker.source"
  );
  const rankerId = requiredToken(
    record.rankerId,
    "SelectedModelSearchRanker.rankerId"
  );
  const descriptor = defineModelSearchRankerDescriptor(record.descriptor);
  if (descriptor.rankerId !== rankerId) {
    throw new Error(
      "SelectedModelSearchRanker descriptor must match the exact rankerId."
    );
  }
  const callerAdapter = assertAdapter(record.adapter);
  const adapterDescriptor = defineModelSearchRankerDescriptor(
    callerAdapter.descriptor
  );
  if (!sameModelSearchRankerDescriptor(descriptor, adapterDescriptor)) {
    throw new Error(
      "SelectedModelSearchRanker adapter descriptor must match the exact selected ranker descriptor."
    );
  }
  const adapter = createAdapterFacade(callerAdapter, descriptor);
  const readiness = parseReadiness(record.readiness, rankerId);
  if (readiness.status !== "ready") {
    throw new Error("SelectedModelSearchRanker readiness must be ready.");
  }
  return Object.freeze({
    status: "selected",
    source,
    rankerId,
    substituted: false,
    descriptor,
    adapter,
    readiness,
  });
}

function sameModelSearchRankerDescriptor(
  left: ModelSearchRankerDescriptor,
  right: ModelSearchRankerDescriptor
): boolean {
  return (
    left.rankerId === right.rankerId &&
    left.implementationVersion === right.implementationVersion &&
    left.calibrationId === right.calibrationId &&
    left.calibrationVersion === right.calibrationVersion &&
    left.displayName === right.displayName &&
    left.summary === right.summary &&
    left.evidenceMode === right.evidenceMode &&
    left.assuranceCeiling === right.assuranceCeiling
  );
}

function parseReadiness(
  input: unknown,
  expectedRankerId: string
): ModelSearchRankerReadiness {
  const record = assertRecord(input, "ModelSearchRankerReadiness");
  if (record.status === "ready") {
    assertAllowedKeys(
      record,
      ["status", "rankerId"],
      "ModelSearchRankerReadiness"
    );
    if (record.rankerId !== expectedRankerId) {
      throw new Error(
        "ModelSearchRankerReadiness.rankerId must match the adapter descriptor."
      );
    }
    return Object.freeze({ status: "ready", rankerId: expectedRankerId });
  }
  if (record.status === "unavailable") {
    assertAllowedKeys(
      record,
      ["status", "rankerId", "reasonCode"],
      "ModelSearchRankerReadiness"
    );
    if (record.rankerId !== expectedRankerId) {
      throw new Error(
        "ModelSearchRankerReadiness.rankerId must match the adapter descriptor."
      );
    }
    return Object.freeze({
      status: "unavailable",
      rankerId: expectedRankerId,
      reasonCode: requiredEnum(
        record.reasonCode,
        ADAPTER_UNAVAILABLE_REASONS,
        "ModelSearchRankerReadiness.reasonCode"
      ),
    });
  }
  throw new Error("ModelSearchRankerReadiness.status is not supported.");
}

function readAdapterReadiness(
  adapter: ModelSearchRankerAdapter,
  expectedRankerId: string
): ModelSearchRankerReadiness {
  try {
    return parseReadiness(adapter.readiness(), expectedRankerId);
  } catch {
    return Object.freeze({
      status: "unavailable",
      rankerId: expectedRankerId,
      reasonCode: "ranker-dependency-unavailable",
    });
  }
}

function readAbortSignal(
  options: ModelSearchRankerCallOptions | undefined
): AbortSignal | undefined {
  if (options === undefined) {
    return undefined;
  }
  const record = assertRecord(options, "ModelSearchRankerCallOptions");
  assertAllowedKeys(record, ["signal"], "ModelSearchRankerCallOptions");
  if (record.signal === undefined) {
    return undefined;
  }
  const signal = record.signal as Partial<AbortSignal>;
  if (
    signal === null ||
    typeof signal !== "object" ||
    typeof signal.aborted !== "boolean" ||
    typeof signal.addEventListener !== "function" ||
    typeof signal.removeEventListener !== "function"
  ) {
    throw new Error("ModelSearchRankerCallOptions.signal must be an AbortSignal.");
  }
  return signal as AbortSignal;
}

function isAbortSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function createAbortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
}

function createDeadlineError(): ModelSearchRankerInvocationError {
  return new ModelSearchRankerInvocationError(
    "ranker-deadline-exceeded",
    "Model-search ranker invocation deadline has expired."
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function assertRecord(
  value: unknown,
  fieldName: string
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${fieldName} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function assertBoundedDenseArray(
  value: unknown,
  fieldName: string,
  minimumItems: number,
  maximumItems: number
): asserts value is unknown[] {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    throw new Error(
      `${fieldName} must be a dense array containing between ${minimumItems} and ${maximumItems} items.`
    );
  }
  const allowedNames = new Set([
    "length",
    ...Array.from({ length: value.length }, (_unused, index) => String(index)),
  ]);
  if (
    Object.getOwnPropertyNames(value).some((name) => !allowedNames.has(name)) ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    throw new Error(`${fieldName} must not contain non-element properties.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(
        `${fieldName} must be a dense array of concrete elements (sparse or accessor entries are not allowed).`
      );
    }
  }
}

function mapDenseArray<T>(
  value: readonly unknown[],
  mapper: (element: unknown, index: number) => T
): T[] {
  const mapped: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(
        "Dense array elements must remain concrete enumerable data properties during normalization."
      );
    }
    mapped.push(mapper(descriptor.value, index));
  }
  return mapped;
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
  fieldName: string
): void {
  const propertyNames = Object.getOwnPropertyNames(record);
  const unexpected = propertyNames.find(
    (key) => !allowedKeys.includes(key)
  );
  if (unexpected !== undefined) {
    throw new Error(`${fieldName} contains unexpected field ${unexpected}.`);
  }
  if (Object.getOwnPropertySymbols(record).length > 0) {
    throw new Error(`${fieldName} contains an unexpected symbol field.`);
  }
  for (const propertyName of propertyNames) {
    const descriptor = Object.getOwnPropertyDescriptor(record, propertyName);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new Error(
        `${fieldName}.${propertyName} must be an enumerable data property; accessors are not allowed.`
      );
    }
  }
}

function requiredText(
  value: unknown,
  fieldName: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    hasControlCharacters(normalized)
  ) {
    throw new Error(`${fieldName} must be a non-empty bounded string.`);
  }
  return normalized;
}

function requiredSafeText(
  value: unknown,
  fieldName: string,
  maxLength: number
): string {
  const text = requiredText(value, fieldName, maxLength);
  if (URL_LIKE_PATTERN.test(text)) {
    throw new Error(`${fieldName} must not contain a direct URL.`);
  }
  if (SENSITIVE_ASSIGNMENT_PATTERN.test(text)) {
    throw new Error(
      `${fieldName} must not contain sensitive key/value metadata.`
    );
  }
  return text;
}

function requiredToken(value: unknown, fieldName: string): string {
  const token = requiredText(value, fieldName, 128);
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error(`${fieldName} must be a token up to 128 characters.`);
  }
  return token;
}

function requiredVersion(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be a version token up to 128 characters.`);
  }
  return value;
}

function requiredSha256(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be a lowercase 64-character sha256 digest.`);
  }
  return value;
}

function requiredPositiveSafeInteger(value: unknown, fieldName: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${fieldName} must be a positive safe integer.`);
  }
  return value as number;
}

function requiredFiniteNumber(
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${fieldName} must be a finite number between ${minimum} and ${maximum}.`
    );
  }
  return value;
}

function requiredEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  fieldName: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${fieldName} is not supported.`);
  }
  return value as T;
}

function requiredTokenList(
  value: unknown,
  fieldName: string,
  minimumItems: number,
  maximumItems: number
): readonly string[] {
  assertBoundedDenseArray(value, fieldName, minimumItems, maximumItems);
  const tokens = mapDenseArray(value, (item, index) =>
    requiredToken(item, `${fieldName}[${index}]`)
  );
  assertUnique(tokens, `${fieldName} must contain unique values.`);
  return Object.freeze(tokens);
}

function assertUnique(values: readonly string[], message: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(message);
  }
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}
