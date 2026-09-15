# 공통 런타임과 산출물

## 런타임

`<VIBESPEC_SKILL_DIR>`는 호스트가 로드한 `SKILL.md`의 절대 부모 디렉터리다. 현재 작업 폴더를 기준으로 `scripts/...`를 실행하지 않는다. doctor 결과의 `skillDir`와 이 경로가 같아야 한다.

VibeSpec 전체 기능은 Node.js 18 이상, 설치된 스킬 디렉터리 읽기, 사용자 작업 폴더 쓰기가 필요하다. doctor가 실패하면 실패한 check를 그대로 알려준다.

### 축소 모드

Node 또는 스킬 경로를 쓸 수 없을 때 **검증된 embedded HTML을 보장할 수 없다**. 사용자가 축소 모드를 수락한 경우에만 다음을 수행한다.

1. SOT JSON만 생성하고 스키마·ID·참조·IA 커버리지를 수동 점검한다.
2. 호스트가 스킬 asset을 복사할 수 있으면 `assets/viewer.html`을 수정 없이 함께 제공한다.
3. 사용자에게 HTML을 연 뒤 JSON을 불러오거나 연결해야 한다고 명시한다.
4. JSON을 HTML에 손으로 복사해 두 산출물이 갈라지는 경로를 만들지 않는다.

축소 모드에서는 rebase, merge, change-plan apply처럼 결정적 스크립트가 필요한 쓰기를 수행하지 않는다.

## 언어와 생성 프로파일

영어 요청이면 모든 SOT 텍스트를 영어로 만들고 최상위 `lang: "en"`을 넣는다. 한국어면 `lang`을 생략하거나 `"ko"`로 둔다.

신규 생성 프로파일은 다음 중 하나다.

- `operations`: 조직 내부 담당자·승인·SLA·감사가 핵심.
- `consumer`: 개인/가족의 목표·기록·재방문·개인화·데이터 통제가 핵심.
- `marketplace`: 둘 이상의 참여자가 탐색·등록·응답·거래·신뢰를 주고받음.

모호하면 이 분류만 한 번 묻는다. 프로파일은 SOT 필드가 아니라 생성·리뷰 문맥이다.

## 검증과 HTML

### 기획 목적

도메인 프로파일과 별개로 요청에서 기획 목적을 선택한다. 목적이 충분히 드러나면 추가 질문 없이 진행한다. 목적은 리뷰 문맥이며 SOT 필드로 저장하지 않는다.

- `overview`: 서비스 개요·구조도. 사용자·기능·화면·흐름을 연결하고 상세 생략 범위를 밝힌다. 상세기능의 빈 설명·수용 기준은 정보 안내로 남긴다.
- `current-state`: 현행 서비스 기획·코드 기반 최신화. 실제로 확인한 동작·주요 예외를 기술하고 근거 경로·버전·미확인 사항을 기존 설명 또는 보조 검토 기록에 남긴다. 코드 존재만으로 운영 활성이나 검수 완료를 추정하지 않는다.
- `change`: 신규 상세 기획·기능 변경. 핵심 작업의 주체·전제·입력·결과·예외·검수 조건을 구체화한다. 누락은 경고이며 제품 결정을 검토 통과 목적으로 발명하지 않는다.

CLI에서 목적을 생략하면 `current-state`다. `--profile`은 사용자 유형, `--purpose`는 작성·검토 깊이이며 전체/축소는 실행 환경이다. 해당 없는 예외는 이유를 설명하고, 불명확한 정책은 openQuestions 또는 해당하는 D# 결정으로 남긴다. 자동 경고 면제를 위해 새 SOT 필드를 만들지 않는다.

JSON을 쓴 뒤 다음 순서로 실행한다.

```text
node "<VIBESPEC_SKILL_DIR>/scripts/validate-sot.mjs" "<sot 절대경로>"
node "<VIBESPEC_SKILL_DIR>/scripts/review-sot.mjs" "<sot 절대경로>" --profile <operations|consumer|marketplace> --purpose <overview|current-state|change>
node "<VIBESPEC_SKILL_DIR>/scripts/review-semantic.mjs" "<sot 절대경로>" --json
node "<VIBESPEC_SKILL_DIR>/scripts/embed-sot.mjs" "<VIBESPEC_SKILL_DIR>/assets/viewer.html" "<sot 절대경로>" "<html 절대경로>"
```

validate가 FAIL이면 PASS까지 고친다. review는 advisory지만 모호한 수용 기준·빈 범위·프로파일 어휘 경고를 검토한다. `review-semantic`은 `semantic`이 있는 문서에서 KPI → 측정 방식 → 이벤트/증거 → 생산 기능과 사용자 상호작용 근거를 검사한다. 사용자 이벤트의 상호작용 근거는 IA 또는 flow 중 하나이며, 자연어 `inScope`를 기계적으로 판정하지 않는다. 의미 계약이 없는 기존 문서는 `not-assessed`이며 자동 승격하지 않는다.

KPI 측정 가능성 점검이 blocked여도 구조적으로 유효한 **초안** JSON/HTML은 만들 수 있다. 이때 확인할 항목과 필요한 사람 결정을 최종 응답에 명시한다. 근거가 문서에 이미 있으면 고쳐서 재점검하되, QR/NFC 선택처럼 사용자가 결정해야 하는 사실을 AI가 임의로 확정하지 않는다. validate PASS는 구조 정합성, 내용 리뷰는 제한된 누락·모호성 검사, semantic measurement `ready`는 선언된 측정 정의의 준비 상태다. 이 결과만으로 기획 전체의 승인·개발 전달 준비 완료를 선언하지 않는다. 실제 정책·예외·범위·미결정과 미검토 영역을 별도 설명한다. review의 `valid: true`도 구조 검증이나 승인을 뜻하지 않는다. HTML은 JSON을 다시 작성하지 않고 반드시 embed 명령으로 만든다. `embed-sot`은 같은 공유 엔진의 파생 보고서를 HTML에 봉인하며, 뷰어 편집 후에는 결과를 stale로 표시한다.

사용자가 HTML에서 결정 답변을 저장하면 `resolution` 초안만 기록하고 결정은 `open`으로 유지한다. 답변을 영향받는 KPI·이벤트·기능·화면·플로우에 실제 반영하는 change-plan을 검토·적용한 뒤에만 `status: "decided"`로 바꾸고, 구조 검증과 KPI 측정 가능성 점검을 다시 실행한다. 답변 기록만으로 차단을 해제하지 않는다.

기본 신규/단일 수정 산출물은 `outputs/<제품명>.sot.json`과 `outputs/<제품명>.html` 두 개다. 적용된 change plan은 `history/change-plans/`에 둔다.
