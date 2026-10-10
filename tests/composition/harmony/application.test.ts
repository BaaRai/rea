import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from "@zip.js/zip.js";
import { describe, expect, it } from "vitest";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import {
  createNonApplicationZipInventory,
  requireSuccessfulProjection,
} from "../../support/applicationSessionFixture.js";

import { projectHarmonyApplicationEvidence } from "../../../src/application/harmony/HarmonyApplicationService.js";
import { createDirectAnalysis } from "../../../src/composition/directAnalysis.js";
import {
  harmonyApplicationProjectionResultSchema,
  projectHarmonyApplication,
} from "../../../src/domain/harmony/harmonyApplication.js";
import { parseEvidence } from "../../../src/domain/evidence.js";

const { runProviderAnalysis } = createDirectAnalysis({});

const elf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]);

describe("HarmonyOS application projection", () => {
  it("projects deterministic Stage HAP components and explicit bridge hypotheses", async () => {
    const root = await createTestTempDirectory("rea-harmony-");
    const path = join(root, "Fixture.hap");
    const writer = new ZipWriter(new Uint8ArrayWriter());
    await writer.add(
      "module.json",
      new TextReader('{"module":{"name":"entry"}}'),
    );
    await writer.add("ets/modules.abc", new TextReader("panda bytecode"));
    await writer.add("libs/arm64-v8a/libentry.so", new Uint8ArrayReader(elf));
    await writer.add("resources.index", new TextReader("resource index"));
    await writer.add(
      "resources/base/profile/main_pages.json",
      new TextReader("{}"),
    );
    await writer.add("assets/web/index.js", new TextReader("bridge();"));
    await writer.add("META-INF/FIXTURE.p7b", new TextReader("opaque signing"));
    await writeFile(path, await writer.close());

    const inventory = parseEvidence(
      await runProviderAnalysis(path, "inventory_artifact", {}),
    );
    expect(inventory.subject?.format).toBe("hap");
    const first = projectHarmonyApplicationEvidence({
      inventory_evidence: [inventory],
    });
    const second = projectHarmonyApplicationEvidence({
      inventory_evidence: [inventory],
    });
    const left = harmonyApplicationProjectionResultSchema.parse(
      requireSuccessfulProjection(first).normalized_result,
    );
    const right = harmonyApplicationProjectionResultSchema.parse(
      requireSuccessfulProjection(second).normalized_result,
    );
    expect(left).toEqual(right);
    expect(left).toMatchObject({
      root_format: "hap",
      packaging_model: "stage",
      coverage: {
        status: "complete-within-inventory",
        inventory_complete: true,
      },
    });
    expect(left.components.manifests.map(({ path }) => path)).toEqual([
      "module.json",
    ]);
    expect(left.components.bytecode.map(({ path }) => path)).toEqual([
      "ets/modules.abc",
    ]);
    expect(left.components.resources.map(({ path }) => path).sort()).toEqual([
      "resources.index",
      "resources/base/profile/main_pages.json",
    ]);
    expect(left.components.native_libraries).toHaveLength(1);
    expect(left.components.javascript).toHaveLength(1);
    expect(left.components.signing).toHaveLength(1);
    expect(left.runtime_families).toEqual(["ark", "javascript", "native"]);
    expect(left.bridge_candidates).toEqual([
      expect.objectContaining({
        managed_path: "ets/modules.abc",
        native_path: "libs/arm64-v8a/libentry.so",
        basis: "napi-library-convention",
      }),
    ]);
    expect(left.app_pack_children).toEqual([]);
    expect(JSON.stringify(left)).not.toContain("opaque signing");
    expect(left.limitations).toContain(
      "Manifest, module, resource, and signing semantics require a dedicated HarmonyOS provider; this projection reports exact inventory paths and hashes only.",
    );
  });

  it("projects App Pack children by path without recursive inventory", async () => {
    const root = await createTestTempDirectory("rea-harmony-app-");
    const path = join(root, "Bundle.app");
    const entryWriter = new ZipWriter(new Uint8ArrayWriter());
    await entryWriter.add("module.json", new TextReader('{"module":{}}'));
    await entryWriter.add("ets/modules.abc", new TextReader("panda"));
    const featureWriter = new ZipWriter(new Uint8ArrayWriter());
    await featureWriter.add("module.json", new TextReader('{"module":{}}'));
    const writer = new ZipWriter(new Uint8ArrayWriter());
    await writer.add("pack.info", new TextReader('{"packages":[]}'));
    await writer.add(
      "entry.hap",
      new Uint8ArrayReader(await entryWriter.close()),
    );
    await writer.add(
      "feature.hsp",
      new Uint8ArrayReader(await featureWriter.close()),
    );
    await writeFile(path, await writer.close());

    const inventory = parseEvidence(
      await runProviderAnalysis(path, "inventory_artifact", {}),
    );
    expect(inventory.subject?.format).toBe("app-pack");
    const result = projectHarmonyApplicationEvidence({
      inventory_evidence: [inventory],
    });
    const projection = harmonyApplicationProjectionResultSchema.parse(
      requireSuccessfulProjection(result).normalized_result,
    );
    expect(projection.root_format).toBe("app-pack");
    expect(projection.components.manifests.map(({ path }) => path)).toEqual([
      "pack.info",
    ]);
    expect(projection.app_pack_children.map(({ path }) => path).sort()).toEqual(
      ["entry.hap", "feature.hsp"],
    );
    expect(projection.packaging_model).toBe("unknown");
    expect(projection.limitations).toContain(
      "App Pack child packages are listed by inventory path only; their contents are not recursively inventoried by this projection.",
    );
  });
});

describe("HarmonyOS packaging boundaries", () => {
  it("claims the FA model only from config.json", async () => {
    const root = await createTestTempDirectory("rea-harmony-fa-");
    const path = join(root, "Legacy.hap");
    const writer = new ZipWriter(new Uint8ArrayWriter());
    await writer.add("config.json", new TextReader('{"app":{}}'));
    await writer.add("assets/js/default.js", new TextReader("legacy();"));
    await writeFile(path, await writer.close());

    const inventory = parseEvidence(
      await runProviderAnalysis(path, "inventory_artifact", {}),
    );
    const result = projectHarmonyApplicationEvidence({
      inventory_evidence: [inventory],
    });
    const projection = harmonyApplicationProjectionResultSchema.parse(
      requireSuccessfulProjection(result).normalized_result,
    );
    expect(projection.packaging_model).toBe("fa");
    expect(projection.runtime_families).toEqual(["javascript"]);
  });

  it("rejects non-HarmonyOS inventory Evidence", async () => {
    const inventory = await createNonApplicationZipInventory(
      "rea-harmony-invalid-",
    );
    expect(
      projectHarmonyApplicationEvidence({ inventory_evidence: [inventory] }),
    ).toMatchObject({
      ok: false,
      error: { _tag: "AnalysisInputError" },
    });
  });

  it("keeps HTTP Archive .har files out of the HarmonyOS classification", async () => {
    const root = await createTestTempDirectory("rea-harmony-http-har-");
    const path = join(root, "capture.har");
    await writeFile(
      path,
      JSON.stringify({ log: { version: "1.2", creator: {}, entries: [] } }),
    );
    const result = await runProviderAnalysis(path, "inventory_artifact", {});
    expect(result).toMatchObject({
      error: "Analysis failed",
      code: "target_unavailable",
    });
  });
});
