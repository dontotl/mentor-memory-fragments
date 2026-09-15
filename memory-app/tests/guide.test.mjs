import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderGuide } from "../scripts/build-project-guide.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_SOURCE = path.join(APP_ROOT, "scripts", "build-project-guide.mjs");

const INPUTS = {
  "docs/superpowers/plans/2026-09-14-memory-pwa.md": "계획 $& <script>\n",
  "docs/verification.md": "검증 & 확인\n",
  "docs/superpowers/specs/2026-09-15-project-landing-enhancement-design.md":
    "향상 설계 <strong>문서</strong>\n",
};

function makeFixture({ omitInput } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "memory-guide-"));
  const appRoot = path.join(root, "memory-app");
  const script = path.join(appRoot, "scripts", "build-project-guide.mjs");

  mkdirSync(path.dirname(script), { recursive: true });
  mkdirSync(path.join(appRoot, "guide"), { recursive: true });
  mkdirSync(path.join(appRoot, "public"), { recursive: true });
  copyFileSync(SCRIPT_SOURCE, script);
  writeFileSync(
    path.join(appRoot, "guide", "project.template.html"),
    "<!doctype html><pre id=\"plan-source\">{{PLAN_SOURCE}}</pre>\n",
  );

  for (const [relativePath, contents] of Object.entries(INPUTS)) {
    if (relativePath === omitInput) continue;
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  return { root, appRoot, script };
}

function runCli(fixture, args = []) {
  return spawnSync(process.execPath, [fixture.script, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
}

test("renderGuide escapes untrusted Markdown once and requires one marker", () => {
  assert.equal(
    renderGuide("<pre>{{PLAN_SOURCE}}</pre>", '<script>&"\''),
    "<pre>&lt;script&gt;&amp;&quot;&#39;</pre>",
  );
  assert.equal(renderGuide("{{PLAN_SOURCE}}", "$&"), "$&amp;");
  assert.throws(() => renderGuide("<pre>missing</pre>", "text"));
  assert.throws(() => renderGuide("{{PLAN_SOURCE}}{{PLAN_SOURCE}}", "text"));
});

test("CLI builds exact Markdown copies and byte-identical escaped HTML", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const first = runCli(fixture);
  assert.equal(first.status, 0, first.stderr);

  const publicRoot = path.join(fixture.appRoot, "public");
  assert.equal(
    readFileSync(path.join(publicRoot, "project-plan.md"), "utf8"),
    INPUTS["docs/superpowers/plans/2026-09-14-memory-pwa.md"],
  );
  assert.equal(
    readFileSync(path.join(publicRoot, "project-verification.md"), "utf8"),
    INPUTS["docs/verification.md"],
  );
  assert.equal(
    readFileSync(path.join(publicRoot, "project-enhancement-design.md"), "utf8"),
    INPUTS["docs/superpowers/specs/2026-09-15-project-landing-enhancement-design.md"],
  );

  const htmlPath = path.join(publicRoot, "project.html");
  const firstHtml = readFileSync(htmlPath, "utf8");
  assert.equal(
    firstHtml,
    "<!doctype html><pre id=\"plan-source\">계획 $&amp; &lt;script&gt;\n</pre>\n",
  );

  const second = runCli(fixture);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(htmlPath, "utf8"), firstHtml);
});

test("--check reports stale and missing outputs without changing files", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  execFileSync(process.execPath, [fixture.script]);

  const htmlPath = path.join(fixture.appRoot, "public", "project.html");
  writeFileSync(htmlPath, "stale output\n");
  const stale = runCli(fixture, ["--check"]);
  assert.notEqual(stale.status, 0);
  assert.equal(readFileSync(htmlPath, "utf8"), "stale output\n");

  const missingPath = path.join(fixture.appRoot, "public", "project-verification.md");
  unlinkSync(missingPath);
  const missing = runCli(fixture, ["--check"]);
  assert.notEqual(missing.status, 0);
  assert.equal(readFileSync(htmlPath, "utf8"), "stale output\n");
  assert.throws(() => readFileSync(missingPath));
});

test("CLI rejects unknown arguments", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = runCli(fixture, ["--output", "elsewhere"]);
  assert.notEqual(result.status, 0);
});

test("CLI reads every input before it writes any output", (t) => {
  const missingInput =
    "docs/superpowers/specs/2026-09-15-project-landing-enhancement-design.md";
  const fixture = makeFixture({ omitInput: missingInput });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const sentinelPath = path.join(fixture.appRoot, "public", "project.html");
  writeFileSync(sentinelPath, "existing output\n");
  const result = runCli(fixture);

  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(sentinelPath, "utf8"), "existing output\n");
  assert.throws(() =>
    readFileSync(path.join(fixture.appRoot, "public", "project-plan.md")),
  );
});
