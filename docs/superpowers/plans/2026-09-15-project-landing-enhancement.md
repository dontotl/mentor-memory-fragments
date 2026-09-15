# 기억의 조각 기술 소개 랜딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 프로젝트 소개 페이지에서 실제 아키텍처, 인터뷰 처리, 기술 선택과 한계, 검증 및 데모를 이해할 수 있게 한다.

**Architecture:** 작성용 정적 HTML 템플릿과 지정된 Markdown 문서를 로컬 빌드로 동기화한다. Archify 독립 뷰어는 검증한 생성물로 유지하며 본문은 정적 미리보기와 선택적 지연 로딩을 사용한다.

**Tech Stack:** HTML/CSS/JavaScript, Node.js 내장 API, Archify, Python Playwright. 기존 Next.js 앱을 유지한다.

**Spec:** `docs/superpowers/specs/2026-09-15-project-landing-enhancement-design.md`

## Global Constraints

- 기존 `#journey`, `#architecture`, `#plan`, `#demo`와 MD URL 및 데모 4개 경로를 유지한다.
- `DESIGN_VARIANCE=3`, `MOTION_INTENSITY=1`, `VISUAL_DENSITY=4`. 종이색 `#F7F5F0`, 초록 `#1B5E20`과 기존 라이트/다크 토큰을 유지한다.
- 앱 홈(`/`)과 어르신용 인터뷰 화면은 변경하지 않는다.
- 새 클라우드 인프라, Object Storage, 유료 API 호출, 모델 추가 다운로드는 포함하지 않는다.
- 사진·스크린샷은 공개 가상 데이터만 사용한다. 과거 테스트와 현재 상태를 구분한다.
- Archify 생성 HTML은 직접 수정하지 않는다. validate → deliver → visual-check와 실제 시각 검토를 수행한다.

### Task 1: 안전하고 재현 가능한 문서 빌드

**Files:** Create `memory-app/guide/project.template.html`, `memory-app/scripts/build-project-guide.mjs`, `memory-app/tests/guide.test.mjs`; modify `memory-app/package.json`, generated `memory-app/public/project.html` and public MD copies.

**Interfaces:** Export `renderGuide(template, planText)` and `buildGuide({check=false}={})`. Template contains exactly one `{{PLAN_SOURCE}}` marker. CLI `node scripts/build-project-guide.mjs [--check]` builds or compares outputs; unknown arguments fail. Fixed inputs: original MVP plan, verification, enhancement design. Public outputs: project.html, project-plan.md, project-verification.md, project-enhancement-design.md. No user-controlled path inputs.

- [x] Write Node tests catching unescaped Markdown HTML and a missing/duplicate marker; run them red before implementation. Literal example:

```js
assert.equal(renderGuide('<pre>{{PLAN_SOURCE}}</pre>', '<script>&"\''), '<pre>&lt;script&gt;&amp;&quot;&#39;</pre>');
assert.throws(() => renderGuide('<pre>missing</pre>', 'text'));
assert.throws(() => renderGuide('{{PLAN_SOURCE}}{{PLAN_SOURCE}}', 'text'));
```

- [x] Extract existing page into template, replacing only the plan source body with the marker. Implement escaping once and replace with a callback so `$&` in Markdown remains literal.
- [x] Implement fixed document mapping, read all inputs before writing, idempotent output, and read-only `--check` that fails on missing/stale output without mutation.
- [x] Add scripts `guide:build`, `guide:check`, `test:guide`; make normal build run guide build first. Test real outputs in a temporary fixture tree through a copied script, not source-grep. Verify stale output exits nonzero unchanged, regeneration copies all documents exactly, and a second build is byte-identical.
- [x] Run `npm run test:guide`, `npm run guide:build`, `npm run guide:check`, `npm test`; review diff preserves existing rendered page except updated document content. Commit only owned files.

### Task 2: 검증된 Archify 구성과 처리 시퀀스

**Files:** `docs/memory-architecture.json`, new `docs/memory-interview.sequence.json`, generated public viewers and `memory-app/public/guide-assets/` diagram previews.

**Interfaces:** Preserve architecture.html and six stable IDs. New viewer `interview-sequence.html`. Static preview filenames `architecture-light.png`, `architecture-dark.png`, `interview-sequence-light.png`, `interview-sequence-dark.png` in guide-assets. Viewer theme is independent.

- [x] Read Archify skill and architecture/sequence schemas/common/examples. Reflect spec section 5 exactly, especially confirm before persistence and no transaction over LLM wait.
- [x] Write sequence candidate and validate each edit. Existing architecture retains its structure; strengthen only factual captions where useful.
- [x] Generate via deliver; run showcase and visual-check on both artifacts, recording receipts and hashes. Inspect light/dark images for legibility and containment, with at most two focused geometry correction rounds.
- [x] Produce static previews from validated artifacts via supported Archify export or screenshots; no manual renderer DOM extraction. Commit scoped diagrams and generated assets.

### Task 3: 랜딩 콘텐츠·내비게이션·지연 로딩

**Files:** authored `memory-app/guide/project.template.html`, `memory-app/tests/e2e_project.py`, regenerated public files, synthetic sample result in guide-assets.

**Interfaces:** Existing anchors plus processing/decisions/privacy/evidence. Explicit viewer buttons load titled reserved-height iframes on desktop only; standalone links always work. Mobile menu uses aria-expanded/aria-controls and Escape/focus return. Manual GET /api/health displays checked time and never invokes inference.

- [x] Extend browser tests before implementation: new section visibility, mobile open/close+keyboard navigation, zero initial viewer requests, click loads a real viewer, failure preserves standalone link, document download content consistency, manual status failure, file:// links, no external requests on initial load/status. Confirm expected red failures.
- [x] Implement all content in spec sections 4–8, preserving the existing photo and demo links. Use native details for decisions and full plan. Include local-server vs on-phone inference distinction and historical evidence caveats.
- [x] Use theme-selected static previews with HTML summaries. Reserve viewer space; do not force an iframe on small screens or synchronize its DOM/theme. Viewer failure must remain recoverable through independent link.
- [x] Preserve readable content without JavaScript; mobile menu progressively enhanced. Supply focus indicators, reduced-motion rules, responsive data table, and meaningful image text. Use only synthetic result capture, never existing private library.
- [x] Build guide then run extended E2E at 390/768/1440px, 200% equivalent viewport and keyboard/theme/reduced motion. Inspect screenshots. Re-run existing text demo E2E for navigation regression.
- [x] Commit template, tests, generated files and assets only.

### Task 4: Integration audit and handoff

**Files:** `docs/project-guide-verification.md`, enhancement spec acceptance checklist, implementation plan checkboxes; generated verification copies.

**Interfaces:** Documentation accurately distinguishes historical speech tests, current guide tests, Archify receipts, and unverified devices/providers. Demo remains accessible locally at project.html and app paths.

- [x] Run guide check, Node tests, typecheck, production build and browser tests against current production app. Verify new public routes return HTML/images/Markdown rather than an app 404.
- [x] Map each of the spec's ten acceptance criteria to direct test/render evidence; fix gaps before marking any checkbox complete.
- [x] Record commands, results, screenshot paths and Archify receipt hashes in verification document. Rebuild guide copies and assert check mode succeeds.
- [x] Independent final review of complete scoped diff for spec compliance and quality; repair important findings and verify covering tests.
- [x] Keep local server available; provide project guide, demo URL, plan and architecture links. Do not claim native iPhone, production security or low-latency speech verification.
