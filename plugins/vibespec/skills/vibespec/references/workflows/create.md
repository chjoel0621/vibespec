# 신규 제품 기획 생성

## SOT 1.0

`references/sot-schema.md`와 `references/sot.schema.json`을 따른다. 최상위에 `schemaVersion: "1.0"`, `title`, `prd`, `requirements`, `ia`, `flow`를 둔다.

PRD는 다음 여섯 영역을 채운다.

1. 개요: `oneLiner`, `goal`, `whyNow`, `category`, `platforms`
2. 문제·가치: `problem`, `solution`, `alternatives`, `differentiator`
3. 사용자: 구조화된 `targets`, `scenarios`
4. 지표: `northStar`, 기능 refs가 있는 `kpis`
5. 범위: `inScope`, `nonGoals`
6. 리스크: `assumptions`, `risks`, `openQuestions`, `constraints`

## 의미 계약과 KPI 근거

신규 제품 기획은 최상위 `semantic.contractVersion: "semantic-0.1"`을 기본으로 사용한다. 각 KPI에 안정 ID `K1..`과 실제 측정 방식 하나를 둔다. 상세 계약은 `references/semantic-assurance.md`를 따른다.

- 이벤트로 세는 KPI만 `event-count` 또는 `event-ratio`와 `E1..` 이벤트를 만든다.
- 설문·수기 운영·외부 분석원이 맞는 KPI를 억지로 UI 이벤트로 바꾸지 않고 각각 `survey`, `manual`, `external`을 쓴다.
- 사용자 이벤트는 생산 기능과 실제 IA/flow 표면을 연결한다. 시스템·외부·수기 이벤트에 화면을 억지로 만들지 않는다.
- `D1..`은 KPI 측정이나 구현을 실제로 막는 미결정만 구조화한다. `openQuestions` 전체를 기계적으로 복사하지 않는다.
- 요구에 없는 기능이나 결정을 검토 통과 목적으로 발명하지 않는다. 증거가 없으면 blocked 초안으로 정직하게 남긴다.
- 사용자가 제공하지 않은 파일럿·설문·시장조사 수치나 baseline을 사실처럼 만들지 않는다. 근거가 없으면 `미측정` 또는 `Unknown — measure after launch`로 적는다.
- “활성 가구당”, “사용자당”, 비율·율처럼 개체 분모가 있는 KPI를 `event-count`로 정의하지 않는다. 모집단 이벤트가 있으면 `event-ratio`, 외부 집계가 소유하면 `external`을 쓴다.

요구사항은 requirement → feature → spec 3계층이다. `R1..`, 전체에서 유일한 `F1..`, 상세기능 참조 `F#:index`를 사용한다. 요청 복잡도에 맞는 최소 충분 범위를 만들며 작은 앱에 임의의 개수 목표를 강제하지 않는다.

## 프로파일

- consumer: 첫 사용, 핵심 행동/기록, 진행·재방문, 알림·공유·데이터 통제를 맥락에 맞게 다룬다. 담당자·SLA·승인 큐·SSO·운영 대시보드·감사 로그를 기본값으로 넣지 않는다.
- marketplace: 참여자별 탐색·등록/응답·상태·신뢰/신고·공개 범위를 다룬다. 내부 승인 큐가 주 사용자 흐름을 대체하지 않는다.
- operations: 실제 조직 책임·기한·승인·예외·통제를 구체화한다.

## IA와 flow

IA는 requirement나 feature 목록을 화면으로 복사하는 표가 아니다. 먼저 사용자의 내비게이션, 진입점, 반복 작업과 완료 흐름을 기준으로 섹션과 화면 계층을 설계한다. **requirement → section, feature → page를 기계적으로 일대일 복사하지 않는다.** 그다음 각 기능이 실제로 실행되는 화면의 `refs`에 `F#`와 `F#:index`를 배치한다.

다음 상호작용 설계 순서를 지킨다. 앞 단계를 건너뛰고 기능 목록에서 IA를 바로 만들지 않는다.

1. PRD `scenarios`와 핵심 기능에서 사용자가 달성하려는 대표 여정을 뽑는다.
2. 각 여정을 진입, 탐색·선택, 작성·변경, 검토·결정, 완료·재방문의 작업 단계로 나눈다.
3. 각 단계에 필요한 화면·패널·드로어·모달·모드를 화면 인벤토리로 만든다. 한 노드는 사용자가 이해할 수 있는 한 가지 주 책임을 가진다.
4. 화면 인벤토리를 전역 내비게이션과 화면 내부 포함관계로 묶어 IA를 만든다. 모든 섹션을 같은 `화면 1개 → 자식 1개` 모양으로 억지 중첩하지 않는다.
5. 기능과 상세기능을 실제 실행 표면의 `refs`에 배치한다. 서로 독립적인 기능군 세 개 이상이 한 화면에 몰리면 대시보드·요약 화면이라는 명확한 이유가 있는지 재검토한다.
6. 대표 여정을 `flow.transitions`로 연결하고, 마지막에 기능·상세기능 커버리지를 확인한다.

- 복잡한 제품은 대시보드·목록·상세·설정 같은 실제 상하 관계를 `children`으로 표현한다. 모든 페이지가 최상위인 평면 IA는 실제 내비게이션이 평면일 때만 사용한다.
- `type`은 IA 계층 역할(`top|page|action`)이다. 실제 UI 표면이 중요하면 선택 필드 `surface`에 `screen|panel|drawer|modal|mode`를 적는다.
- 패널·드로어·모달·모드는 독립 URL 페이지로 부풀리지 말고, 사용자가 어느 화면에서 여는지 알 수 있도록 해당 화면 아래에 둔다.
- 기능 커버리지는 IA 설계의 결과를 검증하는 장치이지 IA의 뼈대를 만드는 기준이 아니다.
- 복잡한 제품에서 핵심 작업 전체를 소수의 만능 화면에 압축하거나, 형식적으로 자식 하나만 붙여 계층 검사를 통과시키지 않는다.

모든 `F#`와 `F#:index`는 IA 페이지 refs에 적어도 한 번 등장해야 한다. flow는 IA 포함관계가 아니라 실제 화면 이동이다. 해피패스, 주요 분기와 루프를 만든다.

- 기능 실행 전환: `{from,to,ref}`
- 순수 상태 전환: `{from,to,label}`
- `ref`와 `label`을 동시에 넣지 않는다.
- `from/to`는 실제 IA `P#`; 기능 ID는 `ref`에만 둔다.
- `source/target`, `fromPage/toPage`, `action`, `name` 같은 대체 필드는 쓰지 않는다.

저장·검증·의미 검토·HTML 생성은 `common.md` 절차를 따른다. 두 파일의 절대 경로와 HTML을 바로 열 수 있다는 사용법, 의미 검토 준비도를 안내한다.
