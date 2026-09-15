import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository } from "../src/server/repository";
import {
  validateBaseUrl,
  checkOrigin,
  boundedRequest,
} from "../src/server/security";

test("owner isolation, idempotent turns, immutable original and durable revisions", () => {
  const dir = mkdtempSync(join(tmpdir(), "memory-test-"));
  const repo = new Repository(dir);
  const a = repo.create("owner-a", "/sample.png", true);
  repo.saveSettings("owner-a", {
    llm: { model: "a-new-model" },
    tts: { apiKey: "new-owner-key" },
  });
  assert.equal(
    repo.raw("owner-a", a.id).settingsSnapshot.llm.model,
    "qwen3:4b",
  );
  assert.equal("settingsSnapshot" in repo.get("owner-a", a.id), false);
  assert.equal(repo.settings("owner-b").tts.hasKey, false);
  assert.throws(() => repo.get("owner-b", a.id), /찾을/);
  repo.addTurn("owner-a", a.id, "첫 원문", "request-1");
  repo.addTurn("owner-a", a.id, "다른 중복", "request-1");
  let row = repo.get("owner-a", a.id);
  assert.equal(row.fragments.length, 1);
  repo.revise("owner-a", a.id, row.fragments[0].id, "수정 원문");
  repo.close();
  const reopened = new Repository(dir);
  row = reopened.get("owner-a", a.id);
  assert.equal(row.fragments[0].original, "첫 원문");
  assert.equal(row.fragments[0].text, "수정 원문");
  assert.deepEqual(row.fragments[0].revisions, ["수정 원문"]);
  reopened.saveSettings("owner-a", { stt: { apiKey: "secret-test-key" } });
  assert.equal(reopened.settings("owner-a").stt.hasKey, true);
  assert.equal(reopened.settings("owner-a").stt.apiKey, undefined);
  assert.ok(
    !readFileSync(join(dir, "memory.sqlite")).includes(
      Buffer.from("secret-test-key"),
    ),
  );
  const generation = reopened.beginGeneration("owner-a", a.id, "memoir");
  reopened.revise("owner-a", a.id, row.fragments[0].id, "새 수정");
  assert.equal(
    reopened.finishMemoir("owner-a", a.id, generation, "낡은 초안", []),
    false,
  );
  const fresh = reopened.beginGeneration("owner-a", a.id, "memoir");
  assert.equal(
    reopened.finishMemoir("owner-a", a.id, fresh, "새 수정", [
      { fragmentId: row.fragments[0].id, revision: 2 },
    ]),
    true,
  );
  reopened.revise("owner-a", a.id, row.fragments[0].id, "또 수정");
  assert.throws(
    () => reopened.approveMemoir("owner-a", a.id, "새 수정"),
    /원문/,
  );
  reopened.remove("owner-a", a.id);
  assert.throws(() => reopened.get("owner-a", a.id));
  reopened.close();
});

test("chunked request cannot bypass body size limit", async () => {
  await assert.rejects(
    () =>
      boundedRequest(
        new Request("http://localhost/api", {
          method: "POST",
          body: "oversized",
        }),
        4,
      ),
    /너무/,
  );
});

test("SSRF and same-origin mutation protections", () => {
  assert.throws(() => validateBaseUrl("http://169.254.169.254/latest", "api"));
  assert.throws(() => validateBaseUrl("https://127.0.0.1", "api"));
  assert.throws(() => validateBaseUrl("https://evil.example", "api"));
  assert.equal(
    validateBaseUrl("http://127.0.0.1:8765", "local"),
    "http://127.0.0.1:8765",
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/settings", {
        method: "PUT",
        headers: { origin: "http://evil.example" },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/settings", {
        method: "PUT",
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/settings", {
        method: "PUT",
        headers: { host: "127.0.0.1:3000", origin: "http://evil.example" },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/settings", {
        method: "PUT",
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:9999" },
      }),
    ),
  );
});
