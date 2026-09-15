"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageSquare, CheckCircle } from "@phosphor-icons/react";
import { api, errorText } from "@/components/api";
import { Action, ErrorNotice, Heading } from "@/components/common";
import type { Interview } from "@/lib/contracts";
import { useSettings } from "@/components/shell";
export default function Start() {
  const router = useRouter();
  const { settings, settingsError, refresh } = useSettings();
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [sample, setSample] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start() {
    setBusy(true);
    setError("");
    try {
      let body: BodyInit;
      if (sample) body = JSON.stringify({ sample: true, consent });
      else {
        const form = new FormData();
        form.append("photo", file!);
        form.append("consent", String(consent));
        form.append("sample", "false");
        body = form;
      }
      const r = await api<{ interview: Interview }>("/api/interviews", {
        method: "POST",
        body,
      });
      router.push(`/interview/${r.interview.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <Heading
        title="어떤 사진으로 시작할까요?"
        description="사람도, 풍경도 좋아요. 이야기하고 싶은 사진 한 장을 골라주세요."
      />
      <div className="photo-picker">
        {preview || sample ? (
          <img
            src={sample ? "/samples/spring-picnic.png" : preview}
            alt="선택한 사진 미리보기"
          />
        ) : (
          <ImageSquare size={60} weight="light" />
        )}
        <label className="upload-label">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="사진 파일 선택"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (preview) URL.revokeObjectURL(preview);
                setFile(f);
                setSample(false);
                setPreview(URL.createObjectURL(f));
              }
            }}
          />
          <span>{file ? "다른 사진 고르기" : "내 사진 고르기"}</span>
        </label>
        <p className="small muted">JPG, PNG, WebP · 최대 10MB</p>
      </div>
      <button
        className={`sample-choice ${sample ? "chosen" : ""}`}
        onClick={() => setSample(true)}
      >
        <img src="/samples/spring-picnic.png" alt="" />
        <span>
          사진이 없다면
          <br />
          <strong>가상 소풍 사진으로 체험하기</strong>
        </span>
        {sample && <CheckCircle size={26} weight="fill" />}
      </button>
      <div className="consent-box">
        <h2>시작하기 전에 알려드려요</h2>
        <p>
          사진과 확인한 글은 연결된 서버의 로컬 저장소에 남아요. 음성은 글로
          바꾼 뒤 폐기하며, 보관함에서 기록을 삭제할 수 있어요.
        </p>
        <p>
          {settings?.stt.mode === "api" || settings?.tts.mode === "api"
            ? "설정된 외부 음성 API로 음성 또는 낭독할 글을 전송합니다."
            : "현재 기본 음성 처리는 연결된 서버에서 실행됩니다."}{" "}
          AI가 만든 글은 직접 확인하고 승인해 주세요.
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>사진·음성·글의 처리 안내를 확인하고 동의해요.</span>
        </label>
      </div>
      <ErrorNotice message={error || settingsError} />
      {settingsError && (
        <Action secondary onClick={refresh}>
          처리 설정 다시 불러오기
        </Action>
      )}
      <Action
        disabled={busy || !settings || !consent || (!file && !sample)}
        onClick={start}
      >
        {busy ? "사진을 준비하고 있어요…" : "이 사진으로 이야기 시작"}
      </Action>
    </div>
  );
}
