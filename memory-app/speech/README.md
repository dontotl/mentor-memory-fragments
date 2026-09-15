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

## 성능과 검증 범위

CPU 환경에서 실시간 응답을 보장하지 않습니다. 합성 음성을 이용한 과거 측정 결과와 미검증 범위는 [PRD](../../docs/PRD.md)의 §8을 참고하세요. 실제 어르신 음성·휴대폰 마이크와 유료 공급자는 별도 검증 대상입니다.

로컬 음성 경계 테스트는 `.venv/bin/python -m pytest tests/speech_test.py -q`로 실행합니다. 모델 다운로드와 준비 확인 후 `.venv/bin/python -m speech.smoke`를 실행하면 가상 문장의 합성·전사 결과가 Git 제외 경로 `models/smoke/`에 생성됩니다. 실행 시 기존 smoke 결과를 교체하므로 필요한 결과는 먼저 별도 로컬 폴더에 보관하세요.

공식 모델·라이선스 근거: [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), [CustomVoice 모델](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
