# DYNOV Google Sheets 관리자 배포 가이드

기존 문의 접수용 Apps Script는 변경하지 않습니다. 별도 **관리자 전용 Apps Script 프로젝트**를 만듭니다.

1. Google Sheets에서 기존 문의 스프레드시트 ID를 확인합니다.
2. script.google.com에서 새 프로젝트를 만들고 Code.gs에 `gas-admin/Code.gs`, Admin.html에 `gas-admin/Admin.html`을 복사합니다.
3. 프로젝트 설정 → 스크립트 속성에 `SPREADSHEET_ID`를 등록합니다. 저장소에 실제 ID나 인증정보를 커밋하지 마세요.
4. Code.gs의 `SHEET_NAME`을 실제 문의 탭 이름으로 바꿉니다. 첫 행은 열 이름이어야 하며 `timestamp`, `scope`, `name`, `email` 등 기존 문의 컬럼명을 확인하세요.
5. 배포 → 새 배포 → 웹 앱: 실행 사용자 **나**, 액세스 권한 **나만**. 해당 Google 계정으로 관리자 URL에 접근합니다.
6. 테스트용 문의 1건으로 목록 조회, 상태/메모 저장, 새로고침 후 유지, CSV 내보내기를 확인합니다. 다른 Google 계정 접근이 차단되는지 확인합니다.
7. 운영 사이트의 admin.html을 이 URL로 연결하는 것은 테스트와 별도 승인 이후 진행합니다.

## 보안
- GitHub 정적 페이지의 클라이언트 패스코드는 보안 기능이 아닙니다. 기존 `admin.html`은 운영에 사용하지 마세요.
- Apps Script 웹 앱의 Google 계정 접근 제한을 이용합니다. 공개(Anyone)로 배포하지 마세요.
- 조회·수정은 Apps Script 서버 측 `google.script.run`으로 수행하며, 브라우저에 Google Sheets 읽기/쓰기 API 키를 노출하지 않습니다.
- Google Sheets 공유 권한도 관리자만 유지하세요.
- 이 구현은 시트의 행 번호를 사용하므로 행 정렬/삭제를 동시에 수행하는 환경에서는 안정적인 고유 ID 기반으로 보강해야 합니다.
- 기존 시트의 열 이름 및 운영 배포 설정을 확인하기 전에는 실제 데이터로 검증되지 않았습니다.

## 운영용 시트 후보 확인 (2026-11-05)
- Google Drive에서 `inquiries` 스프레드시트 ID `1vKRp16m5qlFKFaRvjY91msH_Ee3XMaABAk3mOjNBK6Q` 발견.
- 백업본과 탭 이름 및 시트 ID 일치. **실제 운영 연결 여부는 아직 미확인**.
- 운영 Apps Script가 참조하는 ID를 확인한 후에만 Script Property `SPREADSHEET_ID`에 지정하세요.
- 백업본 ID `1Ym3uWdxblvO4YQaSqZ7D21cPnVlSiwc49OX1rsGGlU0`는 연결하지 마세요.
- 기존 `상태` 열은 견적 자동화와 공유될 수 있으므로 저장 동작을 운영 테스트 전에 검토해야 합니다.
