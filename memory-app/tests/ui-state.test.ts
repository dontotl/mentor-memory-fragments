import test from "node:test";
import assert from "node:assert/strict";
import { speechChunks, turnIdentity } from "../src/hooks/audio-state";
test("long Korean memoir speech keeps every character within local runtime limit", () => {
  const text = "어머니와 함께 소풍을 갔어요. ".repeat(150);
  const chunks = speechChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 451));
  assert.equal(chunks.join(""), text.trim());
});
test("retry preserves request identity; edited text creates a new identity", () => {
  const first = turnIdentity(null, "기억", () => "first");
  assert.equal(turnIdentity(first, "기억", () => "second").id, "first");
  assert.equal(turnIdentity(first, "다른 기억", () => "second").id, "second");
});
