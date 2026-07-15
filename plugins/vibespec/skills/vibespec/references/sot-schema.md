# SOT JSON 스키마 (뷰어 데이터 계약)

뷰어(`viewer.html`)가 읽고 쓰는 단일 데이터 객체(SOT)의 구조다. 생성하는 JSON은 반드시 이 스키마를 따라야 뷰어에서 정상 표시되고 "누락 경고" 없이 열린다.

기계 판독용 JSON Schema는 `sot.schema.json`에 있다. `../scripts/validate-sot.mjs`가 이 스키마를 직접 실행하고, 동적 참조와 IA 커버리지를 추가 검증한다. 검증기는 **SOT 1.0과 1.1을 모두** 지원한다(구버전 파일은 뷰어에서 불러온 뒤 다시 저장해 정규화된다).

**버전.** 일반 제품 SOT는 `1.0`이다. 특정 본편 위에 얹히는 **이니셔티브 SOT**는 `1.1`이며, 최상위 `initiative` 메타와 페이지 `boundary`(본편 접점 표시)를 쓸 수 있다. 이 둘은 1.1에서만 허용된다 — 1.0 파일에 넣으면 검증 실패. 뷰어는 1.0·1.1을 모두 열고, **1.1을 저장할 때 1.0으로 낮추지 않는다**(schemaVersion은 `initiative` 존재 여부에서 도출). 이니셔티브 생성 절차는 아직 스킬에 활성화되지 않았다(로드맵 v1).

## 최상위 구조

```json
{ "schemaVersion": "1.0", "title": "제품 이름", "lang": "ko", "prd": { }, "requirements": [ ], "ia": { "sections": [ ] }, "flow": { } }
```

- `schemaVersion`: 필수. 일반 SOT는 `"1.0"`, 이니셔티브 SOT는 `"1.1"`. 레거시 입력에는 없을 수 있지만, 뷰어가 저장하거나 스킬이 생성하는 SOT에는 반드시 포함한다.
- `lang`: 뷰어 기본 표시 언어(`"ko"`/`"en"`, 선택). 영어로 생성하면 `"en"`.
- 파일은 Git 형상관리를 위해 **키 정렬 고정 + pretty-print**된 `<제품명>.sot.json`으로 저장한다(뷰어의 저장 기능이 이 표준형을 출력한다).

## 이니셔티브 (SOT 1.1, 미활성)

> 로드맵 v1에서 스킬에 활성화 예정. 아래는 계약 정의이며, 현재 검증기가 이미 강제한다.

이니셔티브는 본편 SOT를 그대로 두고 그 위에 얹히는 증분 문서다. 구조적으로는 완전한 SOT이고, 여기에 두 가지가 더해진다.

**PRD는 역할별로 다르다(경량 프로파일).** 제품 정체성 필드(`category`·`platforms`·`northStar`·`differentiator`·`alternatives`)는 **본편 소관**이라 이니셔티브에는 두지 않는다(내용이 있으면 검증기가 경고 — 드리프트 위험). 이니셔티브 PRD의 필수 최소 집합은 `problem`·`solution`·`inScope`·`nonGoals`(오버레이의 핵심 = "X를 더하고 Y는 안 한다")이며, 나머지 스코프 필드(`goal`·`kpis`·`scenarios` 등)는 선택이다. 본편(1.0)은 여전히 전체 6섹션을 요구한다.

```json
"initiative": {
  "productId": "acme-shop",
  "id": "payment",
  "path": "1-2",
  "status": "proposed",
  "parent": { "scopeId": "root", "canonicalization": "sot-c14n-v1", "digest": "sha256:…" }
}
```

- `productId`·`id`: 소문자 slug(`^[a-z0-9][a-z0-9-]*$`). `id`는 같은 제품 안에서 유일하며 생성 후 불변. `"root"`는 본편 예약어라 `id`로 못 쓴다.
- `path`: 표시·파일명용 경로(`1-2`, `1-2-1`). 참조 식별자가 아니다.
- `status`: `proposed | approved | implemented | dropped | landed`. `landed`는 구현된 이니셔티브를 본편에 접어 넣은(merge) 뒤 남는 종료 상태 — 그 내용은 이미 본편 baseline에 있으므로 합성·활성집합에서 제외되고 digest 신선도도 따지지 않는다(이력 보존용 tombstone). `merge.mjs`가 부여하며, 손으로 지정하지 않는다.
- `parent.scopeId`: 부모 scope(`"root"` 또는 부모 이니셔티브의 `id`). 자기 자신은 못 가리킨다.
- `parent.canonicalization`: 항상 `"sot-c14n-v1"`. `parent.digest`: 부모 SOT를 그 규칙으로 표준화한 SHA-256(`sha256:` + 64 hex).

**경계 스텁(boundary).** 이니셔티브가 본편의 화면에서 시작·연결될 때, 그 접점을 페이지에 `boundary`로 표시한다. 스텁 페이지는 본편 페이지를 가리키는 참조일 뿐이므로 자체 기능 `refs`를 담지 않는다(담으면 경고).

```json
{ "id": "P1", "title": "장바구니", "type": "top", "refs": [], "boundary": { "scopeId": "root", "pageId": "P10" }, "children": [ … ] }
```

**섹션 경계(section boundary).** 페이지 경계 스텁을 감싸는 섹션도, 본편의 어느 섹션에 해당하는지 `boundary`로 밝힌다. 그래야 이니셔티브의 모든 계층이 **참조(본편 미러) 또는 신규** 둘 중 하나로 명시되고, 합성 때 조용히 사라지는 그릇 섹션이 없어진다.

```json
{ "id": "S1", "title": "예약", "boundary": { "scopeId": "root", "sectionId": "S4" }, "pages": [ …페이지 경계 스텁… ] }
```

- 섹션 스텁의 `title`은 대상 본편 섹션을 **그대로 미러링**한다(다르면 drift 경고). `sectionId`는 `^S[1-9][0-9]*$`.
- 섹션에 `boundary`가 **있으면** = 참조: 그 안의 새 페이지는 본편 섹션에 더해지고, 페이지 스텁은 각자 대상 페이지 아래로 접붙는다. 합성 지도에 새 섹션은 생기지 않는다.
- 섹션에 `boundary`가 **없으면** = 이니셔티브가 더하는 신규 섹션: 지도에 작성자가 지은 제목 그대로, `+이니셔티브` 태그로 나타난다(자동 이름·조용한 삭제 없음).
- 페이지 경계 스텁이 boundary 없는 섹션 아래 있으면 validate-tree가 경고한다(참조로 선언하거나 신규임을 명시하라는 뜻).

교차 파일 검사(`scopeId`가 실제 조상에 존재하는지, 대상 페이지·섹션이 실재하는지, `path`가 부모 접두와 맞는지, digest가 현재 부모와 일치하는지)는 단일 파일 검증기 범위 밖이며 `validate-tree`가 담당한다.

## prd (제품 정의)

6개 섹션으로 구성한다.

```json
"prd": {
  "oneLiner": "한 문장 정의", "goal": "비즈니스 성과 목표(수치·기한)", "whyNow": "왜 지금(시장·타이밍)",
  "category": "카테고리", "platforms": ["웹","iOS"],
  "problem": "사용자 Job/문제", "solution": "해결 방식", "alternatives": "현재 대안·경쟁", "differentiator": "차별점",
  "targets": [ {"name":"페르소나 이름", "role":"역할", "needs":"니즈", "pain":"페인포인트"} ],
  "scenarios": [ {"text":"유저 스토리·시나리오", "start":"P1"} ],
  "northStar": "북극성 지표(하나)",
  "kpis": [ {"name":"지표명", "target":"목표치", "baseline":"기준값", "method":"측정방법", "refs":["F1"]} ],
  "inScope": ["포함 범위·MVP"], "nonGoals": ["비목표(범위 밖)"],
  "assumptions": ["가정"], "risks": ["리스크"], "openQuestions": ["미해결 질문"], "constraints": ["제약·의존성"]
}
```

- 섹션: ①개요(oneLiner·goal·whyNow·category·platforms) ②문제·가치(problem·solution·alternatives·differentiator) ③사용자(targets·scenarios) ④성공지표(northStar·kpis) ⑤범위(inScope·nonGoals) ⑥리스크·가정(assumptions·risks·openQuestions·constraints).
- `goal`은 성과(왜)와 `solution`(어떻게)을 구분한다. `nonGoals`로 범위를 명확히 하고, `assumptions`/`openQuestions`로 불확실성을 남긴다.
- **`targets`(페르소나)** 는 `{name, role, needs, pain}` 객체 배열. **`scenarios`** 는 `{text, start}` 객체 배열이고 `start`는 이 시나리오가 시작되는 ia 페이지 id(`P#`, 선택) — 뷰어에서 클릭하면 유저플로우로 이동한다. **`kpis`** 는 `{name, target, baseline, method, refs}` 객체 배열이고 `refs`는 이 지표를 움직이는 기능/상세기능 id(`F#`/`F#:인덱스`) — 기능명을 바꾸면 KPI의 연결 라벨도 자동 갱신된다.
- (구버전에서 이들이 문자열 배열이면 뷰어가 자동으로 객체로 이관한다. 새로 생성할 땐 객체 형태로 쓴다.)
- (구버전 `background`→`whyNow`, `roles`→`targets`로 자동 이관됨. 새로 생성할 땐 새 필드명만 쓴다.)

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
    { "from":"P1", "to":"P4" },
    { "from":"P1", "to":"P2", "ref":"F1" },
    { "from":"P4", "to":"P6", "label":"로그인 성공" },
    { "from":"P7", "to":"P8", "ref":"F3:0" }
  ]
}
```

- `start`: 진입 화면 페이지 id.
- `transitions`: `from`→`to`(둘 다 ia 페이지 id). 트리거가 없는 구조적 이동은 두 필드만 쓰고, 트리거가 있으면 아래 둘 중 하나로 표기한다.
  - **트리거 없음**: 뷰어가 IA 구조에서 자동 파생하거나 사용자가 연결만 정의한 전환은 `{ "from":"P#", "to":"P#" }`로 표기한다.
  - **`ref`(권장)**: 그 전환을 일으키는 **기능/상세기능 id**(`F1`, `F3:0`). 뷰어가 라벨을 그 기능 제목으로 자동 표시하고, 기능명세서에서 이름을 바꾸면 플로우 라벨도 자동으로 따라 바뀐다. 전환이 특정 기능 실행으로 일어나면 `ref`를 쓴다.
  - **`label`**: 기능으로 잡히지 않는 순수 상태 전환(예 "로그인 성공", "완료 후 홈")일 때만 자유 텍스트로 쓴다.
  - 한 전환에 `ref`와 `label`을 동시에 두면 검증에 실패한다.
- **분기**(한 화면에서 여러 갈래)와 **루프**(되돌아오는 흐름)를 표현한다.
- `prd.scenarios` 기반으로 해피패스 + 주요 분기·루프를 담아라. 부챗살 나열이 아니라 실제 이동 경로여야 한다.

### transition 필드 규칙 (엄격)

- 각 항목은 `{ "from":"P#", "to":"P#" }`, `{ "from":"P#", "to":"P#", "ref":"F#" }`, `{ "from":"P#", "to":"P#", "label":"..." }` 중 하나만 사용한다.
- `source`, `target`, `fromPage`, `toPage`, `action`, `name` 등 다른 필드명 금지.
- `from`/`to`는 반드시 `ia`에 존재하는 페이지 id(`P#`). 기능 id(`F#`)는 `from`/`to`에 넣지 말고 **`ref`에만** 쓴다.
- `ref`는 requirements에 실제로 존재하는 기능(`F#`) 또는 상세기능(`F#:인덱스`) id여야 한다.
- `start`는 진입 페이지의 `P#`.
