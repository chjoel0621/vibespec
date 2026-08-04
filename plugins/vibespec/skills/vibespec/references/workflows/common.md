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

JSON을 쓴 뒤 다음 순서로 실행한다.

```text
node "<VIBESPEC_SKILL_DIR>/scripts/validate-sot.mjs" "<sot 절대경로>"
node "<VIBESPEC_SKILL_DIR>/scripts/review-sot.mjs" "<sot 절대경로>" --profile <operations|consumer|marketplace>
node "<VIBESPEC_SKILL_DIR>/scripts/review-semantic.mjs" "<sot 절대경로>" --json
node "<VIBESPEC_SKILL_DIR>/scripts/embed-sot.mjs" "<VIBESPEC_SKILL_DIR>/assets/viewer.html" "<sot 절대경로>" "<html 절대경로>"
```

validate가 FAIL이면 PASS까지 고친다. review는 advisory지만 모호한 수용 기준·빈 범위·프로파일 어휘 경고를 검토한다. `review-semantic`은 `semantic`이 있는 문서에서 KPI → 측정 방식 → 이벤트/증거 → 생산 기능과 사용자 상호작용 근거를 검사한다. 사용자 이벤트의 상호작용 근거는 IA 또는 flow 중 하나이며, 자연어 `inScope`를 기계적으로 판정하지 않는다. 의미 계약이 없는 기존 문서는 `not-assessed`이며 자동 승격하지 않는다.

의미 검토가 blocked여도 구조적으로 유효한 **초안** JSON/HTML은 만들 수 있다. 이때 차단 finding과 필요한 사람 결정을 최종 응답에 명시하고 승인 가능·개발 전달 준비 완료라고 부르지 않는다. 근거가 문서에 이미 있으면 고쳐서 재검토하되, QR/NFC 선택처럼 사용자가 결정해야 하는 사실을 AI가 임의로 확정하지 않는다. 승인 또는 개발 전달 준비 완료 조건은 validate PASS와 semantic measurement `ready`다. HTML은 JSON을 다시 작성하지 않고 반드시 embed 명령으로 만든다. `embed-sot`은 같은 공유 엔진의 파생 보고서를 HTML에 봉인하며, 뷰어 편집 후에는 결과를 stale로 표시한다.

기본 신규/단일 수정 산출물은 `outputs/<제품명>.sot.json`과 `outputs/<제품명>.html` 두 개다. 적용된 change plan은 `history/change-plans/`에 둔다.
