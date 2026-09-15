"use client";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/shell";
import { api, post, errorText } from "@/components/api";
import { Action, ErrorNotice, Heading, Loading } from "@/components/common";
import { usePlayback } from "@/hooks/use-audio";
import type { Settings, Health, ProviderConfig } from "@/lib/contracts";
function ProviderFields({
  kind,
  value,
  onChange,
}: {
  kind: "stt" | "tts";
  value: ProviderConfig & { voice?: string };
  onChange: (value: ProviderConfig & { voice?: string }) => void;
}) {
  const label = kind === "stt" ? "음성을 글로 (STT)" : "글을 음성으로 (TTS)";
  return (
    <fieldset className="settings-section">
      <legend>{label}</legend>
      <label className="field">
        <span>처리 방식</span>
        <select
          value={value.mode}
          onChange={(e) =>
            onChange({
              ...value,
              mode: e.target.value as "local" | "api",
              baseUrl:
                e.target.value === "local"
                  ? "http://127.0.0.1:8765"
                  : "https://api.openai.com/v1",
              model:
                e.target.value === "local"
                  ? kind === "stt"
                    ? "small"
                    : "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
                  : kind === "stt"
                    ? "whisper-1"
                    : "gpt-4o-mini-tts",
              ...(kind === "tts"
                ? { voice: e.target.value === "local" ? "Sohee" : "alloy" }
                : {}),
            })
          }
        >
          <option value="local">로컬 모델</option>
          <option value="api">외부 API (OpenAI 호환)</option>
        </select>
      </label>
      {value.mode === "api" ? (
        <>
          <label className="field">
            <span>API 기본 URL</span>
            <input
              type="url"
              value={value.baseUrl}
              onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            />
          </label>
          <label className="field">
            <span>모델 이름</span>
            <input
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
            />
          </label>
          {kind === "tts" && (
            <label className="field">
              <span>음성 이름</span>
              <input
                value={value.voice ?? ""}
                onChange={(e) => onChange({ ...value, voice: e.target.value })}
              />
            </label>
          )}
          <label className="field">
            <span>API 키 {value.hasKey ? "(저장됨)" : "(미설정)"}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={value.apiKey ?? ""}
              placeholder="변경할 때만 입력"
              onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
            />
          </label>
          <button
            className="text-link"
            onClick={() => onChange({ ...value, apiKey: "", hasKey: false })}
          >
            저장할 때 키 삭제
          </button>
        </>
      ) : (
        <p className="muted">
          {kind === "stt"
            ? "faster-whisper small · 한국어 · CPU int8"
            : "Qwen3-TTS 0.6B CustomVoice · 한국어 Sohee"}
        </p>
      )}
    </fieldset>
  );
}
export default function SettingsPage() {
  const { settings, refresh, settingsError } = useSettings();
  const [form, setForm] = useState<Settings | null>(null),
    [health, setHealth] = useState<Health | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [testAudio, setTestAudio] = useState<File | null>(null);
  const playback = usePlayback();
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);
  useEffect(() => {
    let active = true;
    const check = () =>
      api<Health>("/api/health")
        .then((h) => {
          if (active) setHealth(h);
        })
        .catch(() => {});
    void check();
    const id = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  async function save() {
    if (!form) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await api<Settings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm(r);
      refresh();
      setMessage("설정을 저장했어요. 새 요청과 새 인터뷰에 적용됩니다.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function download(kind: "stt" | "tts") {
    setBusy(true);
    setError("");
    try {
      await post("/api/models/download", { kind });
      setMessage(
        `${kind.toUpperCase()} 다운로드를 요청했어요. 아래 준비 상태를 확인해 주세요.`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function testSTT() {
    if (!testAudio) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("audio", testAudio);
      const r = await api<{
        text: string;
        elapsedMs: number;
        provider: string;
      }>("/api/stt", { method: "POST", body: data });
      setMessage(
        `STT 테스트 (${r.provider}, ${Math.round(r.elapsedMs)}ms): ${r.text}`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!form)
    return (
      <>
        <ErrorNotice message={settingsError || error} />
        {settingsError ? (
          <Action onClick={refresh}>설정 다시 불러오기</Action>
        ) : (
          <Loading />
        )}
      </>
    );
  const status = (value?: string) =>
    ({
      ready: "준비됨",
      missing: "모델 없음",
      downloading: "다운로드 중",
      error: "오류",
    })[value ?? ""] ?? "확인 중";
  return (
    <div className="settings-page">
      <Heading
        title="나에게 편안한 설정"
        description="글씨와 기다리는 시간을 맞추고, 음성 연결을 준비해요."
      />
      <div className="settings-grid">
        <section>
          <fieldset className="settings-section">
            <legend>화면과 대화</legend>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.largeText}
                onChange={(e) =>
                  setForm({ ...form, largeText: e.target.checked })
                }
              />
              <span>큰 글씨로 보기</span>
            </label>
            <label className="field">
              <span>화면 테마</span>
              <select
                value={form.theme}
                onChange={(e) =>
                  setForm({
                    ...form,
                    theme: e.target.value as Settings["theme"],
                  })
                }
              >
                <option value="system">기기 설정 따르기</option>
                <option value="light">밝은 화면</option>
                <option value="dark">어두운 화면</option>
              </select>
            </label>
            <label className="field">
              <span>말이 없을 때 기다리는 시간</span>
              <select
                value={form.silenceSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    silenceSeconds: Number(e.target.value) as 3 | 5 | 7,
                  })
                }
              >
                <option value={3}>3초</option>
                <option value={5}>5초 (기본)</option>
                <option value={7}>7초</option>
              </select>
            </label>
            <label className="field">
              <span>기본 입력 방식</span>
              <select
                value={form.inputMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    inputMode: e.target.value as "voice" | "text",
                  })
                }
              >
                <option value="voice">말로 답하기</option>
                <option value="text">글로 답하기</option>
              </select>
            </label>
          </fieldset>
          <ProviderFields
            kind="stt"
            value={form.stt}
            onChange={(stt) => setForm({ ...form, stt })}
          />
          <ProviderFields
            kind="tts"
            value={form.tts}
            onChange={(tts) =>
              setForm({ ...form, tts: { ...tts, voice: tts.voice ?? "Sohee" } })
            }
          />
          <fieldset className="settings-section">
            <legend>질문과 회고록</legend>
            <label className="field">
              <span>Ollama URL</span>
              <input
                type="url"
                value={form.llm.baseUrl}
                onChange={(e) =>
                  setForm({
                    ...form,
                    llm: { ...form.llm, baseUrl: e.target.value },
                  })
                }
              />
            </label>
            <label className="field">
              <span>로컬 언어 모델</span>
              <input
                value={form.llm.model}
                onChange={(e) =>
                  setForm({
                    ...form,
                    llm: { ...form.llm, model: e.target.value },
                  })
                }
              />
            </label>
            <p className="small muted">
              연결되지 않으면 안내 질문과 원문 정리 모드로 표시해요.
            </p>
          </fieldset>
          <fieldset className="settings-section">
            <legend>선택 삽화 API</legend>
            <label className="field">
              <span>이미지 모델</span>
              <input
                value={form.image.model}
                onChange={(e) =>
                  setForm({
                    ...form,
                    image: { ...form.image, model: e.target.value },
                  })
                }
              />
            </label>
            <label className="field">
              <span>
                OpenAI API 키 {form.image.hasKey ? "(저장됨)" : "(미설정)"}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.image.apiKey ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    image: { ...form.image, apiKey: e.target.value },
                  })
                }
              />
            </label>
            <button
              className="text-link"
              onClick={() =>
                setForm({
                  ...form,
                  image: { ...form.image, apiKey: "", hasKey: false },
                })
              }
            >
              저장할 때 이미지 키 삭제
            </button>
            <p className="small muted">
              설명 입력 후 생성 버튼을 누를 때만 외부 API를 사용해요.
            </p>
          </fieldset>
        </section>
        <aside>
          <section className="settings-section">
            <h2>연결과 모델 준비</h2>
            <p>
              로컬 모델은 이 휴대폰이 아닌 연결된 서버에서 실행돼요. 음성 모델
              다운로드에는 디스크 여유가 필요해요.
            </p>
            <dl className="health-list">
              <div>
                <dt>음성 서버</dt>
                <dd>
                  {health
                    ? health.speech.online
                      ? "연결됨"
                      : "연결되지 않음"
                    : "확인 중"}
                </dd>
              </div>
              <div>
                <dt>STT 모델</dt>
                <dd>{status(health?.speech.stt.status)}</dd>
              </div>
              <div>
                <dt>TTS 모델</dt>
                <dd>{status(health?.speech.tts.status)}</dd>
              </div>
              <div>
                <dt>언어 모델</dt>
                <dd>
                  {health
                    ? health.llm.online
                      ? "연결됨"
                      : "안내 질문 사용"
                    : "확인 중"}
                </dd>
              </div>
            </dl>
            {health?.speech.stt.detail && (
              <p className="small wrap">STT: {health.speech.stt.detail}</p>
            )}
            {health?.speech.tts.detail && (
              <p className="small wrap">TTS: {health.speech.tts.detail}</p>
            )}
            <Action
              secondary
              disabled={busy || health?.speech.stt.status === "downloading"}
              onClick={() => download("stt")}
            >
              STT 모델 다운로드 / 재시도
            </Action>
            <Action
              secondary
              disabled={busy || health?.speech.tts.status === "downloading"}
              onClick={() => download("tts")}
            >
              TTS 모델 다운로드 / 재시도
            </Action>
          </section>
          <section className="settings-section">
            <h2>저장한 연결 테스트</h2>
            <p>
              먼저 설정을 저장해 주세요. 외부 API 선택 시 테스트 음성·글이 해당
              공급자에게 전송됩니다.
            </p>
            <label className="field">
              <span>STT 테스트 음성 파일</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setTestAudio(e.target.files?.[0] ?? null)}
              />
            </label>
            <Action secondary disabled={busy || !testAudio} onClick={testSTT}>
              음성을 글로 테스트
            </Action>
            <Action
              secondary
              onClick={() =>
                playback.playing
                  ? playback.stop()
                  : void playback.speak(
                      "안녕하세요. 기억의 조각입니다. 천천히 이야기해 주세요.",
                    )
              }
            >
              {playback.playing
                ? "테스트 음성 중단"
                : "한국어 음성 듣기 테스트"}
            </Action>
            <ErrorNotice message={playback.error} />
            {playback.elapsedMs !== null && !playback.error && (
              <p role="status" className="small">
                음성 파일 응답: {playback.elapsedMs}ms. 재생이 끝나면 연결
                테스트가 완료돼요.
              </p>
            )}
          </section>
          <section className="settings-section">
            <h2>앱으로 사용하기</h2>
            <p>
              iPhone Safari에서 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택해
              주세요. Android는 브라우저 메뉴의 ‘앱 설치’를 이용하세요.
            </p>
            <p className="small muted">
              오프라인에서는 안내 화면만 볼 수 있어요. 기록과 AI 기능은 서버
              연결이 필요해요. 휴대폰 마이크는 HTTPS 연결이 필요합니다.
            </p>
          </section>
        </aside>
      </div>
      <div className="settings-save">
        <ErrorNotice message={error} />
        {message && (
          <p role="status" className="success-message">
            {message}
          </p>
        )}
        <Action disabled={busy} onClick={save}>
          {busy ? "처리 중…" : "설정 저장"}
        </Action>
      </div>
    </div>
  );
}
