# 정적 소개 페이지와 아키텍처 검증

> 공개 저장소 참고: 아래 기록은 원 프로젝트의 로컬 검증 이력입니다. 공개된 receipt JSON은 개인 절대 경로만 상대 경로로 치환한 사본이며 원본 바이트와 다릅니다. 도식 HTML과 기록된 해시는 변경하지 않았습니다. [공개 정리 범위](PUBLICATION.md)를 참고하세요.

2026-09-14. 소개: `memory-app/public/project.html`. 서버 접속: `http://127.0.0.1:3000/project.html`. 파일을 직접 열어도 설명·전체 계획서를 볼 수 있으며 데모 링크는 localhost 앱으로 이동합니다. 서버 상태 조회는 HTTP 접속에서만 수행합니다.

포함 내용: 사용자 여정, 실제 구현 구성, 계획서 전문 펼치기와 MD 다운로드, 검증 보고서 다운로드, CPU 음성 성능 한계, 실행 명령, 미리보기·사진 시작·보관함·설정 연결.

## 실제 브라우저 검증

`tests/e2e_project.py` 통과: HTTP와 file 직접 열기, MD 다운로드, 테마 변경, 모델 상태 조회, 데모 페이지 이동, 390px 가로 넘침 없음, 브라우저 실행 오류 0개. 1440px 밝은 화면과 390px 어두운 화면의 실제 스크린샷을 열어 내용·계층·모바일 줄바꿈을 검토했습니다.

디자인 스킬은 소개 페이지에만 적용했습니다. 기존 종이색/초록 브랜드, 낮은 모션, 한국어 읽기 순서, 접근 가능한 링크와 버튼을 유지했습니다. 다단계 인터뷰 화면은 변경하지 않았습니다.

## 아키텍처 전달 기록

```text
diagram_type: architecture
output: memory-app/public/architecture.html
specification: docs/memory-architecture.json
specification_sha256: 1801f7d8d9322d5cc8f2ff784765cb0a36fc81e011800c5dd607349099d81e26
artifact_sha256: 9e55404aa28fe4faabbd67af6e107804398dc5fef87b6947892bb310fa7e02f4
validation: 9/9 showcase, 0 errors, 0 warnings
browser_evidence: passed
visual_review: passed
correction_rounds: 1
```

Archify의 deliver로 검증된 HTML을 생성한 후 파일을 수정하지 않았습니다. visual-check는 1440×900, 1600×1000, 1920×1080, 2048×1320에서 가로/세로 넘침이 없음을 확인했고, 양 끝 크기에서 라이트/다크 캡처를 생성했습니다. 이 자동 검증과 별개로 1440px 라이트·2048px 다크 이미지를 직접 열어 노드·라벨·연결·여백을 검토했습니다.

고정 Viewer UI와 html lang은 도구 지원 범위에 따라 영어로 유지되며, 제목·노드·관계 설명은 한국어입니다. 상세 자동 영수증과 이미지 접촉표는 `memory-app/public/architecture.visual-check.json`, `architecture.visual-check.html`입니다.

HTML·샘플·MD는 로컬 정적 파일입니다. 외부 저장소·CDN·유료 API·새 배포는 사용하지 않았습니다.

위 문단은 2026-09-14 당시 기록으로 보존한다. 다만 “외부 CDN 없음”은 이후 확인 결과 정확하지 않았다. Archify renderer HTML에는 Google Fonts stylesheet/preconnect가 있었고, 2026-09-15 개선에서는 아래 HTTP CSP로 원격 연결을 차단했다.

## 2026-09-15 랜딩 개선 검증

### 범위와 환경

- 로컬 macOS의 Chromium/Playwright로 `http://127.0.0.1:3000/project.html`과 `file://` 소개 페이지를 검사했다. 문서 재생성 뒤 root의 최종 production build가 exit 0(8 static pages)으로 끝났고 Next 서버는 session43039로 재시작됐다. 이 새 세션 대상 최종 `e2e_project.py` 전체 검사가 통과했다.
- 반응형 viewport는 390px, 768px, 1440px와 별도 720px reflow이며, 200%는 1440px 문서에 CSS zoom=2를 적용한 검사다. 실제 브라우저 UI 확대나 physical iPhone 검사는 아니다.
- Browser plugin은 존재하며 연결된 Chrome과 올바른 탭까지 확인됐지만 `Runtime.evaluate` CDP timeout, troubleshooting 후 DOM CUA timeout/kernel reset으로 invocation failed였다. 설치 부재로 표현하지 않으며, 승인 설계의 standalone Python Playwright로 대체했다. 새 설치나 시스템 설정 변경은 없었다.
- 로컬 파일/SQLite만 사용했다. Object Storage, 유료 API, 모델 다운로드, 배포는 사용하지 않았다.

### 실행 결과

`memory-app`에서 다음 결과가 확인됐다.

```text
PYTHONPATH=/private/tmp/voice_research_playwright python3 tests/e2e_project.py
  exit 0, pageerrors 0
  8 anchors, exact 3 Markdown downloads/DOM source, 4 demo links
  lazy viewer success/503/load-timeout, health ready/503/6s timeout
  390/768/1440/720, CSS zoom 200%, keyboard, dark, reduced motion
  embedded + standalone viewer external request attempts 0

PYTHONPATH=/private/tmp/voice_research_playwright python3 tests/e2e_demo.py
  exit 0, synthetic-text-guided, pageErrors 0

npm test
  10 passed, 0 failed
npm run test:guide
  5 passed, 0 failed
npm run typecheck
  exit 0
npm run build
  exit 0, 8 static pages generated
npm run guide:build
  exit 0
npm run guide:check
  exit 0
cmp source public-copy (3 Markdown files)
  all byte-identical
```

마지막 세 문서 명령은 이 문서와 설계/계획 문서를 갱신한 뒤 다시 실행했다. Task 3 fix 뒤 root가 별도로 실행한 `e2e_demo.py`, Node 10/10, guide 5/5와 GET `/api/health`도 통과했다. 이 기록은 음성 품질이나 지연을 재측정한 결과가 아니다.

### Archify 현재 receipt와 실제 이미지 검토

| 도식 | specification SHA-256 / bytes | artifact SHA-256 / bytes | 결과 |
|---|---|---|---|
| architecture | `1801f7d8d9322d5cc8f2ff784765cb0a36fc81e011800c5dd607349099d81e26` / 1704 | `9e55404aa28fe4faabbd67af6e107804398dc5fef87b6947892bb310fa7e02f4` / 706519 | showcase 9/9, errors 0, warnings 0 |
| interview sequence | `234eabf4401f93c6bd2b4a9c1ef7d38254d86344aecfc77fb5dd9fca9f888791` / 3209 | `b479d5419457d7fcfce6d178c25007f2ae3fb13c67511fc2da58bbe523b4703c` / 710876 | showcase 9/9, errors 0, warnings 0 |

현재 raw validate/deliver/visual-check receipt는 `docs/guide-receipts/`에 있다. 두 visual-check JSON은 기존 공개 위치에서 원본 바이트 그대로 옮겼고 HTML bytes는 변하지 않았다. 자동 검사는 1440×900, 1600×1000, 1920×1080, 2048×1320에서 containment/readability/viewer chrome/captures를 모두 통과했다. receipt의 `visualReview: pending`은 자동 도구 필드다. 이와 별개로 architecture와 sequence 각각 1440 light/dark, 2048 light/dark 총 8장을 사람이 열어 한국어 라벨, 화살표, legend, navigation과 잘림 여부를 검토해 통과했다.

랜딩 미리보기는 `memory-app/public/guide-assets/{architecture,interview-sequence}-{light,dark}.png`이며 모두 2048×1320이다. 랜딩 화면 증거는 `memory-app/test-results/project-hero-light.png`, `project-architecture-light.png`, `project-processing-dark.png`, `project-privacy-light.png`, `project-{390,768,1440,720}-light.png`, `project-mobile-dark.png`, `project-zoom-200.png`이다. HTTP CSP 실행 증거는 `project-csp-embedded.png`, `csp-architecture.html.png`, `csp-interview-sequence.html.png`이다. 경로는 저장소 기준 상대 경로다.

### 수용 기준 근거

| 기준 | 직접 증거 |
|---|---|
| 구성·처리 흐름 | 두 artifact, 캡션, architecture/processing 캡처 |
| 12개 기술 결정 | `#decisions`의 문제·선택·이유·한계·근거 disclosure |
| local/API/privacy | 아키텍처 캡션, 5행 처리 표, health 코드·요청 감사 |
| 날짜 있는 benchmark | 2026-09-14 장비·표본·오류 조건과 `docs/verification.md` |
| 기존 URL/문서/demo | 8 anchor, 3 MD byte/DOM, 4 demo route E2E |
| lazy viewer/fallback | 초기 요청 0, 클릭 단일 GET, 740px 예약, 503/timeout 복구 |
| responsive/accessibility | 390/768/1440, 720 reflow, zoom=2, keyboard, dark, reduced motion |
| Archify | 현재 raw receipts, 9/9, 4 viewport 자동 검사, 8 endpoint 이미지 검토 |
| builder sync | guide test 5/5, build/check, 3개 `cmp`, DOM Markdown 일치 |
| side effects 없음 | 상태·viewer 요청 캡처, health GET 감사, inference/download POST 없음 |

### 현재 CSP 범위와 한계

`/project.html`, `/architecture.html`, `/interview-sequence.html`의 HTTP 응답에만 `default-src 'self'` 기반 CSP와 `X-DNS-Prefetch-Control: off`가 적용된다. 소개 페이지의 meta CSP는 file 문서와 iframe `srcdoc`에도 적용된다. 앱 페이지와 `/api/health`에는 이 헤더를 확장하지 않았다. 정책은 신뢰한 정적 문서의 원격 자원 연결을 제한하지만 inline script/style을 허용하므로 일반적인 엄격 XSS 방어 정책으로 주장하지 않는다. 원본 viewer HTML을 `file://`로 직접 열면 HTTP CSP 보호 범위 밖이며 renderer의 Google Fonts 참조가 남아 있으므로 소개 페이지 또는 HTTP 전체보기 링크를 사용한다. Google Fonts CSP 차단 메시지의 좁은 예외는 의도한 차단 결과다. 별도 비차단 minor로 기존 console substring allowlist가 `503`, `ERR_FAILED`, `ERR_ABORTED`를 넓게 허용해 무관한 오류를 가릴 수 있으며, 최종 테스트 해석 시 이 한계를 고려한다.

### 주장하지 않는 범위

2026-09-14 음성 수치는 역사적 기록이며 이번 랜딩 변경에서 재측정하지 않았다. CPU 실시간 보장, physical iPhone, 실제 어르신 발화, Safari, 유료 provider 실호출, production HA/보안 인증, 다중 사용자 부하, Lighthouse/CWV는 검증하지 않았다. 최종 independent root diff verdict만 pending이다.
