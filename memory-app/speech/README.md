# 로컬 한국어 음성 서비스

`127.0.0.1:8765` 전용 FastAPI 서비스입니다. Next.js 서버에서 프록시하며 외부 네트워크에 직접 노출하지 않습니다. STT는 faster-whisper small CPU int8, TTS는 Qwen3-TTS 0.6B CustomVoice의 Korean / Sohee 고정 음성입니다. 음성 복제는 하지 않습니다.

## 설치와 실행

Python 3.11과 디스크 여유 8 GB 이상을 준비합니다. 모델, 패키지, 캐시는 이 앱의 `models/`, `.venv/`에만 놓습니다. 사용자 음성은 메모리에서 처리하고 저장하지 않습니다. 임시 multipart 스풀은 프레임워크가 닫습니다.

```sh
cd memory-app
sh scripts/setup-speech.sh
.venv/bin/python -m uvicorn speech.service:app --host 127.0.0.1 --port 8765
```

앱 설정에서 STT / TTS를 각각 다운로드합니다. 또는 별도 터미널에서 `.venv/bin/python -m speech.download`로 두 모델을 순차 다운로드·로드합니다. HTTP 서비스가 동시에 실행 중이면 CLI 대신 설정 다운로드를 사용하세요. CLI 설치 후 서비스 재시작이 필요합니다. 설치 스크립트의 Python 선택은 `SPEECH_PYTHON=/opt/homebrew/bin/python3.11`로 지정할 수 있습니다.

다운로드는 Hugging Face의 고정 허용 목록 `Systran/faster-whisper-small`, `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`만 사용합니다. JSON/가중치/토크나이저를 로컬 디렉터리에 받으며 Qwen의 `speech_tokenizer/*`도 포함합니다. 다운로드에 인터넷이 필요하며 추론에는 로컬 경로와 `local_files_only=True`를 사용합니다. 다른 공급자로 자동 전환하지 않습니다. 별도 Object Storage나 유료 API를 사용하지 않습니다.

## 계약과 처리 범위

- `GET /health`: `{stt:{status,detail,model,path,filesReceived},tts:{...}}`. `status`는 `missing`, `downloading`, `ready`, `error`. 파일 존재만으로 ready로 표시하지 않고 런타임 모델 로드에 성공해야 합니다. 기존 모델 검증·로드 중에는 downloading과 상세 안내를 표시합니다.
- `POST /models/download`: `{kind:"stt"|"tts"}` → 202 `{status}`. 한 작업자로 직렬 다운로드하며 중복 요청은 기존 작업 상태를 반환합니다. 잘못된 종류·추가 필드는 422, 디스크 부족·로드 실패는 health의 error로 표시합니다. 완료 파일 수는 바이트 진행률이 아닙니다.
- `POST /stt`: multipart `audio` → `{text,provider,elapsedMs}`. 12 MB / 120초 이하, 한국어 고정. PyAV 로컬 디코딩 후 추론합니다.
- `POST /tts`: `{text}` → PCM16 WAV, `X-Elapsed-Ms` 헤더. 공백을 제외한 1~500자. 긴 회고록은 클라이언트에서 문장 단위 요청해야 합니다.
- 오류는 `{error}`. 준비 안 됨 503, 다른 추론 진행 중 429, 잘못된 입력 422, 용량 초과 413. 브라우저 Origin이 있는 직접 변경 요청은 403입니다.

추론은 STT/TTS 통틀어 한 번에 하나, CPU 스레드는 최대 4개입니다. TTS 생성 최대 토큰 수는 1536입니다. 이 서버는 전체 WAV 완성 후 전송하며 토큰 스트리밍이 아닙니다. STT도 녹음 구간을 완성한 뒤 전사합니다. 클라이언트 재생 취소는 이미 실행 중인 CPU 추론을 선점 중단하지 않습니다. 짧은 질문 우선 및 늦은 응답 무시 처리는 앱에서 수행합니다.

## 검증 기록 — 2026-09-14

장비: Apple M1 Pro, 논리 코어 8개, 메모리 16 GB, macOS arm64, Python 3.11.14. 일반 x86 CPU 서버 성능으로 환산하지 않습니다.

실제 설치를 시도했으나 onnxruntime 의존성 압축 해제 중 `No space left on device`가 발생했습니다. 최초 확인 여유 공간 346 MiB. 이번 시도에서 만든 실패 uv 캐시만 `uv cache clean`으로 222.3 MiB 제거했으며 패키지를 다시 다운로드하면 복구됩니다. 이후 여유 공간 약 958 MiB여서 모델 다운로드를 진행하지 않았습니다. 사용자 파일은 삭제하지 않았습니다.

이후 여유 공간이 9.4 GiB로 확보되어 설치를 재개했습니다. 전체 requirements 설치가 완료됐고 Torch/torchaudio는 동일 버전 2.8.0입니다. STT 가중치 464 MiB, Qwen TTS 및 speech tokenizer 2.3 GiB를 다운로드하고 두 모델 로드에 성공했습니다. 전체 `.venv` 약 1.1 GiB, speech 모델 약 2.8 GiB입니다.

재현 버전: faster-whisper 1.2.1, CTranslate2 4.8.2, qwen-tts 0.1.1, transformers 4.57.3, torch/torchaudio 2.8.0. 모델 revision은 STT `536b0662742c02347bc0e980a01041f333bce120`, TTS `85e237c12c027371202489a0ec509ded67b5e4b5`로 다운로드 코드에 고정했습니다.

첫 실제 합성 smoke: “봄에 가족과 소풍을 갔어요. 어머니가 싸 주신 김밥을 먹었어요.”를 Korean / Sohee로 생성했습니다. PCM16 WAV 24 kHz, 8.24초 오디오 생성에 서버 41.230초 / HTTP wall 41.258초가 걸렸습니다. 그 WAV의 STT는 2.517초로 “봄의 가족과 소풍을 갔어요. 어머니가 싸주신 김밥을 먹었어요.”를 반환했습니다. `봄에→봄의` 조사 오인식이 있으며 사용자의 전사 확인·수정이 필요합니다. TTS 처리시간은 오디오 길이의 약 5배입니다. 이는 1회 합성 smoke이며 p50/p95 통계가 아닙니다. 원기획의 1.5초/3초 지연 목표를 달성했다고 볼 수 없습니다.

`HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1`로 서비스를 재시작해 두 모델이 로컬 파일만으로 다시 ready가 되는 것을 확인했습니다. 다운로드가 필요한 최초 설치에는 이 플래그를 설정하지 않습니다. 로드 시 선택적인 SoX/flash-attn 미설치 경고가 있지만 이 CustomVoice 생성 경로는 실제 성공했습니다. Apple Silicon CPU SDPA float32 실행이며 GPU/MPS 최적화는 적용하지 않았습니다.

오프라인 모드에서 두 번째 실제 합성·전사도 성공했습니다. 같은 문장의 24 kHz / 7.60초 WAV를 서버 42.229초 / HTTP wall 42.258초에 생성했고 STT 2.711초, 결과는 “봄에 가족과 소풍을 갔어요 어머니가 싸주신 김밥을 먹었어요”였습니다. 현재 `models/smoke/report.json`은 이 두 번째 결과입니다. 샘플링 기반 TTS이므로 길이·전사 결과가 반복마다 달라질 수 있습니다. 실측 중 다른 로컬 서비스 작업이 병행되어 단독 프로세스 벤치마크도 아닙니다.

실행 검증: `.venv/bin/python -m pytest tests/speech_test.py -q` → 9 passed (Starlette/httpx 및 anyio upstream deprecation warning 2개). 누락 모델, 임의 모델·경로 차단, 빈/과대 입력, cross-origin 요청, 디스크 부족, 불완전 파일, 동시 추론 거절을 확인했습니다. Live HTTP `/health`는 missing을 반환했고 TTS는 503, 다운로드 시도는 202 후 error로 실제 디스크 부족 상세를 반환했습니다. 셸 문법 검사 및 Python compileall 통과.

공간 확보 후 설치 → 서비스 실행 → 두 모델 ready 확인 → 아래 합성 smoke를 실행합니다.

```sh
.venv/bin/python -m speech.smoke
```

이 검증은 가상의 소풍 문장을 Sohee로 생성하고 그 WAV를 Whisper에 입력합니다. 결과는 git 제외 `models/smoke/synthetic-sohee.wav`, `report.json`에 저장하며 샘플레이트·오디오 길이·TTS wall time·STT 결과와 시간을 기록합니다. 어르신 실제 음성이나 휴대폰 마이크 품질 검증이 아닙니다. 합성 결과물이 로컬에 생성되어 있으며 재실행하면 최신 smoke로 교체됩니다.

공식 근거: [Qwen3-TTS 코드와 사용법](https://github.com/QwenLM/Qwen3-TTS), [CustomVoice 모델](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
