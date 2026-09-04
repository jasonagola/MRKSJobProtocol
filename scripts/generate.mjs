import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specPath = resolve(root, "openapi/job-protocol-v1.yaml");
const document = yaml.load(readFileSync(specPath, "utf8"));
const schemas = document.components?.schemas ?? {};
const schemaDir = resolve(root, "schemas");
mkdirSync(schemaDir, { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  writeFileSync(
    resolve(schemaDir, `${name}.schema.json`),
    `${JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `https://job-protocol.mrks.dev/schemas/${name}.schema.json`,
      $ref: `#/$defs/${name}`,
      $defs: schemas,
    }, null, 2)}\n`,
  );
}

execFileSync(
  resolve(root, "node_modules/.bin/openapi-typescript"),
  [specPath, "--output", resolve(root, "typescript/src/generated.ts")],
  { stdio: "inherit" },
);
