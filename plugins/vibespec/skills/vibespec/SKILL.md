---
name: vibespec
description: >-
  제품 아이디어나 기획 문서로 PRD·기능명세서·IA·유저플로우가 담긴 단일 SOT(JSON)와 편집용 HTML 뷰어를 생성하고, 기존 SOT의 국소 수정, 그리고 본편 위에 얹는 증분 이니셔티브 생성까지 처리한다. Turn a product idea or planning document into a single SOT (JSON) plus an HTML viewer with PRD, Feature Spec, IA, and User Flow; also applies targeted edits to an existing SOT and creates incremental "initiatives" layered on a main SOT. 트리거/triggers: 기획도구·기획서·PRD·기능명세·IA·유저플로우 만들어줘, SOT 생성·수정, 기능 추가 이니셔티브, 결제/검색 기능 얹어줘, 사업계획서로 기획, make a planning tool, generate a PRD/spec, update my SOT, add a feature initiative on top of an existing product. 기획 문서나 기존 .sot.json을 첨부하며 요청할 때도 사용.
---

# SOT 기획 도구 생성

사용자의 제품 아이디어나 첨부된 기획 문서를 단일 SOT JSON으로 변환하고, 편집용 뷰어 HTML과 함께 전달한다.
뷰어는 고정 뼈대다 — 절대 뷰어 HTML을 수정하지 말고 데이터(JSON)만 생성한다.

**언어(Language).** 뷰어 UI는 한/영 토글을 지원한다. 사용자가 영어로 요청하면 SOT의 텍스트(title·prd·requirements·ia·flow의 라벨)를 영어로 생성하고, SOT 최상위에 `"lang": "en"` 을 넣어 뷰어가 영어로 열리게 한다. 한국어면 `lang` 을 생략하거나 `"ko"` 로 둔다. (If the user writes in English, generate all SOT text in English and set top-level `"lang": "en"` so the viewer opens in English.)

## 절차

1. **입력 수집 및 모드 판별**
   - **먼저 사전판별을 돌려 사실을 확보한다(추측 금지).** `.sot.json`(또는 그것이 든 폴더)이 첨부·제시되면 `node "<VIBESPEC_SKILL_DIR>/scripts/inspect.mjs" "<파일 또는 폴더 절대경로>" --json`을 실행한다. 출력은 각 파일의 종류(main/initiative), 트리 유효성·활성/기준낡음, **다음 발급 path**, `needsRebase`, `incompleteTree`, `suggestedModes`를 담는다. 이 값으로 결정적으로 라우팅한다.
   - **라우팅 규칙 — 아래 순서대로 판정한다(차단 조건이 먼저다).** `suggestedModes`가 곧 판정 결과이니 그것을 신뢰하고, 순서를 뒤집어 도구 판단을 무시하지 말 것.
     1. **차단**: `invalidReason`이 있으면(=`suggestedModes`가 `["repair"]`) 다른 모드를 시도하지 말고 그 오류를 알리고 고친다. 사유는 셋 — 인식 불가 SOT(지원하지 않는 `schemaVersion`), 본편 다중, 구조 오류(경계 대상 없음·id 중복·순환 등). **구조 오류가 있으면 stale이더라도 rebase를 먼저 하지 말 것** — rebase는 구조 오류가 있는 트리에 기록을 거부하므로 막다른 길이다.
     2. **본편 부족**: `incompleteTree`가 true면(이니셔티브만 있고 본편 없음) 트리 작업을 하지 말고 **본편 파일을 요청**한다.
     3. **재기준**: 위 둘이 아니고 `needsRebase`가 true면 그 사실을 알리고 → **재기준(rebase)**을 우선 제안한다.
     4. **신규 생성**: `.sot.json`이 하나도 없고 아이디어·기획 문서만 있으면 → **신규 생성**(아래 2~4단계, 본편 SOT 1.0). 인식 불가 파일이 섞여 있으면 여기로 오지 않는다(1번에서 차단) — 기존 파일을 새 기획으로 오인해 덮어쓰지 않기 위함이다.
     5. **수정**: main이 있고 요청이 작은 제자리 수정(오타·상태·수용 기준·문구)이면 → **수정 모드**.
     6. **이니셔티브**: main이 있고 요청이 범위 있는 증분("결제 얹어줘", "검색 개선 이니셔티브")이면 → **이니셔티브 모드**. 새 path는 inspect의 `nextPath`(예 `root→1-3`)를 그대로 쓴다(직접 번호를 지어내지 말 것). ⚠️ 단, `pathAuthority`가 `incomplete`이면(단일 파일만 줬을 때) 형제 이니셔티브를 놓쳐 번호를 재발급할 수 있으니, **제품 폴더 전체를 inspect에 다시 넘겨** `complete` 상태로 만든 뒤 발급한다.
     7. **조망**: "전체를 한눈에/합쳐 보여줘"(편집이 아닌 조망)면 → **제품 지도**.
   - 수정 vs 이니셔티브가 애매하면 한 번 확인한다("본편을 직접 고칠까요, 별도 이니셔티브로 얹을까요?"). 판단 기준: 기존 화면·기능의 소규모 교정=수정, 독립적으로 검토·승인·구현할 새 기능 묶음=이니셔티브.
   - 사용자가 제품을 설명했거나 문서를 첨부했으면 그것을 근거로 삼는다. 첨부 문서는 현재 플랫폼에서 제공하는 파일 읽기 도구로 읽는다.
   - 정보가 부족할 때만(제품 목적·핵심 사용자·주요 기능이 불명확) 2~3개 핵심 질문을 한다. 충분하면 묻지 말고 진행한다.
   - Node.js를 실행할 수 없는 환경에서는 inspect 없이 파일의 `schemaVersion`·`initiative` 유무로 직접 분류하고, path는 폴더 내 형제 중 최대 번호+1로 발급한다.

2. **SOT JSON 생성** — `references/sot-schema.md`의 스키마를 정확히 따른다. 기계 판독용 계약이 필요하면 `references/sot.schema.json`을 사용한다.
   - `title`, `prd`, `requirements`, `ia`, `flow` 를 채우고, 최상위에 `"schemaVersion": "1.0"` 을 넣는다(뷰어의 저장 기능이 출력하는 표준형과 같은 모양이 되도록).
   - `prd`는 6개 섹션을 모두 채운다: ①개요(oneLiner·goal·whyNow·category·platforms) ②문제·가치(problem·solution·alternatives·differentiator) ③사용자(targets·scenarios) ④성공지표(northStar·kpis) ⑤범위(inScope·nonGoals) ⑥리스크·가정(assumptions·risks·openQuestions·constraints).
     - `goal`은 비즈니스 성과 목표(가능하면 수치·기한), `whyNow`는 "왜 지금"(시장·타이밍), `problem`은 사용자 Job/문제, `alternatives`는 현재 대안·경쟁, `nonGoals`는 명시적 범위 밖, `assumptions`/`openQuestions`/`constraints`로 불확실성·제약을 남긴다.
     - **구조화 필드**: `targets`는 `{name,role,needs,pain}` 페르소나 객체 배열, `scenarios`는 `{text,start}` 객체 배열(`start`는 그 시나리오가 시작되는 ia 페이지 `P#`, 선택), `kpis`는 `{name,target,baseline,method,refs}` 객체 배열(`refs`는 그 지표를 움직이는 기능 `F#`/`F#:인덱스`). `northStar`는 하나의 문자열. KPI의 `refs`와 시나리오의 `start`를 채우면 PRD가 기능·플로우와 연결된다.
   - `requirements`는 요구사항 → 기능 → 상세기능 3계층. id는 `R1..`, `F1..`(전체에서 유일하게 증가). 상세기능 참조는 `기능id:인덱스`(예 `F1:0`).
   - `ia.sections`를 만들고 모든 기능/상세기능을 페이지(top/page/action)의 `refs`로 매핑한다.
   - **커버리지**: 모든 `F#`와 모든 `F#:idx`가 IA의 어떤 페이지 `refs`에든 최소 1번 등장해야 한다(뷰어의 "누락 경고"가 뜨지 않도록).
   - **`flow`(유저플로우)** 를 만든다: 화면 전환 `transitions`(from→to)를 `prd.scenarios` 기반으로 정의한다. IA 포함관계가 아니라 유저의 실제 이동 경로다 — 해피패스 + 주요 분기·루프를 담아라. from/to는 ia 페이지 id(P#).
     - **트리거는 가능하면 `ref`로 잡아라(권장).** 전환이 특정 기능/상세기능 실행으로 일어나면 `{ "from":"P#", "to":"P#", "ref":"F#" }`(또는 `"ref":"F#:인덱스"`)로 쓴다. 그러면 뷰어가 라벨을 그 기능 제목으로 자동 표시하고, 기능명세서에서 이름을 바꾸면 플로우 라벨도 자동으로 따라 바뀐다. 기능으로 잡히지 않는 순수 상태 전환("로그인 성공", "완료 후 홈")만 `{ "from":"P#", "to":"P#", "label":"..." }`로 쓴다. `ref`와 `label`을 한 전환에 동시에 두지 말 것.
     - ⚠️ 각 transition 객체는 `{from,to,ref}` 또는 `{from,to,label}` 형태만 사용한다. `source/target`, `fromPage/toPage`, `action`, `name` 같은 다른 필드명을 절대 쓰지 말 것 — 뷰어가 걸러내 빈 화면이 된다.
     - from/to는 반드시 **ia.sections 안에 실제로 존재하는 페이지 id(`P#`)**. 기능 id(`F#`)는 from/to에 넣지 말고 `ref`에만 쓴다.
   - 상세기능에도 가능하면 `desc`와 `acceptance`를 채워 완성도를 높인다.

3. **산출물 저장** (outputs 폴더)
   - `<제품명>.sot.json` — 생성한 SOT JSON(순수 데이터, 공유·백업용).
   - JSON 저장 직후, HTML에 넣기 전에 이 `SKILL.md`가 있는 디렉터리의 절대 경로를 `<VIBESPEC_SKILL_DIR>`로 확인하고 `node "<VIBESPEC_SKILL_DIR>/scripts/validate-sot.mjs" "<outputs 절대 경로>/<제품명>.sot.json"`을 실행한다. 현재 작업 디렉터리를 기준으로 `scripts/...`를 실행하지 말 것. `FAIL`이면 보고된 경로를 고치고 `PASS`가 될 때까지 다시 검증한다. 경고는 검토하되 의도적으로 플로우에서 제외한 보조 화면이면 허용할 수 있다. Node.js를 실행할 수 없는 환경에서는 같은 항목(필수 구조, ID 중복, IA 커버리지, KPI·시나리오·flow 참조)을 수동 점검한다.
   - `<제품명>.html` — 이 스킬의 `assets/viewer.html`을 복사하되, 파일 안의 `<script type="application/json" id="embedded-sot"></script>` 태그의 내용으로 생성한 SOT JSON을 넣는다. (넣기 전 `JSON.stringify(sot).replace(/</g, "\u003c")` 로 `<`를 이스케이프해 `</script>` 조기 종료를 막는다. 뷰어는 이 태그를 최우선으로 읽어 데모 대신 사용자의 제품을 바로 표시한다.)
   - ⚠️ 반드시 embedded-sot 태그에 데이터를 심어라. 비워두면 데모만 보인다.
   - 현재 플랫폼이 지원하는 파일 전달 방식으로 두 파일을 함께 제공한다. 로컬 작업 환경에서는 사용자가 바로 열 수 있도록 두 파일의 절대 경로를 명확히 안내한다.

4. **사용법 안내**(평이한 표현)
   - `<제품명>.html`을 브라우저로 열면 사용자 제품이 바로 표시된다(불러오기 불필요).
   - 편집은 뷰어에서, 저장은 저장(JSON 내보내기)으로. 되돌리기·히스토리도 지원한다.

## 수정 모드 (기존 SOT 국소 수정)

기존 `.sot.json`에 변경을 적용할 때는 재생성이 아니라 **최소 편집**이다. 원본 파일은 그대로 두고, 수정본을 outputs 폴더에 쓴 뒤 아래를 지킨다.

1. **id는 절대 재발급하지 않는다.** 기존 `R#`·`F#`·`S#`·`P#`와 상세기능 인덱스(`F#:i`)를 바꾸거나 번호를 당기지 않는다. 새 항목의 id는 파일 전체에서 해당 접두사의 최대 번호 + 1. 상세기능·시나리오는 배열 끝에만 추가한다(중간 삽입은 `F#:i` 참조를 어긋나게 한다).
2. **요청 범위 밖은 건드리지 않는다.** 부탁받지 않은 문장을 다듬거나 재서술하지 않는다 — 목표는 diff에 요청한 변경만 남는 것.
3. **삭제 시 참조를 정리한다.** 기능을 지우면 IA 페이지 `refs`, flow의 `ref`, KPI `refs`에서도 제거한다. 삭제된 id는 재사용 금지.
4. **검증**: 신규 생성과 동일하게 `validate-sot.mjs`를 PASS까지 돌린다.
5. **변경 리포트**: `node "<VIBESPEC_SKILL_DIR>/scripts/diff-sot.mjs" "<원본 경로>" "<수정본 경로>"`를 실행해 그 출력(변경 목록·영향 반경·바이트 동일 섹션)을 사용자에게 요약 전달한다. 영향 반경에 뜬 화면·전환·KPI는 함께 검토가 필요하다는 신호다. diff에 요청 범위 밖 변경이 보이면 되돌리고 다시 diff한다.
6. **산출물**: 수정된 `<제품명>.sot.json`과 embedded-sot를 갱신한 `<제품명>.html`을 신규 생성과 같은 방식으로 전달한다.

## 이니셔티브 모드 (본편 위에 얹는 증분, SOT 1.1)

본편(1.0)을 **그대로 두고**, 그 위에 얹히는 증분을 **별도의 1.1 파일**로 만든다. 본편이 비대해지지 않고, 이니셔티브를 독립적으로 검토·승인·구현할 수 있다. 계약 상세는 `references/sot-schema.md`의 "이니셔티브(SOT 1.1)" 절.

1. **본편을 읽는다.** 첨부·경로로 받은 본편 `.sot.json`을 읽어 접점(이 증분이 어느 화면·기능에서 시작·연결되는지)과 `productId`로 쓸 안정 slug를 파악한다. 본편은 절대 수정하지 않는다.

2. **이니셔티브 SOT를 만든다** (schemaVersion `"1.1"`). 최상위 `initiative` 메타를 넣는다:
   ```json
   "initiative": { "productId": "<제품 slug>", "id": "<이니셔티브 slug>", "path": "<경로>", "status": "proposed",
     "parent": { "scopeId": "root", "canonicalization": "sot-c14n-v1", "digest": "<본편 digest>" } }
   ```
   - `productId`·`id`: 소문자 slug(`^[a-z0-9][a-z0-9-]*$`). `id`는 같은 제품 안에서 유일·불변, `"root"` 금지.
   - `parent.scopeId`: 본편에 붙으면 `"root"`, 다른 이니셔티브 위에 얹으면 그 이니셔티브의 `id`.
   - `parent.digest`: **부모 파일로부터 계산**한다 — `node "<VIBESPEC_SKILL_DIR>/scripts/sot-digest.mjs" "<부모 sot.json 절대경로>"`의 출력(`sha256:...`)을 그대로 넣는다. 손으로 만들지 말 것.
   - `path`: 부모가 `root`면 `1-<n>`(형제 중 최대 번호+1, 없으면 `1-1`), 부모가 이니셔티브면 `<부모 path>-<n>`(정확히 한 세그먼트 추가). validate-tree가 이 규칙을 강제한다.

3. **경량 PRD** (§7). 이니셔티브 PRD는 본편과 다르다:
   - **필수**: `problem`·`solution`(비어있지 않게), `inScope`·`nonGoals`(이 증분이 더하는 것 / 명시적으로 안 하는 것). 이게 이니셔티브의 핵심이다.
   - 선택: `goal`·`oneLiner`·스코프된 `kpis`·`scenarios`·`targets`.
   - **제품 정체성 필드 금지**: `category`·`platforms`·`northStar`·`differentiator`·`alternatives`는 넣지 않는다(본편 소관 — 넣으면 검증기가 경고하고 뷰어가 제거를 요구한다).

4. **접점을 경계 스텁으로 표현한다.** 증분이 본편의 화면에서 시작·연결되면, 그 접점을 `boundary`가 있는 페이지로 IA에 넣는다:
   ```json
   { "id":"P1", "title":"<본편 페이지 제목 그대로>", "type":"<본편 페이지 타입 그대로>", "refs":[],
     "boundary": { "scopeId":"root", "pageId":"<본편의 그 페이지 P#>" }, "children":[ …이 증분의 화면들… ] }
   ```
   - 스텁의 `title`·`type`은 **본편 페이지를 그대로 미러링**한다(다르면 validate-tree가 drift 경고). 스텁은 참조이므로 자체 `refs`를 두지 않는다. 이 증분의 새 화면들은 스텁의 `children`으로 매단다.

5. **나머지는 신규 생성과 동일.** `requirements`(R1/F1..은 이 파일 안에서 새로 시작), `ia` 커버리지(이 파일의 모든 `F#`·`F#:idx`가 페이지 refs에 등장), `flow`(from/to는 이 파일의 페이지 id — 경계 스텁 포함). 트리거 `ref` 규칙 등 2단계의 flow 규칙을 그대로 지킨다.

6. **검증(2단계)**:
   - 파일 단독: `node "<VIBESPEC_SKILL_DIR>/scripts/validate-sot.mjs" "<이니셔티브 절대경로>"` → PASS.
   - 트리(본편+이니셔티브가 든 폴더): `node "<VIBESPEC_SKILL_DIR>/scripts/validate-tree.mjs" "<폴더 절대경로>"` → 오류 0. digest·경계 대상 실존·path·순환을 교차 검사한다. 오류가 나면 고치고 다시 돌린다.

7. **산출물**: `<제품명>.<path>.<id>.sot.json`(예 `shop.1-2.payment.sot.json`)으로 저장하고, 신규 생성과 같은 방식으로 embedded-sot를 심은 HTML을 함께 낸다. 뷰어는 이니셔티브 헤더 밴드·경량 PRD·경계 스텁 읽기전용을 자동으로 보여준다. 본편 파일은 그대로 두고, 사용자에게 "본편은 수정하지 않았고 결제 이니셔티브만 추가했다"처럼 명확히 안내한다.

## 재기준(rebase) — 본편이 바뀐 뒤 이니셔티브 갱신

본편을 수정(수정 모드)하면 본편의 digest가 바뀌어, 그 본편을 기준으로 기록해 둔 이니셔티브들이 **stale**이 된다. digest는 Merkle 체인이라 자동 전파되지 않는다 — 조상을 rebase하면 그 노드 해시가 바뀌어 자식이 다시 stale이 되므로 **root→leaf 순서로 연쇄**해야 한다.

1. 본편+이니셔티브가 든 폴더에서 먼저 **드라이런**: `node "<VIBESPEC_SKILL_DIR>/scripts/rebase.mjs" "<폴더 절대경로>"`. 어떤 이니셔티브가 어떤 순서로 갱신되는지 계획이 출력된다.
2. 적용: `... rebase.mjs "<폴더>" --apply`(전체 연쇄) 또는 `--apply --only <id,...>`(일부). 부모가 갱신되지 않은 자식은 기록을 거부하고 "stale로 남는다"고 리포트한다 — 조용한 부분 복구는 없다.
3. rebase는 **stale digest만** 고친다. 트리에 다른 오류(중복 id·구조 등)가 있으면 `--apply`가 거부되므로 validate-tree로 먼저 정리한다.
4. 갱신된 이니셔티브 파일들의 embedded-sot HTML도 다시 만들어 함께 전달하고, 무엇이 최신이 되었고 무엇이 남았는지 사용자에게 요약한다.

## 제품 지도 (본편+활성 이니셔티브 합성, 읽기 전용)

"제품 전체를 한눈에", "본편에 이니셔티브들 합쳐서 보여줘" 같은 조망 요청에는 편집용 뷰어 대신 **읽기 전용 제품 지도**를 낸다. 본편과 **활성**(approved-신선 + implemented) 이니셔티브를 합성해, 각 이니셔티브가 본편 화면 아래에 더한 화면을 복합 id로 보여준다.

1. 본편+이니셔티브가 든 폴더에서 지도 HTML을 만든다: `node "<VIBESPEC_SKILL_DIR>/scripts/product-map.mjs" "<폴더 절대경로>" --html "<outputs 절대경로>/<제품명>.map.html"`.
   - 트리에 오류가 있으면(특히 approved가 stale) 지도를 만들지 않는다 — 먼저 rebase로 정리하라는 메시지가 나온다.
   - `--json`으로 지도 데이터만 얻어 검토할 수도 있다.
2. 지도는 뷰어를 재사용하되 **읽기 전용**이다(편집 크롬 숨김). proposed·dropped·조상 비활성 이니셔티브는 합성에서 빠지고 "제외"로 표시된다. stale implemented는 "기준 낡음"으로 남는다.
3. 지도는 특정 시점의 스냅샷이다 — 편집은 여전히 개별 본편·이니셔티브 파일에서 하고, 필요할 때 지도를 다시 만든다.

## 참고
- 상세 스키마와 예시는 `references/sot-schema.md`(이니셔티브 1.1·경량 PRD·경계 스텁 포함).
- 표준 JSON Schema는 `references/sot.schema.json`. 단일 파일 검증기는 `scripts/validate-sot.mjs`, 교차 파일(트리) 검증기는 `scripts/validate-tree.mjs`.
- 라우팅 사전판별(입력 분류·다음 path·rebase 필요·추천 모드)은 `scripts/inspect.mjs`(`--json`).
- 부모 digest 계산은 `scripts/sot-digest.mjs`, 본편 변경 후 연쇄 재기준은 `scripts/rebase.mjs`, 두 SOT 변경·영향 비교는 `scripts/diff-sot.mjs`(`--json` 지원), 본편+활성 이니셔티브 합성 지도는 `scripts/product-map.mjs`(`--html`/`--json`).
- IA와 기능명세서는 refs로 연결된 별개 축이다. flow는 실제 이동 경로로 채운다.
- 이니셔티브 산출 파일은 항상 자기완결이다(본편 없이도 뷰어에서 열림). 본편 데이터를 이니셔티브에 복사하지 말고 경계 스텁으로만 접점을 표시한다.
