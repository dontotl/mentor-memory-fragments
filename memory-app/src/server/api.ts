import { readFile } from "node:fs/promises";
import { repository } from "./repository";
import {
  AppError,
  checkOrigin,
  nonempty,
  ownerSession,
  boundedRequest,
} from "./security";
import { interviewRoute } from "./interviews";
import { health, providerFetch, speech } from "./providers";
import { savePhoto } from "./media";
export async function handleApi(req: Request, parts: string[]) {
  const session = ownerSession(req);
  let response: Response;
  try {
    checkOrigin(req);
    const size = Number(req.headers.get("content-length") ?? 0);
    if (size > 16 * 1024 * 1024)
      throw new AppError("전송 파일이 너무 큽니다.", 413);
    req = await boundedRequest(req);
    const repo = repository(),
      owner = session.owner,
      path = parts.join("/");
    if (parts[0] === "interviews")
      response = await interviewRoute(req, owner, parts, repo);
    else if (path === "settings" && req.method === "GET")
      response = Response.json(repo.settings(owner));
    else if (path === "settings" && req.method === "PUT")
      response = Response.json(repo.saveSettings(owner, await req.json()));
    else if (path === "health" && req.method === "GET")
      response = Response.json(await health(repo.settings(owner, true)));
    else if (parts[0] === "media" && parts[1] && req.method === "GET") {
      const media = repo.media(owner, parts[1]);
      response = new Response(await readFile(media.path), {
        headers: {
          "content-type": media.mime,
          "x-content-type-options": "nosniff",
        },
      });
    } else if (path === "tts" && req.method === "POST") {
      const b = await req.json(),
        text = nonempty(b.text, 5000);
      const settings = b.interviewId
        ? repo.raw(owner, b.interviewId).settingsSnapshot
        : repo.settings(owner, true);
      const audio = await speech(settings, "tts", text);
      response = new Response(await audio.arrayBuffer(), {
        headers: {
          "content-type": audio.headers.get("content-type") ?? "audio/wav",
        },
      });
    } else if (path === "stt" && req.method === "POST") {
      const b = await req.formData(),
        audio = b.get("audio");
      if (
        !(audio instanceof File) ||
        !audio.size ||
        audio.size > 15 * 1024 * 1024
      )
        throw new AppError("15MB 이하의 녹음을 전송해 주세요.");
      const id = b.get("interviewId"),
        settings =
          typeof id === "string" && id
            ? repo.raw(owner, id).settingsSnapshot
            : repo.settings(owner, true),
        start = Date.now();
      const r = await speech(settings, "stt", audio),
        result = await r.json();
      if (typeof result.text !== "string")
        throw new AppError("음성 서비스의 전사 결과가 올바르지 않습니다.", 502);
      response = Response.json({
        text: result.text,
        provider: settings.stt.mode,
        elapsedMs: Date.now() - start,
      });
    } else if (path === "models/download" && req.method === "POST") {
      const b = await req.json();
      if (!["stt", "tts"].includes(b.kind))
        throw new AppError("다운로드할 모델을 선택해 주세요.");
      const r = await providerFetch(
        "http://127.0.0.1:8765/models/download",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: b.kind }),
        },
        10000,
      );
      response = Response.json(await r.json());
    } else if (path === "image" && req.method === "POST") {
      const b = await req.json(),
        prompt = nonempty(b.prompt, 2000),
        id = nonempty(b.interviewId, 128);
      const settings = repo.raw(owner, id).settingsSnapshot;
      if (!settings.image.apiKey)
        throw new AppError(
          "새 인터뷰를 시작하기 전에 이미지 API 키를 설정해 주세요.",
        );
      const r = await providerFetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${settings.image.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: settings.image.model,
            prompt,
            n: 1,
            size: "1024x1024",
          }),
        },
        180000,
      );
      const result = await r.json(),
        encoded = result.data?.[0]?.b64_json;
      if (typeof encoded !== "string")
        throw new AppError("이미지 응답이 올바르지 않습니다.", 502);
      repo.get(owner, id);
      const media = await savePhoto(
        repo,
        owner,
        Buffer.from(encoded, "base64"),
        id,
      );
      response = Response.json({ url: media.url });
    } else throw new AppError("요청 경로를 찾을 수 없습니다.", 404);
  } catch (e) {
    response = Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : e instanceof SyntaxError
              ? "요청 형식이 올바르지 않습니다."
              : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
      },
      {
        status:
          e instanceof AppError
            ? e.status
            : e instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Cookie");
  if (session.fresh)
    response.headers.append(
      "Set-Cookie",
      `memory_owner=${session.owner}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
    );
  return response;
}
