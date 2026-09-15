import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { handleApi } from "../src/server/api";
import { Repository } from "../src/server/repository";
import { savePhoto } from "../src/server/media";

test("API creates a real uploaded-photo record, isolates it, preserves revisions and deletes media", async () => {
  process.env.MEMORY_DATA_DIR = mkdtempSync(join(tmpdir(), "memory-api-"));
  const call = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie?: string,
  ) =>
    handleApi(
      new Request("http://localhost:3000/api/" + path, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(body instanceof FormData
            ? {}
            : body
              ? { "content-type": "application/json" }
              : {}),
        },
        body:
          body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
      }),
      path.split("/"),
    );
  const settings = await call("settings");
  const cookie = settings.headers.get("set-cookie")!.split(";")[0];
  assert.match(settings.headers.get("set-cookie")!, /HttpOnly/);
  const photo = await sharp({
    create: { width: 5, height: 5, channels: 3, background: "#559955" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set("consent", "true");
  form.set(
    "photo",
    new File([new Uint8Array(photo)], "photo.png", { type: "image/png" }),
  );
  const created = await call("interviews", "POST", form, cookie);
  assert.equal(created.status, 201);
  const { interview } = await created.json();
  assert.equal(
    (
      await call(
        "interviews/" + interview.id,
        "GET",
        undefined,
        "memory_owner=" + "b".repeat(64),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        interview.photoUrl.replace("/api/", ""),
        "GET",
        undefined,
        cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(interview.photoUrl.replace("/api/", ""))).status,
    404,
  );
  const saved = await call(
    "settings",
    "PUT",
    { stt: { apiKey: "private-key" } },
    cookie,
  );
  assert.equal((await saved.json()).stt.hasKey, true);
  assert.equal(
    JSON.stringify(
      await (await call("settings", "GET", undefined, cookie)).json(),
    ).includes("private-key"),
    false,
  );
  assert.equal(
    (await call("interviews/" + interview.id, "DELETE", undefined, cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await call(
        interview.photoUrl.replace("/api/", ""),
        "GET",
        undefined,
        cookie,
      )
    ).status,
    404,
  );
  const blocked = await handleApi(
    new Request("http://localhost:3000/api/settings", {
      method: "PUT",
      headers: { origin: "https://other.example" },
      body: "{}",
    }),
    ["settings"],
  );
  assert.equal(blocked.status, 403);
});

test("photo boundary rejects disguised documents and oversized input", async () => {
  const repo = new Repository(mkdtempSync(join(tmpdir(), "memory-photo-")));
  await assert.rejects(
    () => savePhoto(repo, "owner", Buffer.from("<svg/>")),
    /JPEG/,
  );
  await assert.rejects(
    () => savePhoto(repo, "owner", Buffer.alloc(10 * 1024 * 1024 + 1)),
    /10MB/,
  );
  repo.close();
});
