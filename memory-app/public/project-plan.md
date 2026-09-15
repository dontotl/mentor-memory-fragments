# 기억의 조각 로컬 우선 PWA 구현 계획서

작성: 2026-09-14. 상태: MVP 구현·자동 검증 완료, CPU 실시간 지연 목표 미달. 사용자가 승인한 Next.js PWA + Konsta UI iOS 테마를 기준으로 한다. 실제 하드웨어/외부 유료 API 검증 범위는 `../../verification.md`를 참조한다.

**목표:** 사진 한 장에서 시작해 어르신의 말을 엽서로 남기고, 원할 때만 인터뷰를 이어 원문 대조 회고록을 완성한다.

**기준 문서:** `../../../프로젝트_개요_기억의조각.md`와 `../../../종합_구현가이드_기억의조각.md`, 상위 `기억의조각_통합프로토타입_v10.html`. 이 계획의 로컬 모델·SQLite 선택은 기존 가이드의 관리형 음성 API·PostgreSQL 기본안을 이번 MVP에 한해 대체한다. 사용자 여정은 유지한다.

**실행:** 프런트엔드·API·음성 서비스를 병렬 구현하고 별도 검증 에이전트가 검토한다. 구현 테스트와 Playwright UI 테스트 후 이번 작업 파일만 커밋한다. 앱은 `memory-app/`에 둔다. 기존 사용자 파일을 포함하는 광역 커밋을 하지 않는다.

## 1. 범위와 완료 기준

- [x] 실제 사진 업로드 또는 제공된 가상 추억사진으로 인터뷰 시작.
- [x] 사진에서 확인되지 않은 시대·인물 관계를 추정하여 사실로 단정하지 않는 첫 질문.
- [x] 한국어 마이크 입력과 편집 가능한 전사. 별도 텍스트 모드로 같은 흐름 완주. 마이크 수명주기는 가상 장치, 음성 정확도는 실제 모델의 합성 음성으로 분리 검증.
- [x] 첫 답변만으로 엽서 작성·편집·PNG 내려받기·SQLite 저장.
- [x] 엽서에서 종료하거나, 본인이 선택하면 2~3턴 더 대화.
- [x] 원문·수정 이력과 초안 구성 출처를 확인·승인·저장·낭독. 자유 편집 후 현재 문단과 출처가 정확히 일치한다고 표시하지 않음.
- [x] 기본 묵음 5초, 선택 3/5/7초, 생각 중 일시정지, 수동 완료, 음성 재생 중단.
- [x] 홈·이야기 시작·보관함·설정 탭, 상단 화면 선택 메뉴, 뒤로가기 동작.
- [x] 로컬 STT/TTS 기본, 독립적인 API 전환 및 연결 테스트, 모델 다운로드·준비 상태. 외부 API는 유료 호출 없이 계약 검증.
- [x] 샘플 미리보기 메뉴와 가상 시나리오. 실제 추론 여부를 명확히 표시.
- [x] 모바일 PWA manifest, 설치 안내, 안전한 오프라인 안내, 세션 복구. 실제 iPhone 홈 화면 설치는 수동 확인 대상.
- [x] 파일·SQLite 소유권 검사, 서버에만 API 키 보관, 삭제 기능.
- [x] 독립 코드 검토, 빌드·타입·단위·통합·Playwright 검증과 git 커밋.

가족 허브·페어링·인생 연대기·출판·음성 복제는 원기획대로 후속 단계다. 가족의 실제 개인정보는 시연용으로 사용하지 않는다.

## 2. 제품과 디자인

60~70대 사용자가 가족의 도움 없이 사진과 말로 첫 기록을 남기는 경험이 우선이다. 브랜드는 `기억의 조각`, 종이색 `#F7F5F0`, 초록 `#1B5E20`, 본문 `#1A202C`를 유지한다. Konsta UI의 실제 React 컴포넌트를 사용하며 Next.js 라우터와 연결한다. 랜딩에 한해 design-taste-frontend 적용: DESIGN_VARIANCE=3, MOTION_INTENSITY=2, VISUAL_DENSITY=4. 인터뷰 폼에는 마케팅 화면 규칙을 강제하지 않는다.

| 경로 | 목적과 필수 동작 |
|---|---|
| `/` | 사진 중심 소개, 사진으로 시작하기, 샘플 미리보기, 최근 기록 |
| `/start` | 처리 안내와 동의, 사진 파일 선택·샘플 사진 선택, 시작 |
| `/interview/[id]` | 사진·질문 하나·자막·텍스트 전환·녹음·수정·생각 시간·완료 |
| `/postcard/[id]` | 승인 텍스트 기반 엽서, 수정·PNG 저장, 종료/더 이야기하기 |
| `/memoir/[id]` | 원문 대조, 출처 확인, 사용자 수정·승인, 낭독 |
| `/library` | 내 기록 필터·열기·삭제, 빈 화면 안내 |
| `/preview` | 가상 소풍 시나리오, 샘플 텍스트로 실제 저장 흐름 체험 |
| `/settings` | 큰글씨·테마·묵음, STT/TTS/LLM/이미지 연결·모델 관리 |

상단: 브랜드 또는 화면명, 화면 선택 콤보, 설정. 하단: 홈/이야기 시작/보관함/설정. 터치 영역 최소 48px, 핵심 버튼 56px, 큰글씨 본문 20~22px, 200% 확대·키보드·포커스 표시·스크린리더·모션 감소 지원. 일반 모드는 16~18px. 라이트/다크 팔레트에서 대비 확인. safe-area와 동적 뷰포트 사용. 데스크톱에서는 사진·내용의 읽기 좋은 2열, 모바일에서는 단일 열.

## 3. 실행 구조

```text
휴대폰 Next.js PWA (화면·마이크·사진·Canvas)
    → 같은 출처 Next.js Node API (세션·설정·소유권·원문·작업)
        → SQLite WAL + 로컬 media 디렉터리
        → 로컬 Python 음성 서비스 :8765 (faster-whisper / Qwen3-TTS)
        → 로컬 Ollama :11434 (Qwen3 4B, 기존 설치 확인)
        → 사용자가 설정한 외부 STT/TTS/이미지 API (선택)
```

모델은 휴대폰이 아니라 개발자 Mac 또는 CPU 서버에서 실행한다. 현재 확인 장비는 M1 Pro 8코어/16GB이며 일반 x86 서버의 실측 결과로 간주하지 않는다. 모델 다운로드 후 로컬 STT/TTS/LLM 동작은 외부 API에 의존하지 않는다. PWA 오프라인은 화면·샘플 안내 범위이며 서버 없이 AI 인터뷰가 된다고 표시하지 않는다. 휴대폰 LAN 마이크 사용에는 신뢰되는 HTTPS가 필요하다. 개발자 PC의 localhost 테스트와 구분한다.

API 키와 인터뷰 스냅샷은 서버 SQLite에 AES-GCM 암호화해 보관하고 암호화 키 파일은 로컬 0600 권한으로 보호한다. 클라이언트에는 hasKey만 반환하며 번들, service worker, localStorage에는 키를 넣지 않는다. 모든 사용자 데이터 API는 서명되지 않은 임의 사용자 ID 대신 서버 발급 HttpOnly 세션으로 소유권을 검사한다. 단일 기기 게스트 MVP이며 카카오 OAuth·다중 기기 동기화가 구현됐다고 표시하지 않는다.

## 4. 모델과 설정

| 역할 | 기본 | 선택 방식 |
|---|---|---|
| STT | faster-whisper small, CPU int8, 한국어 | OpenAI 호환 transcription API, 서버에서 키 사용 |
| TTS | Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice, Korean, Sohee | OpenAI 호환 speech API, 서버에서 키 사용 |
| 질문/회고록 | Ollama qwen3:4b | 연결 실패 시 원문을 보존하는 안내 질문/원문 정리 모드 표시 |
| 샘플 사진 | 생성 완료된 GPT Image 소풍 이미지 | 원본 파일 다운로드/업로드, 런타임 API 호출 없이 시연 |
| 추가 삽화 | GPT Image API, 명시적 생성 요청 | API 키 미설정 시 비활성, 기본 사진 엽서는 계속 완성 가능 |

0.6B CustomVoice와 Base의 용도를 혼동하지 않는다. 이번 앱은 Sohee 고정 음성으로 음성 복제를 하지 않는다. 0.6B의 instruction control은 공식 표에서 지원이 명시되지 않았으므로 감정 프롬프트 제어 UI를 제공하지 않는다. 모델/런타임 버전을 기록한다.

설정은 STT와 TTS를 각각 `local` 또는 `api`로 선택한다. 공급자, base URL, 모델, 음성, API 키 입력과 지우기, 저장, 짧은 샘플 테스트를 제공한다. 테스트 결과는 성공 여부·오류·시간을 표시한다. 저장만으로 연결 성공으로 표시하지 않는다. API 변경은 새 요청/새 세션부터 적용하고 기존 인터뷰 설정 스냅샷은 유지한다. 실패 시 외부 API로 조용히 전환하지 않는다.

로컬 모델 관리: 상태 `missing/downloading/ready/error`, 다운로드 크기·진행 상태 또는 수신 파일 수, 재시도, 현재 경로 표시. 앱 관리자용 다운로드는 사전 지정된 모델만 허용하고 임의 shell 명령·경로·저장소 실행은 받지 않는다. 캐시와 모델은 git에서 제외한다. 기본 동시 추론 1개, 짧은 질문과 긴 낭독을 분리하고 중단된 응답은 재생하지 않는다.

GPT Image는 로컬 가중치 설치 모델이 아니다. 이미지 생성 API 연동 코드를 로컬에 구성하며 결과 파일은 로컬에 저장한다. 외부 이미지 생성에는 입력 텍스트가 공급자에게 전달됨을 표시한다. 원본 사진을 자동 전송하지 않는다. Object Storage는 사용하지 않는다.

## 5. 샘플과 실제 인터뷰

샘플 사진: `assets/samples/spring-picnic.png` (AI 생성, 가상 한국 가족의 봄 소풍). 샘플 메뉴에서 다운로드 후 사진 업로드로 시작할 수도 있고 같은 자산을 선택해 바로 시작할 수도 있다. 화면과 결과물에 샘플임을 유지한다.

가상 답변 예: “봄에 가족과 소풍을 갔어요. 어머니가 싸 주신 김밥을 나무 아래에서 먹었어요.” 후속 답변: “아버지는 사진을 찍는 걸 좋아하셨어요.” / “정확한 연도는 기억나지 않지만 그날 참 즐거웠어요.” 사진에서 연도·장소·실제 가족관계를 추출했다고 설명하지 않는다. 샘플 대본은 사용자가 선택해 입력하고 실제 인터뷰에 자동 삽입하지 않는다.

미리보기는 텍스트만으로 모델·마이크 없이 UI 여정을 이해하는 설명 모드와, 샘플 답변으로 실제 API·SQLite를 거치는 텍스트 데모로 나눈다. 저장하지 않는 설명 모드는 명확히 표시한다. 실제 텍스트 데모의 질문이 LLM인지 안내 질문인지 기록한다.

## 6. 인터뷰 상태와 원문

`ready → listening → silence_wait → transcribing → review → answering → ready`.
`paused`에서는 마이크 전송·묵음 타이머·AI 재생을 멈춘다. 다시 시작은 명시적 버튼으로 한다. VAD의 구간 종료와 사용자 차례 종료를 구분한다. 기본 5초 동안 다시 발화하면 타이머 취소. 다 말했어요는 대기를 생략한다. STT가 오류여도 입력 오디오 재시도 또는 텍스트 입력으로 같은 턴을 완성한다. 녹음은 120초 이하로 제한하고 UI에 안내한다.

faster-whisper는 자체 native streaming STT가 아니다. 첫 구현은 녹음 구간 전사와 확정 전사를 우선하고, 실제 partial 미구현 상태에서 타자 애니메이션을 실시간 인식으로 표시하지 않는다. TTS는 런타임 지원에 따라 문장 단위 생성/재생을 사용하며 전체 WAV 완성 후 전송을 token streaming이라고 부르지 않는다. 해당 차이와 실측 지연을 검증 보고서에 기록한다.

사용자 승인 후 확정 전사를 저장한다. 수정 시 원문을 덮어쓰지 않고 revision 추가. 회고록은 source fragment ID/revision을 연결하며 이름·연도·장소를 새로 만들지 않는다. AI 초안은 사용자가 수정·승인하기 전 미승인 표시. 이미지·긴 낭독 실패는 원문·엽서 저장을 롤백하지 않는다. 취소된 generation ID의 늦은 결과는 무시한다.

## 7. 공통 API 계약 (병렬 구현 기준)

JSON 오류는 `{error:string}`. 설정은 `GET/PUT /api/settings`, 준비 상태는 `GET /api/health`.

| API | 입력/출력 |
|---|---|
| `GET /api/interviews` | `{interviews: Interview[]}` |
| `POST /api/interviews` | multipart `photo`, `consent=true`, `sample=true/false`; 또는 JSON `{sample:true,consent:true}` → `{interview}` |
| `GET /api/interviews/:id` | `{interview}` (fragments 포함) |
| `DELETE /api/interviews/:id` | `{ok:true}`; 소유 데이터 삭제 |
| `POST /api/interviews/:id/turns` | `{text,requestId}` → `{interview,question,source:'ollama'|'guided'}` |
| `PATCH /api/interviews/:id/fragments/:fragmentId` | `{text}` → `{interview}` |
| `POST /api/interviews/:id/postcard` | `{text}` → `{interview}` |
| `POST /api/interviews/:id/memoir` | `{}` 초안 생성 또는 `{text,approved:true}` 저장 → `{interview}` |
| `POST /api/stt` | multipart audio → `{text,provider,elapsedMs}` |
| `POST /api/tts` | `{text}` → audio/wav 또는 audio/mpeg |
| `POST /api/models/download` | `{kind:'stt'|'tts'}` → `{status}` |
| `POST /api/image` | `{prompt,interviewId}` → `{url}`; GPT Image, 키 필요 |
| `GET /api/media/:id` | 소유권 검증된 로컬 파일 |

`Interview={id,title,photoUrl,isSample,stage,createdAt,updatedAt,fragments,postcardText,memoirText,memoirApproved}`. `Fragment={id,original,text,revisions:string[],createdAt}`.

`Settings={largeText:boolean,theme:'light'|'dark'|'system',silenceSeconds:3|5|7,inputMode:'voice'|'text',stt:{mode,baseUrl,model,apiKey?,hasKey?},tts:{mode,baseUrl,model,voice,apiKey?,hasKey?},llm:{baseUrl,model},image:{model,apiKey?,hasKey?}}`. Keys PUT only, GET returns `hasKey` without plaintext. Backend supplies defaults. `Health={speech:{online,stt:{status},tts:{status}},llm:{online},storage:'sqlite'}`. Python internal contracts: `/health`, `/models/download`, `/stt` multipart audio, `/tts` JSON text. Python service loopback only.

## 8. 영속 저장과 복구

SQLite WAL로 interviews, fragments/revisions, settings, media, generations를 저장한다. 미디어는 `memory-app/data/media/`, DB는 `memory-app/data/memory.sqlite`에 둔다. 확정 데이터는 트랜잭션으로 저장하며 추론 중에는 DB 잠금을 유지하지 않는다. 단일 writer를 전제로 busy timeout을 설정한다.

위 저장 원칙의 사용자 표시는 한국어로 한다. 원음은 기본적으로 처리 후 폐기한다. 소장용 육성·복제는 포함하지 않는다. 새로고침 시 확정된 대화는 복구하고 미전송 입력은 별도 안내한다. 일관된 SQLite backup과 media 목록으로 로컬 백업·복원 절차를 문서화한다. 서비스워커는 개인 미디어와 API 응답을 캐시하지 않는다.

## 9. 작업 분담과 구현 순서

1. 루트: 계획·공통 계약·패키지 설정·샘플·통합/빌드·검증 보고·커밋.
2. 프런트 에이전트: `memory-app/src/app` UI(단 api 제외), `src/components`, `src/hooks`, PWA. Konsta iOS, 텍스트 데모, 편집·Canvas 다운로드, 내비게이션, 실제 API 연결.
3. 백엔드 에이전트: `src/app/api`, `src/server`, `tests/server*`. SQLite CRUD·세션 분리·설정 비밀값·Ollama·API adapters·사진 저장.
4. 음성 에이전트: `speech/`, `scripts/setup-speech*`, Python 테스트. CPU 로컬 설치·다운로드·faster-whisper·Qwen3-TTS·실측.
5. 별도 검증 에이전트: 수정 소유권 없이 실제 앱·코드·요구사항을 검토하고 재현 가능한 결함 보고. 루트가 수정·재검증.

각 구현자는 중요한 상태/데이터 무결성 동작의 실패 테스트를 먼저 확인한 뒤 구현한다. 테스트 환경은 격리된 임시 DB와 허구 데이터. 외부 API 유료 호출은 mock 서버로 계약 검증하고 실제 호출 여부를 별도 보고한다. 라이브 키가 없으면 실제 API 검증 미실시로 기록한다.

## 10. 검증·패턴 점검

- 빌드·타입검사·테스트 통과. SQLite 재시작/재조회 영속성과 다른 사용자 접근 거절 확인.
- Playwright: 모바일 390×844와 데스크톱 1440×1000에서 사진 업로드→텍스트 답변→엽서→심층 인터뷰→회고록 승인→보관함 재열기. 설정 저장·상단 콤보·하단 탭·샘플 진입·큰글씨·다크·삭제를 확인.
- 실제 마이크가 불가능한 자동화에서는 녹음 fixture를 STT로 보내고 텍스트 모드 E2E를 실행. 실제 휴대폰 하드웨어 녹음 검증과 구분한다.
- TTS 생성 WAV의 길이/샘플레이트/첫 생성 지연, STT 결과·품질·처리 시간 기록. 모델 파일 존재만으로 준비 완료 처리하지 않는다.
- 목표 p50 1.5초/p95 3초는 원기획 목표이며 보장치가 아니다. 묵음 포함 시간과 commit→실제 재생을 분리한다. CPU 미달은 수치로 공개한다.
- API 실패/모델 미설치/빈 입력/과대 파일/일시정지/재접속/중복 requestId/원문 수정 후 재생성을 시험.
- 패턴 점검: 거대 컴포넌트 분리, 동일 설정의 이중 소유 금지, raw DB 직접 UI 노출 금지, 프로바이더 분기 격리, 늦은 비동기 결과 방지, 에러 삼키기·거짓 성공 표시 제거.
- git은 계획→기능 통합→검증 수정 단위로 이번 앱/문서/샘플만 지정하여 커밋.

## 11. 근거

- [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Konsta Next.js](https://konstaui.com/react/next-js)
- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [SQLite WAL](https://sqlite.org/wal.html)

최종 결과·제약·테스트 기록은 `memory-app/README.md` 및 `docs/verification.md`에 유지한다.
