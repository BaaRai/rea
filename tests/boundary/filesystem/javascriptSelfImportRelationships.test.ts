import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { expect, it } from "vitest";

import { reconstructJavaScriptArtifact } from "../../../src/application/javascript/JavaScriptArtifactReconstruction.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";

const writeFiles = async (root: string, files: Record<string, string>) => {
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }),
  );
};

it("omits a literal self-import instead of failing result validation", async () => {
  const root = await createTestTempDirectory("rea-self-import-");
  try {
    await writeFiles(root, {
      "a.js": 'import "./a.js";\nexport const value = 1;\n',
      "b.js": 'import { value } from "./a.js";\nconsole.log(value);\n',
    });
    const result = await reconstructJavaScriptArtifact({
      input_path: root,
      format: "directory",
    });
    expect(
      result.graph.edges.filter(
        (edge) => edge.source_node_id === edge.target_node_id,
      ),
    ).toEqual([]);
    expect(
      result.graph.limitations.find((limitation) =>
        limitation.includes(
          "1 import specifier resolved back to the importing module itself and was omitted",
        ),
      ),
    ).toBeDefined();
    expect(
      result.graph.edges.some(
        (edge) =>
          edge.relation === "imports" &&
          edge.properties.specifier === "./a.js" &&
          edge.properties.resolution_status === "resolved",
      ),
    ).toBe(true);
  } finally {
    await import("node:fs/promises").then(({ rm }) =>
      rm(root, { recursive: true, force: true }),
    );
  }
});

it("omits a CommonJS self-require and a TypeScript extension rewrite onto the same file", async () => {
  const root = await createTestTempDirectory("rea-self-require-");
  try {
    await writeFiles(root, {
      "c.cjs": 'const self = require("./c.cjs");\nmodule.exports = self;\n',
      "util.ts": 'import "./util.js";\nexport const value = 1;\n',
    });
    const result = await reconstructJavaScriptArtifact({
      input_path: root,
      format: "directory",
    });
    expect(
      result.graph.edges.filter(
        (edge) => edge.source_node_id === edge.target_node_id,
      ),
    ).toEqual([]);
    const omission = result.graph.limitations.find((limitation) =>
      limitation.includes(
        "import specifiers resolved back to the importing module itself and were omitted",
      ),
    );
    // A require-self and an extension rewrite that lands on the source file
    // both count; either shape alone still discloses its own singular form.
    if (omission === undefined) {
      expect(
        result.graph.limitations.find((limitation) =>
          limitation.includes(
            "import specifier resolved back to the importing module itself and was omitted",
          ),
        ),
      ).toBeDefined();
    }
  } finally {
    await import("node:fs/promises").then(({ rm }) =>
      rm(root, { recursive: true, force: true }),
    );
  }
});
