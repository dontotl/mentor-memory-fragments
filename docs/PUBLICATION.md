# 공개 저장소 정리 기록

2026-09-15. 저장소: `dontotl/mentor-memory-fragments`.

기존 프로젝트에서 추적 중이던 `memory-app/` 코드·공개 가상 샘플과 관련 설계·검증 문서만 별도 저장소로 복사했습니다. 상위 저장소 이력은 가져오지 않았습니다. 내부 작업 지시·에이전트 진행 기록은 제외했습니다.

제외: SSH/OCI 인증 파일, API 키, `.env` 실제 설정, SQLite·사용자 사진, 모델 가중치, Python/npm 설치 환경, 빌드 캐시, 테스트 실행 결과, 상위 교육 자료.

`docs/guide-receipts/`의 공개 JSON은 **개인 절대 경로를 저장소 상대 경로로 치환한 사본**입니다. 따라서 로컬 원본 receipt와 바이트가 동일하지 않습니다. specification/artifact SHA-256 값과 검사 결과는 변경하지 않았으며, Archify HTML은 원본 바이트를 유지합니다. 원본 receipt는 기존 로컬 프로젝트에 보관됩니다.

기존 검증 문서의 날짜·장비·결과는 당시 로컬 실행의 역사입니다. 기존 커밋 식별자는 원 프로젝트를 가리키며 이 저장소 이력과 같지 않습니다. 공개 과정의 검사 결과는 별도 아래에 기록합니다. 공개 소스의 라이선스는 임의로 지정하지 않았습니다.

## 공개 사본에서 실행한 검사

- 새 폴더에서 `npm ci --no-audit --no-fund --cache /private/tmp/mentor-memory-npm-cache` 성공. 기본 npm 캐시 쓰기 권한 오류를 임시 캐시로 우회했으며 사용자 캐시 권한은 변경하지 않았습니다.
- `npm test`: 10/10, `npm run test:guide`: 5/5 통과.
- `npm run guide:check`, `npm run typecheck`, `npm run build`: exit 0.
- 공개 대상 103개 파일 약 7.5 MB. 추적 파일의 제외 경로·파일 크기·심볼릭 링크·개인 경로·주요 토큰/키 패턴 검사에서 발견 사항 0. 이는 모든 종류의 비밀값 부재를 보증하는 전문 보안 감사는 아닙니다.
- 두 Archify HTML SHA-256이 기존 검증 값과 동일함을 확인했습니다.
- `git diff --cached --check` 통과. 새 Git 이력은 공개 사본의 단일 초기 커밋으로 시작하며 커밋 이메일은 GitHub noreply를 사용합니다.

기존 lockfile의 패키지 다운로드 출처는 `registry.npmmirror.com`이며 버전과 integrity를 유지했습니다. 설치 중 npm의 install-script 승인 경고가 있었으나 위 테스트와 빌드는 실제 통과했습니다. Python 음성 설치·실제 모델 추론·브라우저 E2E는 이 공개 사본에서 재실행하지 않았습니다. 이전 실행 결과와 구분하세요.
