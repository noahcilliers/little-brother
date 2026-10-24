import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURE_NAMES, FEATURE_VERSION } from "../../packages/core/src/index";

// Writes core's feature list for train.py, which stamps it into every exported model.
//   npx tsx scripts/classifier/feature-names.ts

const out = resolve(dirname(fileURLToPath(import.meta.url)), "feature-names.json");
writeFileSync(out, `${JSON.stringify({ featureVersion: FEATURE_VERSION, featureNames: FEATURE_NAMES }, null, 2)}\n`);
console.log(`${FEATURE_NAMES.length} features (v${FEATURE_VERSION}) → ${out}`);
