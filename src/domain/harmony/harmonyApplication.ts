import { createHash } from "node:crypto";

import canonicalize from "canonicalize";
import { z } from "zod";

import { parseArtifactInventoryEvidence } from "../artifactInventoryEvidence.js";
import { evidenceSchema } from "../evidence.js";
import { digestSchema } from "../digests.js";
import { prefixedDigestSchema } from "../digests.js";
import {
  bridgeCandidateCoverageSchema,
  projectCartesianCandidates,
} from "../bridgeCandidateProjection.js";

const evidenceIdSchema = prefixedDigestSchema("ev");
const pathSchema = z.string().min(1);
const componentSchema = z.strictObject({
  path: pathSchema,
  artifact_id: prefixedDigestSchema("art"),
  sha256: digestSchema,
  format: z.string().min(1),
});

const HARMONY_ROOT_FORMATS = ["hap", "hsp", "app-pack"] as const;
type RootFormat = (typeof HARMONY_ROOT_FORMATS)[number];

/** Authenticated HarmonyOS inventory pages projected as one application. */
export const harmonyApplicationProjectionInputSchema = z.strictObject({
  inventory_evidence: z.array(evidenceSchema).min(1),
});

/** Deterministic, execution-free HarmonyOS application inventory projection. */
export const harmonyApplicationProjectionResultSchema = z.strictObject({
  projection_id: prefixedDigestSchema("hmp"),
  root_sha256: digestSchema,
  root_format: z.enum(HARMONY_ROOT_FORMATS),
  source_evidence_ids: z.array(evidenceIdSchema).min(1),
  packaging_model: z.enum(["stage", "fa", "unknown"]),
  components: z.strictObject({
    manifests: z.array(componentSchema),
    bytecode: z.array(componentSchema),
    resources: z.array(componentSchema),
    native_libraries: z.array(componentSchema),
    javascript: z.array(componentSchema),
    signing: z.array(componentSchema),
  }),
  app_pack_children: z.array(componentSchema),
  runtime_families: z.array(z.enum(["ark", "native", "javascript"])),
  bridge_candidates: z.array(
    z.strictObject({
      managed_path: pathSchema,
      native_path: pathSchema,
      basis: z.enum(["managed-and-native-content", "napi-library-convention"]),
    }),
  ),
  bridge_candidate_coverage: bridgeCandidateCoverageSchema,
  coverage: z.strictObject({
    status: z.enum(["complete-within-inventory", "partial"]),
    inventory_complete: z.boolean(),
  }),
  limitations: z.array(z.string().min(1)),
});

export type HarmonyApplicationProjectionInput = z.infer<
  typeof harmonyApplicationProjectionInputSchema
>;
export type HarmonyApplicationProjectionResult = z.infer<
  typeof harmonyApplicationProjectionResultSchema
>;
type Component = z.infer<typeof componentSchema>;

/** Project exact HarmonyOS package paths and hashes without decoding or executing target code. */
export const projectHarmonyApplication = (
  input: HarmonyApplicationProjectionInput,
): HarmonyApplicationProjectionResult => {
  const parsed = harmonyApplicationProjectionInputSchema.parse(input);
  const { evidence, inventory } = parseArtifactInventoryEvidence(
    parsed.inventory_evidence,
  );
  const rootFormat = harmonyRootFormat(inventory.manifest.root_format);
  const nodes = new Map(
    inventory.nodes.map((node) => [node.artifact_id, node]),
  );
  const all = inventory.occurrences
    .filter(
      (occurrence) =>
        occurrence.artifact_id !== null && occurrence.logical_path !== ".",
    )
    .map((occurrence) => {
      const node = nodes.get(occurrence.artifact_id ?? "");
      if (node === undefined)
        throw new TypeError(
          "HarmonyOS application occurrence has no artifact node",
        );
      return {
        path: occurrence.logical_path,
        artifact_id: node.artifact_id,
        sha256: node.sha256,
        format: occurrence.artifact_format,
      } satisfies Component;
    });
  const classified = classify(all);
  const bridgeProjection = bridgeCandidates(
    classified.bytecode,
    classified.native_libraries,
  );
  const limitations = [
    ...(!inventory.complete
      ? ["Source inventory pages are incomplete; absence is unknown."]
      : []),
    "Manifest, module, resource, and signing semantics require a dedicated HarmonyOS provider; this projection reports exact inventory paths and hashes only.",
    "The packaging model is a path-presence heuristic: a Stage model is claimed only from module.json and a FA model only from config.json; both can coexist with unusual layouts.",
    "Runtime families are inferred from inventory formats and paths; filename suffixes do not establish valid Ark bytecode.",
    "Bridge candidates are path-based hypotheses, not decoded N-API declarations or observed runtime calls.",
    ...(rootFormat === "app-pack"
      ? [
          "App Pack child packages are listed by inventory path only; their contents are not recursively inventoried by this projection.",
        ]
      : []),
    "HarmonyOS .har shared libraries are not identified by this projection; the .har suffix also names HTTP Archive JSON, so that classification requires verified ZIP bytes.",
    ...(bridgeProjection.coverage.status === "partial"
      ? [
          `Bridge candidate pairs exceeded the projection safety budget; ${bridgeProjection.coverage.omitted_candidates} hypotheses are omitted. Component arrays still include every component from the supplied inventory pages.`,
        ]
      : []),
  ];
  const withoutId = {
    root_sha256: inventory.manifest.root_sha256,
    root_format: rootFormat,
    source_evidence_ids: evidence
      .map(({ evidence_id: id }) => id)
      .sort(compare),
    packaging_model: packagingModel(classified.manifests),
    components: classified,
    app_pack_children:
      rootFormat === "app-pack"
        ? all.filter(({ path }) => /\.(?:hap|hsp)$/iu.test(path))
        : [],
    runtime_families: runtimeFamilies(all),
    bridge_candidates: bridgeProjection.candidates,
    bridge_candidate_coverage: bridgeProjection.coverage,
    coverage: {
      status:
        inventory.complete && bridgeProjection.coverage.status === "complete"
          ? ("complete-within-inventory" as const)
          : ("partial" as const),
      inventory_complete: inventory.complete,
    },
    limitations,
  };
  return harmonyApplicationProjectionResultSchema.parse({
    ...withoutId,
    projection_id: `hmp_${digest(withoutId)}`,
  });
};

const harmonyRootFormat = (format: string): RootFormat => {
  const root = HARMONY_ROOT_FORMATS.find((candidate) => candidate === format);
  if (root === undefined)
    throw new TypeError(
      `HarmonyOS application projection requires HAP, HSP, or App Pack inventory Evidence (got ${format})`,
    );
  return root;
};

const packagingModel = (
  manifests: readonly Component[],
): HarmonyApplicationProjectionResult["packaging_model"] => {
  const stage = manifests.some(({ path }) =>
    /(?:^|\/)module\.json$/iu.test(path),
  );
  const fa = manifests.some(({ path }) => /(?:^|\/)config\.json$/iu.test(path));
  if (stage) return "stage";
  if (fa) return "fa";
  return "unknown";
};

const classify = (all: readonly Component[]) => ({
  manifests: all.filter(({ path }) =>
    /(?:^|\/)(?:module\.json|config\.json|pack\.info)$/iu.test(path),
  ),
  bytecode: all.filter(({ path }) => /\.(?:abc|pa)$/iu.test(path)),
  resources: all.filter(
    ({ path }) =>
      /(?:^|\/)resources\.index$/iu.test(path) || /^resources\//iu.test(path),
  ),
  native_libraries: all.filter(
    ({ path, format }) =>
      format === "elf" || /(?:^|\/)libs\/[^/]+\/[^/]+\.so$/iu.test(path),
  ),
  javascript: all.filter(
    ({ path, format }) =>
      format === "javascript-bundle" || /\.(?:m?js|cjs)$/iu.test(path),
  ),
  signing: all.filter(({ path }) =>
    /^META-INF\/[^/]+\.(?:p7b|sig|cer|crt|pem|provision)$/iu.test(path),
  ),
});

const runtimeFamilies = (all: readonly Component[]) => {
  const paths = all.map(({ path }) => path.toLowerCase());
  const families = new Set<
    HarmonyApplicationProjectionResult["runtime_families"][number]
  >();
  if (paths.some((path) => path.endsWith(".abc") || path.endsWith(".pa")))
    families.add("ark");
  if (all.some(({ format }) => format === "elf")) families.add("native");
  if (paths.some((path) => /\.(?:m?js|cjs)$/.test(path)))
    families.add("javascript");
  return [...families].sort(compare);
};

const bridgeCandidates = (
  managed: readonly Component[],
  native: readonly Component[],
) => {
  return projectCartesianCandidates({
    groups: [{ left: managed, right: native }],
    createCandidate: (managed_path, target) => ({
      managed_path,
      native_path: target.path,
      basis: napiBasis(target.path),
    }),
  });
};

const napiBasis = (
  path: string,
): HarmonyApplicationProjectionResult["bridge_candidates"][number]["basis"] =>
  /(?:^|\/)libs\/[^/]+\/lib[^/]+\.so$/iu.test(path)
    ? "napi-library-convention"
    : "managed-and-native-content";

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const digest = (value: unknown): string => {
  const encoded = canonicalize(value);
  if (encoded === undefined)
    throw new TypeError(
      "HarmonyOS application projection is not canonical JSON",
    );
  return createHash("sha256").update(encoded).digest("hex");
};
