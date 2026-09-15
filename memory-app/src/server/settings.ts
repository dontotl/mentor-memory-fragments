import type { Settings } from "../lib/contracts";
import { AppError, validateBaseUrl } from "./security";
export const defaults: Settings = {
  largeText: true,
  theme: "light",
  silenceSeconds: 5,
  inputMode: "voice",
  stt: { mode: "local", baseUrl: "http://127.0.0.1:8765", model: "small" },
  tts: {
    mode: "local",
    baseUrl: "http://127.0.0.1:8765",
    model: "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    voice: "Sohee",
  },
  llm: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
  image: { model: "gpt-image-1" },
};
export function mergeSettings(previous: Settings, patch: any): Settings {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new AppError("설정 형식이 잘못되었습니다.");
  const next: Settings = {
    ...previous,
    ...Object.fromEntries(
      ["largeText", "theme", "silenceSeconds", "inputMode"]
        .filter((k) => k in patch)
        .map((k) => [k, patch[k]]),
    ),
    stt: { ...previous.stt, ...patch.stt },
    tts: { ...previous.tts, ...patch.tts },
    llm: { ...previous.llm, ...patch.llm },
    image: { ...previous.image, ...patch.image },
  };
  if (
    typeof next.largeText !== "boolean" ||
    !["light", "dark", "system"].includes(next.theme) ||
    ![3, 5, 7].includes(next.silenceSeconds) ||
    !["voice", "text"].includes(next.inputMode)
  )
    throw new AppError("설정 값이 올바르지 않습니다.");
  for (const p of [next.stt, next.tts]) {
    if (!["local", "api"].includes(p.mode))
      throw new AppError("음성 모드를 확인해 주세요.");
    p.baseUrl = validateBaseUrl(p.baseUrl, p.mode);
    if (typeof p.model !== "string" || p.model.length > 200)
      throw new AppError("모델 이름을 확인해 주세요.");
    if (
      p.apiKey !== undefined &&
      (typeof p.apiKey !== "string" || p.apiKey.length > 1000)
    )
      throw new AppError("키 형식을 확인해 주세요.");
  }
  next.llm.baseUrl = validateBaseUrl(next.llm.baseUrl, "local");
  if (
    typeof next.llm.model !== "string" ||
    next.llm.model.length > 200 ||
    typeof next.image.model !== "string" ||
    next.image.model.length > 200 ||
    typeof next.tts.voice !== "string" ||
    next.tts.voice.length > 100
  )
    throw new AppError("모델 또는 음성 이름을 확인해 주세요.");
  if (
    next.image.apiKey !== undefined &&
    (typeof next.image.apiKey !== "string" || next.image.apiKey.length > 1000)
  )
    throw new AppError("키 형식을 확인해 주세요.");
  return next;
}
export function redactSettings(settings: Settings): Settings {
  const copy = structuredClone(settings);
  for (const p of [copy.stt, copy.tts, copy.image]) {
    p.hasKey = !!p.apiKey;
    delete p.apiKey;
  }
  return copy;
}
