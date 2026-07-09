# SOT JSON 스키마 (뷰어 데이터 계약)

뷰어(`viewer.html`)가 읽고 쓰는 단일 데이터 객체(SOT)의 구조다. 생성하는 JSON은 반드시 이 스키마를 따라야 뷰어에서 정상 표시되고 "누락 경고" 없이 열린다.

## 최상위 구조

```json
{ "title": "제품 이름", "prd": { }, "requirements": [ ], "ia": { "sections": [ ] } }
```

`title`, `prd`, `requirements`, `ia` 네 가지만 채우면 된다.

## prd (제품 정의)

```json
"prd": {
  "oneLiner": "제품을 한 문장으로 정의",
  "goal": "달성하려는 제품 목표",
  "background": "비즈니스·시장 관점의 배경",
  "problem": "사용자가 겪는 문제",
  "solution": "이를 해결하는 방식",
  "differentiator": "경쟁 대비 차별점",
  "targets": ["핵심 사용자 그룹1", "그룹2"],
  "scenarios": ["사용 흐름을 스토리로 묘사한 시나리오1"],
  "kpis": ["성공 판단 KPI1"],
  "risks": ["리스크·오픈 이슈1"],
  "category": "제품 카테고리",
  "roles": ["관리자", "고객"],
  "platforms": ["웹", "iOS", "Android"]
}
```

문자열 필드는 문자열, 나머지(targets/scenarios/kpis/risks/roles/platforms)는 문자열 배열.

## requirements (요구사항 → 기능 → 상세기능)

```json
"requirements": [
  { "id": "R1", "title": "요구사항", "desc": "설명", "status": "todo", "priority": "mid", "acceptance": [{"text":"수용 기준","done":false}],
    "features": [
      { "id": "F1", "title": "기능", "desc": "설명", "status": "todo", "priority": "mid", "acceptance": [],
        "specs": [ {"title": "상세기능", "desc": "설명", "acceptance": [{"text":"수용 기준","done":false}]} ] }
    ] }
]
```

- status: `todo | doing | done`, priority: `high | mid | low`.
- id 규칙: 요구사항 `R1,R2..`, 기능 `F1,F2..` (전체에서 유일하게 이어서 증가).
- 상세기능은 자체 id가 없다. IA에서 참조할 때 `기능id:배열인덱스`를 쓴다. 예: F1의 첫 상세기능 = `F1:0`.
- specs는 문자열 배열도 허용되나(자동 객체 변환), 설명·수용 기준을 넣으려면 객체로.

## ia (섹션 → 페이지 → 행동)

```json
"ia": { "sections": [
  { "id": "S1", "title": "섹션 이름", "pages": [
    { "id": "P1", "title": "페이지", "type": "top", "refs": ["F1"], "children": [
      { "id": "P2", "title": "행동", "type": "action", "refs": ["F1:0"], "children": [] }
    ] }
  ] }
] }
```

- id 규칙: 섹션 `S1,S2..`, 페이지 `P1,P2..` (전체에서 유일).
- type: 섹션 대표 화면 `top`, 일반 화면 `page`, 버튼·입력 인터랙션 `action`.
- refs: 그 화면에 매핑되는 기능/상세기능 id. 기능은 `F1`, 상세기능은 `F1:0`.
- children: 하위 화면 트리(재귀). 없으면 `[]`.

## 커버리지 규칙 (누락 경고 방지)

모든 기능(`F#`)과 모든 상세기능(`F#:idx`)이 IA의 어떤 페이지 refs에든 최소 1번 등장해야 한다.
권장 매핑: 요구사항 → 섹션, 대표 기능 → top 페이지, 나머지 기능 → page, 각 상세기능 → 그 기능 페이지의 action 자식.

## flow (유저플로우: 화면 전환)

화면 사이의 실제 이동(네비게이션)을 정의한다. IA의 포함 관계와는 **다른 축**이다.

```json
"flow": {
  "start": "P1",
  "transitions": [
    { "from": "P1", "to": "P4", "label": "로그인" },
    { "from": "P4", "to": "P6", "label": "로그인 성공" },
    { "from": "P9", "to": "P6", "label": "완료 후 홈으로" }
  ]
}
```

- `start`: 진입 화면의 페이지 id.
- `transitions`: `from`(출발 페이지 id) → `to`(도착 페이지 id), `label`(트리거/조건. 예: "로그인 성공", "예약 버튼 클릭").
- `from`/`to`는 **ia의 페이지 id(P#)**를 참조한다.
- **분기**(한 화면에서 여러 갈래)와 **루프**(되돌아오는 흐름)를 표현할 수 있다.
- `prd.scenarios`를 근거로 주요 경로를 transitions로 옮긴다. **해피패스 + 주요 분기·루프**를 포함하라.
- flow가 비어 있으면 뷰어가 IA 계층으로 임시 대체하지만, 진짜 유저플로우가 되려면 transitions를 채워야 한다.
