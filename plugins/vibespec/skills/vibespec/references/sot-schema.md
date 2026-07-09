# SOT JSON 스키마 (뷰어 데이터 계약)

뷰어(`viewer.html`)가 읽고 쓰는 단일 데이터 객체(SOT)의 구조다. 생성하는 JSON은 반드시 이 스키마를 따라야 뷰어에서 정상 표시되고 "누락 경고" 없이 열린다.

## 최상위 구조

```json
{ "title": "제품 이름", "prd": { }, "requirements": [ ], "ia": { "sections": [ ] }, "flow": { } }
```

## prd (제품 정의)

```json
"prd": {
  "oneLiner": "한 문장 정의", "goal": "제품 목표", "background": "배경",
  "problem": "사용자 문제", "solution": "해결 방식", "differentiator": "차별점",
  "targets": ["핵심 사용자 그룹"], "scenarios": ["사용 시나리오"],
  "kpis": ["성공 KPI"], "risks": ["리스크"],
  "category": "카테고리", "roles": ["역할"], "platforms": ["웹","iOS"]
}
```

## requirements (요구사항 → 기능 → 상세기능)

```json
"requirements": [
  { "id":"R1", "title":"요구사항", "desc":"설명", "status":"todo", "priority":"mid", "acceptance":[{"text":"수용 기준","done":false}],
    "features":[
      { "id":"F1", "title":"기능", "desc":"설명", "status":"todo", "priority":"mid", "acceptance":[],
        "specs":[ {"title":"상세기능","desc":"설명","acceptance":[]} ] }
    ] }
]
```

- status: `todo|doing|done`, priority: `high|mid|low`.
- id: 요구사항 `R1,R2..`, 기능 `F1,F2..`(전체 유일). 상세기능은 id 없이 `기능id:인덱스`로 참조(예 `F1:0`).

## ia (섹션 → 페이지 → 행동)

```json
"ia": { "sections": [
  { "id":"S1", "title":"섹션", "pages":[
    { "id":"P1", "title":"페이지", "type":"top", "refs":["F1"], "children":[
      { "id":"P2", "title":"행동", "type":"action", "refs":["F1:0"], "children":[] }
    ] }
  ] }
] }
```

- id: 섹션 `S1..`, 페이지 `P1..`(전체 유일). type: `top|page|action`.
- refs: 그 화면이 담는 기능/상세기능 id(`F1`, `F1:0`).
- **커버리지**: 모든 기능·상세기능이 어떤 페이지 refs에든 최소 1번 등장해야 한다.

## flow (유저플로우: 화면 전환)

화면 사이의 실제 이동(네비게이션). IA 포함관계와는 **다른 축**이다.

```json
"flow": {
  "start": "P1",
  "transitions": [
    { "from":"P1", "to":"P2", "ref":"F1" },
    { "from":"P4", "to":"P6", "label":"로그인 성공" },
    { "from":"P7", "to":"P8", "ref":"F3:0" }
  ]
}
```

- `start`: 진입 화면 페이지 id.
- `transitions`: `from`→`to`(둘 다 ia 페이지 id). 전환의 트리거(라벨)는 아래 둘 중 하나로 표기한다.
  - **`ref`(권장)**: 그 전환을 일으키는 **기능/상세기능 id**(`F1`, `F3:0`). 뷰어가 라벨을 그 기능 제목으로 자동 표시하고, 기능명세서에서 이름을 바꾸면 플로우 라벨도 자동으로 따라 바뀐다. 전환이 특정 기능 실행으로 일어나면 `ref`를 쓴다.
  - **`label`**: 기능으로 잡히지 않는 순수 상태 전환(예 "로그인 성공", "완료 후 홈")일 때만 자유 텍스트로 쓴다.
  - 한 전환에 `ref`와 `label`을 동시에 두지 말 것 — `ref`가 있으면 `label`은 무시된다.
- **분기**(한 화면에서 여러 갈래)와 **루프**(되돌아오는 흐름)를 표현한다.
- `prd.scenarios` 기반으로 해피패스 + 주요 분기·루프를 담아라. 부챗살 나열이 아니라 실제 이동 경로여야 한다.

### transition 필드 규칙 (엄격)

- 각 항목은 `{ "from":"P#", "to":"P#", "ref":"F#" }` 또는 `{ "from":"P#", "to":"P#", "label":"..." }` 형태만 사용한다.
- `source`, `target`, `fromPage`, `toPage`, `action`, `name` 등 다른 필드명 금지.
- `from`/`to`는 반드시 `ia`에 존재하는 페이지 id(`P#`). 기능 id(`F#`)는 `from`/`to`에 넣지 말고 **`ref`에만** 쓴다.
- `ref`는 requirements에 실제로 존재하는 기능(`F#`) 또는 상세기능(`F#:인덱스`) id여야 한다.
- `start`는 진입 페이지의 `P#`.
