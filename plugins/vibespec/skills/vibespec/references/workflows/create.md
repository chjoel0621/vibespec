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

요구사항은 requirement → feature → spec 3계층이다. `R1..`, 전체에서 유일한 `F1..`, 상세기능 참조 `F#:index`를 사용한다. 요청 복잡도에 맞는 최소 충분 범위를 만들며 작은 앱에 임의의 개수 목표를 강제하지 않는다.

## 프로파일

- consumer: 첫 사용, 핵심 행동/기록, 진행·재방문, 알림·공유·데이터 통제를 맥락에 맞게 다룬다. 담당자·SLA·승인 큐·SSO·운영 대시보드·감사 로그를 기본값으로 넣지 않는다.
- marketplace: 참여자별 탐색·등록/응답·상태·신뢰/신고·공개 범위를 다룬다. 내부 승인 큐가 주 사용자 흐름을 대체하지 않는다.
- operations: 실제 조직 책임·기한·승인·예외·통제를 구체화한다.

## IA와 flow

모든 `F#`와 `F#:index`는 IA 페이지 refs에 적어도 한 번 등장해야 한다. flow는 IA 포함관계가 아니라 실제 화면 이동이다. 해피패스, 주요 분기와 루프를 만든다.

- 기능 실행 전환: `{from,to,ref}`
- 순수 상태 전환: `{from,to,label}`
- `ref`와 `label`을 동시에 넣지 않는다.
- `from/to`는 실제 IA `P#`; 기능 ID는 `ref`에만 둔다.
- `source/target`, `fromPage/toPage`, `action`, `name` 같은 대체 필드는 쓰지 않는다.

저장·검증·HTML 생성은 `common.md` 절차를 따른다. 두 파일의 절대 경로와 HTML을 바로 열 수 있다는 사용법을 안내한다.
