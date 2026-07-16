---
name: vibespec
description: >-
  제품 아이디어나 기획 문서로 PRD·기능명세서·IA·유저플로우가 담긴 SOT(JSON)와 HTML 뷰어를 생성하고, ID 기반 안전 수정, 제품 기획 위 증분 추가 기획, 제품 검토 버전을 처리한다. Turn a product idea or planning document into a SOT (JSON) plus an HTML viewer with PRD, Feature Spec, IA, and User Flow; apply ID-addressed safe edits, create incremental initiatives, and build navigable product workspaces. 트리거/triggers: 기획도구·기획서·PRD·기능명세·IA·유저플로우 만들어줘, SOT 생성·수정, 기능 추가 기획, 결제/검색 기능 얹어줘, 제품 작업공간(통합·검토 버전), 사업계획서로 기획, make a planning tool, generate a PRD/spec, update my SOT, add a feature initiative on top of an existing product. 기획 문서나 기존 .sot.json을 첨부하며 요청할 때도 사용.
---

# SOT 기획 도구 생성

사용자의 제품 아이디어나 첨부된 기획 문서를 단일 SOT JSON으로 변환하고, 편집용 뷰어 HTML과 함께 전달한다.
뷰어는 고정 뼈대다 — 절대 뷰어 HTML을 수정하지 말고 데이터(JSON)만 생성한다.

**언어(Language).** 뷰어 UI는 한/영 토글을 지원한다. 사용자가 영어로 요청하면 SOT의 텍스트(title·prd·requirements·ia·flow의 라벨)를 영어로 생성하고, SOT 최상위에 `"lang": "en"` 을 넣어 뷰어가 영어로 열리게 한다. 한국어면 `lang` 을 생략하거나 `"ko"` 로 둔다. (If the user writes in English, generate all SOT text in English and set top-level `"lang": "en"` so the viewer opens in English.)

## 절차

1. **입력 수집 및 모드 판별**
   - **먼저 사전판별을 돌려 사실을 확보한다(추측 금지).** `.sot.json`(또는 그것이 든 폴더)이 첨부·제시되면 `node "<VIBESPEC_SKILL_DIR>/scripts/inspect.mjs" "<파일 또는 폴더 절대경로>" --json`을 실행한다. 출력은 각 파일의 종류(main/initiative), 트리 유효성·활성/기준낡음, **다음 발급 path**, `needsRebase`, `incompleteTree`, `suggestedModes`를 담는다. 이 값으로 결정적으로 라우팅한다.
   - **라우팅 규칙 — 아래 순서대로 판정한다(차단 조건이 먼저다).** `suggestedModes`가 곧 판정 결과이니 그것을 신뢰하고, 순서를 뒤집어 도구 판단을 무시하지 말 것.
     1. **차단**: `invalidReason`이 있으면(=`suggestedModes`가 `["repair"]`) 다른 모드를 시도하지 말고 그 오류를 알리고 고친다. 사유는 셋 — 인식 불가 SOT(지원하지 않는 `schemaVersion`), 제품 기획 다중, 구조 오류(경계 대상 없음·id 중복·순환 등). 레거시 파일이 섞여 있어도 인식 불가 파일이 하나라도 있으면 먼저 repair다. **구조 오류가 있으면 stale이더라도 rebase를 먼저 하지 말 것** — rebase는 구조 오류가 있는 트리에 기록을 거부하므로 막다른 길이다.
     2. **마이그레이션**: 위 차단 사유가 없고 `legacyCount`가 있으면(`schemaVersion`이 생략된 구버전 파일) 다른 변경 전에 `node "<VIBESPEC_SKILL_DIR>/scripts/migrate-sot.mjs" "<입력>" --out "<새 파일>"`을 드라이런하고, 결과 검증 뒤에만 `--apply`로 새 파일을 쓴다. 원본을 덮어쓰지 않는다.
     3. **제품 기획 부족**: `incompleteTree`가 true면(추가 기획만 있고 제품 기획 없음) 트리 작업을 하지 말고 **제품 기획 파일을 요청**한다.
     4. **재기준**: 위 셋이 아니고 `needsRebase`가 true면 그 사실을 알리고 → **재기준(rebase)**을 우선 제안한다.
     5. **신규 생성**: `.sot.json`이 하나도 없고 아이디어·기획 문서만 있으면 → **신규 생성**(아래 2~4단계, 제품 기획 SOT 1.0). 인식 불가 파일이 섞여 있으면 여기로 오지 않는다(1번에서 차단) — 기존 파일을 새 기획으로 오인해 덮어쓰지 않기 위함이다.
     6. **수정**: main이 있고 요청이 작은 제자리 수정(오타·상태·수용 기준·문구)이면 → **수정 모드**.
     7. **추가 기획**: main이 있고 요청이 범위 있는 증분("결제 얹어줘", "검색 개선 추가 기획")이면 → **추가 기획 모드**. 새 path는 inspect의 `nextPath`(예 `root→1-3`)를 그대로 쓴다(직접 번호를 지어내지 말 것). ⚠️ 단, `pathAuthority`가 `incomplete`이면(단일 파일만 줬을 때) 형제 추가 기획을 놓쳐 번호를 재발급할 수 있으니, **제품 폴더 전체를 inspect에 다시 넘겨** `complete` 상태로 만든 뒤 발급한다.
     8. **조망**: "전체를 한눈에/합쳐 보여줘", "제품 기획과 제안을 오가며 검토"면 → **제품 작업공간(통합·검토 버전)**.
     9. **병합(land)**: "이 추가 기획을 제품 기획에 접어/병합해줘"처럼 **구현된 추가 기획을 제품 기획 baseline에 영구 반영**하라는 요청이면 → **병합 모드**. 통합·검토 버전(읽기전용 조망)과 다르다 — 버전은 스냅샷, 병합은 제품 기획 파일을 실제로 바꾼다.
   - 수정 vs 추가 기획이 애매하면 한 번 확인한다("제품 기획을 직접 고칠까요, 별도 추가 기획으로 얹을까요?"). 판단 기준: 기존 화면·기능의 소규모 교정=수정, 독립적으로 검토·승인·구현할 새 기능 묶음=추가 기획.
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
   - 구조 검증 다음에 `node "<VIBESPEC_SKILL_DIR>/scripts/review-sot.mjs" "<outputs 절대 경로>/<제품명>.sot.json"`을 실행한다. 이는 실패를 막는 검증기가 아니라 **내용 품질 리뷰**다. 모호한 수용 기준, 빈 nonGoals, 얇은 problem/solution, IA에는 있으나 flow 트리거가 없는 기능을 사용자에게 경고·질문으로 전달한다.
   - `<제품명>.html`은 **JSON을 직접 복사하거나 다시 작성하지 말고**, 다음 결정적 명령으로 만든다. 이 도구가 `<` 이스케이프와 embedded-sot 주입을 맡아 JSON과 HTML이 갈라지는 것을 막는다:
     `node "<VIBESPEC_SKILL_DIR>/scripts/embed-sot.mjs" "<VIBESPEC_SKILL_DIR>/assets/viewer.html" "<outputs 절대경로>/<제품명>.sot.json" "<outputs 절대경로>/<제품명>.html"`
   - ⚠️ 반드시 이 명령으로 embedded-sot 태그에 데이터를 심어라. 비워두면 데모만 보이고, JSON을 수동 복사하면 두 산출물이 서로 다른 버전이 될 수 있다.
   - 현재 플랫폼이 지원하는 파일 전달 방식으로 두 파일을 함께 제공한다. 로컬 작업 환경에서는 사용자가 바로 열 수 있도록 두 파일의 절대 경로를 명확히 안내한다.

4. **사용법 안내**(평이한 표현)
   - `<제품명>.html`을 브라우저로 열면 사용자 제품이 바로 표시된다(불러오기 불필요).
   - 편집은 뷰어에서, 저장은 저장(JSON 내보내기)으로. 되돌리기·히스토리도 지원한다.

## 수정 모드 (기존 SOT 국소 수정)

기존 `.sot.json`에 변경을 적용할 때는 재생성이 아니라 **ID 기반 변경 계획**이다. AI가 큰 SOT를 통째로 다시 출력하거나 재정렬하지 않는다. 작은 수정은 아래의 결정적 도구 경로를 기본으로 쓴다.

1. **필요한 문맥만 조회한다.** `node "<VIBESPEC_SKILL_DIR>/scripts/query-sot.mjs" "<sot 절대경로>" --ids R1,F5,F5:0,S2,P8 --prd problem,kpis --json`처럼 요청한 requirement·feature·상세기능·section·화면과 필요한 PRD 필드만 읽는다. 출력의 `baseDigest`와 그 문맥만 근거로 삼고, 전체 SOT를 AI가 재직렬화하지 않는다.
2. **변경 계획 v2를 만든다.** `vibespec-change-plan-v2` JSON에 `baseDigest`, `operations`, `expected.touchedIds/addedIds/removedIds/**touchedPaths**`를 모두 넣는다. `touchedPaths`는 실제 diff 경로 전체와 정확히 일치해야 하므로, id 없는 PRD·acceptance 항목도 조용히 사라질 수 없다. v1은 기존 계획 호환용일 뿐 새 계획에 쓰지 않는다. 계획 파일은 `outputs/`에 두지 말고 `<제품 폴더>/history/change-plans/<날짜>-<요약>.plan.json`에 둔다. `outputs/`에는 현재 열람용 SOT·HTML만 둔다.
   - 지원 연산: 문서 제목/언어(`updateDocument`), PRD 텍스트(`updatePrdText`)·목록 항목 append/update/remove, requirement·feature·section의 추가/수정/삭제, feature 이동, 상세기능 update/append/final-remove, page 추가/수정/삭제/이동, flow start·전환 추가/삭제/수정.
   - 범용 JSON Patch, 전체 배열 교체, 위치 기반 중간 삽입은 쓰지 않는다. 상세기능은 `F#:index` 참조가 있으므로 append 또는 **마지막 항목만** 삭제한다. 수정·삭제에는 현재 상세기능 전체를 `before`로 넣어 정확한 대상을 증명한다.
   - **경계(boundary)와 initiative 메타는 이 단일 파일 계획으로 수정하지 않는다.** 제품 기획 소유 접점은 부모 파일과 함께 검증해야 하므로, 제품 기획/추가 기획 구조를 다시 설계하고 `validate-tree`를 통과시키는 별도 트리 작업으로 처리한다.
3. **삭제는 명시적 승인 대상이다.** 기능·requirement·section·page를 지우거나 PRD 목록에서 항목을 제거할 때, 해당 삭제 경로와 안정 id가 `expected.removedIds/touchedPaths`에 정확히 선언되지 않으면 적용 도구가 거부한다. 삭제 id는 재사용하지 않는다.
4. **드라이런 후 적용한다.** `node "<VIBESPEC_SKILL_DIR>/scripts/apply-change-plan.mjs" "<sot 절대경로>" "<plan 절대경로>"`로 변경·영향을 확인하고, 사용자 요청 범위와 일치할 때만 `--apply --receipt "<제품 폴더>/history/change-plans/<같은-요약>.receipt.json"`을 붙인다. receipt는 적용된 계획의 base digest·결과 digest·변경 경로를 기록한다. history의 plan은 감사 기록이며, 적용 뒤에는 base digest가 의도적으로 낡으므로 **다시 실행하지 않는다**. 다음 수정에는 새 plan을 만든다. base digest가 달라졌거나 예상 ID 집합과 실제 diff가 다르면 기록하지 않는다.
5. **검증과 산출물 갱신.** 적용 뒤 `validate-sot.mjs`를 PASS까지 돌리고 `review-sot.mjs`의 내용 품질 경고를 함께 검토한다. 제품 작업공간이면 `validate-tree.mjs`도 실행한다. 단일 SOT의 HTML은 3단계와 같은 `embed-sot.mjs` 명령으로 다시 만든다. 큰 구조 개편은 먼저 삭제·추가 목록과 영향 반경을 사용자에게 제시해 확인받고, 작은 계획 여러 개로 나눠 적용한다.

## 추가 기획 모드 (제품 기획 위에 얹는 증분, SOT 1.1)

제품 기획(1.0)을 **그대로 두고**, 그 위에 얹히는 증분을 **별도의 1.1 파일**로 만든다. 제품 기획이 비대해지지 않고, 추가 기획을 독립적으로 검토·승인·구현할 수 있다. 계약 상세는 `references/sot-schema.md`의 "추가 기획(SOT 1.1)" 절.

1. **제품 기획을 읽는다.** 첨부·경로로 받은 제품 기획 `.sot.json`을 읽어 접점(이 증분이 어느 화면·기능에서 시작·연결되는지)과 `productId`로 쓸 안정 slug를 파악한다. 제품 기획은 절대 수정하지 않는다.

2. **추가 기획 SOT를 만든다** (schemaVersion `"1.1"`). 최상위 `initiative` 메타를 넣는다:
   ```json
   "initiative": { "productId": "<제품 slug>", "id": "<추가 기획 slug>", "path": "<경로>", "status": "proposed",
     "parent": { "scopeId": "root", "canonicalization": "sot-c14n-v1", "digest": "<제품 기획 digest>" } }
   ```
   - `productId`·`id`: 소문자 slug(`^[a-z0-9][a-z0-9-]*$`). `id`는 같은 제품 안에서 유일·불변, `"root"` 금지.
   - `parent.scopeId`: 제품 기획에 붙으면 `"root"`, 다른 추가 기획 위에 얹으면 그 추가 기획의 `id`.
   - `parent.digest`: **부모 파일로부터 계산**한다 — `node "<VIBESPEC_SKILL_DIR>/scripts/sot-digest.mjs" "<부모 sot.json 절대경로>"`의 출력(`sha256:...`)을 그대로 넣는다. 손으로 만들지 말 것.
   - `path`: 부모가 `root`면 `1-<n>`(형제 중 최대 번호+1, 없으면 `1-1`), 부모가 추가 기획면 `<부모 path>-<n>`(정확히 한 세그먼트 추가). validate-tree가 이 규칙을 강제한다.

3. **경량 PRD** (§7). 추가 기획 PRD는 제품 기획과 다르다:
   - **필수**: `problem`·`solution`(비어있지 않게), `inScope`·`nonGoals`(이 증분이 더하는 것 / 명시적으로 안 하는 것). 이게 추가 기획의 핵심이다.
   - 선택: `goal`·`oneLiner`·스코프된 `kpis`·`scenarios`·`targets`.
   - **제품 정체성 필드 금지**: `category`·`platforms`·`northStar`·`differentiator`·`alternatives`는 넣지 않는다(제품 기획 소관 — 넣으면 검증기가 경고하고 뷰어가 제거를 요구한다).

4. **접점을 경계 스텁으로 표현한다 — 페이지와 섹션 둘 다.** 증분이 제품 기획의 화면에서 시작·연결되면, 그 접점을 `boundary`가 있는 페이지로 IA에 넣고, **그 페이지를 감싸는 섹션에도 `boundary`를 달아 제품 기획의 어느 섹션인지 밝힌다**:
   ```json
   { "id":"S1", "title":"<제품 기획 섹션 제목 그대로>", "boundary": { "scopeId":"root", "sectionId":"<그 페이지가 든 제품 기획 섹션 S#>" },
     "pages":[
       { "id":"P1", "title":"<제품 기획 페이지 제목 그대로>", "type":"<제품 기획 페이지 타입 그대로>", "refs":[],
         "boundary": { "scopeId":"root", "pageId":"<제품 기획의 그 페이지 P#>" }, "children":[ …이 증분의 화면들… ] }
     ] }
   ```
   - 페이지 스텁의 `title`·`type`은 **제품 기획 페이지를 그대로 미러링**한다(다르면 drift 경고). 스텁은 참조이므로 자체 `refs`를 두지 않는다. 새 화면들은 스텁의 `children`으로 매단다.
   - **섹션 스텁의 `title`은 제품 기획 섹션을 그대로 미러링**하고, `sectionId`는 그 페이지 접점이 든 제품 기획 섹션이다. 이렇게 해야 추가 기획의 모든 계층이 **참조(미러) 또는 신규** 둘 중 하나로 명시되고, 합성 버전에서 조용히 사라지는 그릇 섹션이 생기지 않는다(감싸는 섹션에 boundary가 없으면 validate-tree가 "참조로 선언하거나 신규임을 명시하라"고 경고한다).
   - 반대로 증분이 제품 기획에 **없던 새 섹션**을 더하는 것이면, 그 섹션엔 `boundary`를 두지 않는다 — 합성 버전에 작성자가 지은 제목 그대로 `+추가 기획` 태그로 나타난다.

5. **나머지는 신규 생성과 동일.** `requirements`(R1/F1..은 이 파일 안에서 새로 시작), `ia` 커버리지(이 파일의 모든 `F#`·`F#:idx`가 페이지 refs에 등장), `flow`(from/to는 이 파일의 페이지 id — 경계 스텁 포함). 트리거 `ref` 규칙 등 2단계의 flow 규칙을 그대로 지킨다.

6. **검증(2단계)**:
   - 파일 단독: `node "<VIBESPEC_SKILL_DIR>/scripts/validate-sot.mjs" "<추가 기획 절대경로>"` → PASS.
   - 트리(제품 기획+추가 기획이 든 폴더): `node "<VIBESPEC_SKILL_DIR>/scripts/validate-tree.mjs" "<폴더 절대경로>"` → 오류 0. digest·경계 대상 실존·path·순환을 교차 검사한다. 오류가 나면 고치고 다시 돌린다.

7. **산출물**: `<제품명>.<path>.<id>.sot.json`(예 `shop.1-2.payment.sot.json`)으로 저장하고, 신규 생성 3단계의 `embed-sot.mjs` 명령으로 같은 파일에서 HTML을 만든다. 뷰어는 추가 기획 헤더 밴드·경량 PRD·경계 스텁 읽기전용을 자동으로 보여준다. 제품 기획 파일은 그대로 두고, 사용자에게 "제품 기획은 수정하지 않았고 결제 추가 기획만 추가했다"처럼 명확히 안내한다.

## 재기준(rebase) — 제품 기획이 바뀐 뒤 추가 기획 갱신

제품 기획을 수정(수정 모드)하면 제품 기획의 digest가 바뀌어, 그 제품 기획을 기준으로 기록해 둔 추가 기획들이 **stale**이 된다. digest는 Merkle 체인이라 자동 전파되지 않는다 — 조상을 rebase하면 그 노드 해시가 바뀌어 자식이 다시 stale이 되므로 **root→leaf 순서로 연쇄**해야 한다.

1. 제품 기획+추가 기획이 든 폴더에서 먼저 **드라이런**: `node "<VIBESPEC_SKILL_DIR>/scripts/rebase.mjs" "<폴더 절대경로>"`. 어떤 추가 기획이 어떤 순서로 갱신되는지 계획이 출력된다.
2. 적용: `... rebase.mjs "<폴더>" --apply`(전체 연쇄) 또는 `--apply --only <id,...>`(일부). 부모가 갱신되지 않은 자식은 기록을 거부하고 "stale로 남는다"고 리포트한다 — 조용한 부분 복구는 없다.
3. rebase는 **stale digest만** 고친다. 트리에 다른 오류(중복 id·구조 등)가 있으면 `--apply`가 거부되므로 validate-tree로 먼저 정리한다.
4. 갱신된 추가 기획 파일마다 신규 생성 3단계의 `embed-sot.mjs` 명령으로 HTML도 다시 만들고, 무엇이 최신이 되었고 무엇이 남았는지 사용자에게 요약한다.

## 제품 작업공간 (제품 기획 1개 + 병합 가능한 추가 기획)

제품 기획은 제품의 유일한 기준선이고, 추가 기획은 그 기준선 위에 얹는 병합 가능한 변경 SOT다. 아래 레이아웃을 쓴다. `history/`와 `output/`은 트리 입력이 아니므로 비교본·이전 산출물이 두 번째 제품 기획으로 오인되지 않는다.

```text
<product>/
  main.sot.json
  initiatives/
    1-1-<initiative>.sot.json
  history/
  output/
```

1. `node "<VIBESPEC_SKILL_DIR>/scripts/workspace.mjs" "<product 폴더 절대경로>"`를 실행한다. `output/workspace.html`(검토 버전)와 `output/release-map.html`(통합 버전)을 함께 만든다.
2. **workspace**는 제품 기획 + `proposed`·`approved`·`implemented` 추가 기획을 보여준다. proposed는 검토용일 뿐 활성/출시로 취급하지 않는다. 노드에서 문서를 열고, 문서 안에서 제품 기획·상위/하위 추가 기획·합성 버전으로 이동한다.
3. **release map**은 approved-신선 + implemented만 합성한다. dropped·landed는 어느 합성 버전에도 합성하지 않는다. 제품 기획 수정 뒤에는 rebase와 workspace 재생성을 수행한다.

## 통합 버전 (제품 기획+활성 추가 기획 합성, 읽기 전용)

"제품 전체를 한눈에", "제품 기획에 추가 기획들 합쳐서 보여줘" 같은 조망 요청에는 편집용 뷰어 대신 **읽기 전용 통합 버전**를 낸다. 제품 기획과 **활성**(approved-신선 + implemented) 추가 기획을 합성해, 각 추가 기획이 제품 기획 화면 아래에 더한 화면을 복합 id로 보여준다.

1. 통합 버전만 따로 만들 때: `node "<VIBESPEC_SKILL_DIR>/scripts/product-map.mjs" "<폴더 절대경로>" --html "<outputs 절대경로>/<제품명>.map.html"`. proposed까지 검토해야 하면 이 명령에 `--workspace`를 붙이거나 위의 `workspace.mjs`를 쓴다.
   - 트리에 오류가 있으면(특히 approved가 stale) 합성 버전을 만들지 않는다 — 먼저 rebase로 정리하라는 메시지가 나온다.
   - `--json`으로 합성 버전 데이터만 얻어 검토할 수도 있다(이때는 문서를 내장하지 않는다).
2. 합성 버전 HTML에는 **각 scope의 원본 문서가 내장**된다. 합성 버전은 그림이 아니라 입구다 — 노드나 범례를 누르면 그 화면을 정의한 문서(제품 기획/추가 기획)가 **읽기 전용**으로 열리고, "← 통합 버전"로 돌아온다. 파일 하나가 자기완결이므로 합성 버전만 넘겨도 팀원이 전체를 열람할 수 있다.
3. 합성 버전과 거기서 연 문서는 모두 읽기 전용이다(편집 크롬 숨김, 입력 잠금, 로컬 저장·되돌리기 없음). proposed·dropped·조상 비활성 추가 기획은 합성에서 빠지고 "제외"로 표시된다. stale implemented는 "기준 낡음"으로 남는다.
4. 합성 버전은 특정 시점의 스냅샷이다 — 편집은 여전히 개별 제품 기획·추가 기획 파일에서 하고, 필요할 때 합성 버전을 다시 만든다. 사용자에게 합성 버전을 건넬 때 이 점(스냅샷·읽기 전용·편집은 원본에서)을 한 줄로 알린다.

## 병합(merge) — 구현된 추가 기획을 제품 기획에 접어 넣기

추가 기획이 실제로 구현되면(`implemented`), 그 증분을 **제품 기획 baseline에 영구 반영**할 수 있다. 합성 버전이 읽기전용 스냅샷을 "그리는" 것과 달리, 병합은 같은 접붙임을 **편집 가능한 제품 기획 SOT 1.0에 실체화**한다(추가 기획의 id를 제품 기획 공간으로 재번호, 경계 스텁 해소, requirements·flow·inScope 병합). 노드 모델판 "제품 기획에 머지".

1. 제품 기획+추가 기획이 든 폴더에서 먼저 **드라이런**: `node "<VIBESPEC_SKILL_DIR>/scripts/merge.mjs" "<폴더 절대경로>" --only <추가 기획 id>`. 무엇이 제품 기획의 어느 id로 접붙고(R/F/P/S 재번호), 어디에 붙는지, PRD 중 수동 검토가 필요한 항목, 머지 후 stale이 되는 형제가 무엇인지 보여준다.
2. 적용: `... merge.mjs "<폴더>" --only <id> --apply`. 제품 기획 파일을 갱신하고, 그 추가 기획을 `landed`(접힘)로 표시한다(삭제하지 않음 — 이력 보존, 이후 합성·활성집합에서 제외).
3. **적격 조건**(도구가 강제): `implemented`만, **제품 기획 직속**만, **활성 자식이 없어야**(자식부터 land/drop), 트리에 다른 오류가 없어야. 하나라도 어긋나면 거부하고 사유를 알린다.
4. **PRD는 자동으로 다 합치지 않는다.** 추가 기획의 `inScope`만 제품 기획에 더하고, `problem`·`solution`·`nonGoals`·`goal`은 리포트에 "검토 필요"로 표시한다 — 제품 기획 서사에 사람이 판단해 반영한다.
5. **병합은 제품 기획 변경이라 나머지 추가 기획이 stale이 된다.** 도구는 이를 리포트만 하고 조용히 고치지 않는다 — 이어서 rebase로 갱신한다(재기준 절차). 사용자에게 "결제 추가 기획을 제품 기획에 접었고, 남은 N개는 rebase가 필요하다"처럼 명확히 안내한다.

## 참고
- 상세 스키마와 예시는 `references/sot-schema.md`(추가 기획 1.1·경량 PRD·경계 스텁 포함).
- 표준 JSON Schema는 `references/sot.schema.json`. 단일 파일 검증기는 `scripts/validate-sot.mjs`, 교차 파일(트리) 검증기는 `scripts/validate-tree.mjs`.
- 라우팅 사전판별(입력 분류·다음 path·rebase 필요·추천 모드)은 `scripts/inspect.mjs`(`--json`).
- 부모 digest 계산은 `scripts/sot-digest.mjs`, 레거시 승격은 `scripts/migrate-sot.mjs`, ID 범위 문맥 조회는 `scripts/query-sot.mjs`, 결정적 변경 계획 적용은 `scripts/apply-change-plan.mjs`, 내용 품질 리뷰는 `scripts/review-sot.mjs`, 제품 기획 변경 후 연쇄 재기준은 `scripts/rebase.mjs`, 구현된 추가 기획을 제품 기획에 접어 넣는 병합은 `scripts/merge.mjs`(`--only <id>`·`--apply`), 두 SOT 변경·영향 비교는 `scripts/diff-sot.mjs`(`--json` 지원), 작업공간 산출은 `scripts/workspace.mjs`, 제품 기획+활성 추가 기획 합성 버전은 `scripts/product-map.mjs`(`--html`/`--json`).
- IA와 기능명세서는 refs로 연결된 별개 축이다. flow는 실제 이동 경로로 채운다.
- 추가 기획 산출 파일은 항상 자기완결이다(제품 기획 없이도 뷰어에서 열림). 제품 기획 데이터를 추가 기획에 복사하지 말고 경계 스텁으로만 접점을 표시한다.
