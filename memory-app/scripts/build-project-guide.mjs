import { readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "{{PLAN_SOURCE}}";
const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const repositoryRoot = path.resolve(appRoot, "..");

const templatePath = path.join(appRoot, "guide", "project.template.html");
const artifacts = [
  {
    source: path.join(repositoryRoot, "docs", "PRD.md"),
    output: path.join(appRoot, "public", "project-prd.md"),
  },
];
const htmlOutputPath = path.join(appRoot, "public", "project.html");

export function renderGuide(template, planText) {
  const markerCount = template.split(MARKER).length - 1;
  if (markerCount !== 1) {
    throw new Error(`Guide template must contain exactly one ${MARKER} marker`);
  }

  const escapedPlan = planText.replace(/[&<>"']/g, (character) => ESCAPES[character]);
  return template.replace(MARKER, () => escapedPlan);
}

export async function buildGuide({ check = false } = {}) {
  const [template, ...sourceTexts] = await Promise.all([
    readFile(templatePath, "utf8"),
    ...artifacts.map(({ source }) => readFile(source, "utf8")),
  ]);

  const expectedOutputs = [
    {
      path: htmlOutputPath,
      contents: renderGuide(template, sourceTexts[0]),
    },
    ...artifacts.map(({ output }, index) => ({
      path: output,
      contents: sourceTexts[index],
    })),
  ];

  if (check) {
    const actualOutputs = await Promise.all(
      expectedOutputs.map(async ({ path: outputPath }) => {
        try {
          return await readFile(outputPath, "utf8");
        } catch (error) {
          if (error?.code === "ENOENT") return undefined;
          throw error;
        }
      }),
    );
    const stalePaths = expectedOutputs
      .filter(({ contents }, index) => actualOutputs[index] !== contents)
      .map(({ path: outputPath }) => path.relative(appRoot, outputPath));

    if (stalePaths.length > 0) {
      throw new Error(`Guide outputs are stale or missing: ${stalePaths.join(", ")}`);
    }
    return;
  }

  await Promise.all(
    expectedOutputs.map(({ path: outputPath, contents }) =>
      writeFile(outputPath, contents),
    ),
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    throw new Error("Usage: node scripts/build-project-guide.mjs [--check]");
  }
  await buildGuide({ check: args[0] === "--check" });
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(scriptPath)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
