import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { defaults } from "../src/server/settings";
import { nextQuestion, memoirDraft, speech } from "../src/server/providers";

test("provider boundary handles Ollama, grounded memoir and local STT/TTS responses", async () => {
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.url === "/api/chat") {
      const payload = JSON.parse(body);
      assert.equal(payload.think, false);
      const content =
        payload.format === "json"
          ? JSON.stringify({ ids: ["fragment-a"] })
          : "그날 무엇이 가장 기억에 남으세요?";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ message: { content } }));
    } else if (req.url === "/stt") {
      assert.match(body, /name="audio"/);
      res.end(JSON.stringify({ text: "봄 소풍을 갔어요." }));
    } else if (req.url === "/tts") {
      assert.equal(JSON.parse(body).text, "안녕하세요");
      res.setHeader("content-type", "audio/wav");
      res.end(Buffer.from("RIFFtestWAVE"));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as { port: number }).port,
      settings = structuredClone(defaults),
      base = `http://127.0.0.1:${port}`;
    settings.llm.baseUrl = base;
    settings.llm.model = 'qwen2.5:3b';
    settings.stt.baseUrl = base;
    settings.tts.baseUrl = base;
    const fragments = [
      {
        id: "fragment-a",
        original: "봄 소풍을 갔어요.",
        text: "봄 소풍을 갔어요.",
        revisions: [],
        createdAt: "2026-01-01",
      },
    ];
    const q = await nextQuestion(settings, fragments);
    assert.equal(q.source, "ollama");
    assert.match(q.text, /기억/);
    const m = await memoirDraft(settings, fragments);
    assert.equal(m.text, "봄 소풍을 갔어요.");
    assert.deepEqual(m.sources, [{ fragmentId: "fragment-a", revision: 0 }]);
    const stt = await speech(
      settings,
      "stt",
      new File(["audio-fixture"], "sample.wav", { type: "audio/wav" }),
    );
    assert.equal((await stt.json()).text, "봄 소풍을 갔어요.");
    const tts = await speech(settings, "tts", "안녕하세요");
    assert.equal(tts.headers.get("content-type"), "audio/wav");
    assert.equal(await tts.text(), "RIFFtestWAVE");
    settings.llm.baseUrl = base + "/missing";
    assert.equal((await nextQuestion(settings, fragments)).source, "guided");
    assert.equal(
      (await memoirDraft(settings, fragments)).text,
      fragments[0].text,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Qwen3 budgets thinking separately and exposes only validated final content',async()=>{
 const originalFetch=globalThis.fetch, settings=structuredClone(defaults);
 const fragments=[{id:'source-one',original:'봄에 소풍을 갔어요.',text:'봄에 소풍을 갔어요.',revisions:[],createdAt:'2026-01-01'}];
 let leak=false;
 globalThis.fetch=async(_input,init)=>{
  const payload=JSON.parse(init!.body as string);
  assert.equal(payload.think,true);assert.equal(payload.options.num_predict,1024);
  const content=payload.format==='json'?JSON.stringify({ids:['source-one']}):leak?'<think>private reasoning</think> 무엇이 기억나세요?':'소풍에서 무엇이 가장 기억나세요?';
  return Response.json({message:{content,thinking:'private model analysis not for output'}});
 };
 try{
  assert.deepEqual(await nextQuestion(settings,fragments),{text:'소풍에서 무엇이 가장 기억나세요?',source:'ollama'});
  const draft=await memoirDraft(settings,fragments);assert.equal(draft.source,'ollama');assert.equal(draft.text,'봄에 소풍을 갔어요.');assert.ok(!JSON.stringify(draft).includes('private'));
  leak=true;assert.equal((await nextQuestion(settings,fragments)).source,'guided');
 }finally{globalThis.fetch=originalFetch;}
});

test("OpenAI-compatible speech adapters send server-only keys and correct API fields", async () => {
  const originalFetch = globalThis.fetch,
    settings = structuredClone(defaults);
  settings.stt = {
    mode: "api",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    apiKey: "fixture-secret",
  };
  settings.tts = {
    mode: "api",
    baseUrl: "https://api.openai.com/v1",
    model: "tts-1",
    voice: "alloy",
    apiKey: "fixture-secret",
  };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(
      (init!.headers as Record<string, string>).authorization,
      "Bearer fixture-secret",
    );
    assert.equal(init!.redirect, "error");
    if (url.endsWith("/audio/transcriptions")) {
      const form = init!.body as FormData;
      assert.equal(form.get("model"), "whisper-1");
      assert.equal(form.get("language"), "ko");
      assert.ok(form.get("file") instanceof File);
      return Response.json({ text: "API 전사" });
    }
    assert.equal(url, "https://api.openai.com/v1/audio/speech");
    assert.deepEqual(JSON.parse(init!.body as string), {
      model: "tts-1",
      input: "반갑습니다",
      voice: "alloy",
      response_format: "wav",
    });
    return new Response("RIFF", { headers: { "content-type": "audio/wav" } });
  };
  try {
    const transcription = await speech(
      settings,
      "stt",
      new File(["fixture"], "a.wav"),
    );
    assert.equal((await transcription.json()).text, "API 전사");
    const audio = await speech(settings, "tts", "반갑습니다");
    assert.equal(await audio.text(), "RIFF");
    settings.stt.apiKey = "";
    await assert.rejects(
      () => speech(settings, "stt", new File(["fixture"], "a.wav")),
      /키/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
