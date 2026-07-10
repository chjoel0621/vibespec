---
name: vibespec
description: 제품 아이디어나 기획 문서로 PRD·기능명세서·IA·유저플로우가 담긴 단일 SOT(JSON)와 편집용 HTML 뷰어를 생성한다. Turn a product idea or planning document into a single SOT (JSON) plus an HTML viewer with PRD, Feature Spec, IA, and User Flow. 트리거/triggers: 기획도구·기획서·PRD·기능명세·IA·유저플로우 만들어줘, SOT 생성, 사업계획서로 기획, make a planning tool, generate a PRD/spec, create IA and user flow. 기획 문서를 첨부하며 산출물을 요청할 때도 사용.
---

# SOT 기획 도구 생성

사용자의 제품 아이디어나 첨부된 기획 문서를 단일 SOT JSON으로 변환하고, 편집용 뷰어 HTML과 함께 전달한다.
뷰어는 고정 뼈대다 — 절대 뷰어 HTML을 수정하지 말고 데이터(JSON)만 생성한다.

**언어(Language).** 뷰어 UI는 한/영 토글을 지원한다. 사용자가 영어로 요청하면 SOT의 텍스트(title·prd·requirements·ia·flow의 라벨)를 영어로 생성하고, SOT 최상위에 `"lang": "en"` 을 넣어 뷰어가 영어로 열리게 한다. 한국어면 `lang` 을 생략하거나 `"ko"` 로 둔다. (If the user writes in English, generate all SOT text in English and set top-level `"lang": "en"` so the viewer opens in English.)

## 절차

1. **입력 수집**
   - 사용자가 제품을 설명했거나 문서를 첨부했으면 그것을 근거로 삼는다. 첨부 문서는 Read로 읽는다.
   - 정보가 부족할 때만(제품 목적·핵심 사용자·주요 기능이 불명확) 2~3개 핵심 질문을 한다. 충분하면 묻지 말고 진행한다.

2. **SOT JSON 생성** — `references/sot-schema.md`의 스키마를 정확히 따른다.
   - `title`, `prd`, `requirements`, `ia`, `flow` 를 채운다.
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
   - `<제품명>.html` — 이 스킬의 `assets/viewer.html`을 복사하되, 파일 안의 `<script type="application/json" id="embedded-sot"></script>` 태그의 내용으로 생성한 SOT JSON을 넣는다. (넣기 전 `JSON.stringify(sot).replace(/</g, "\u003c")` 로 `<`를 이스케이프해 `</script>` 조기 종료를 막는다. 뷰어는 이 태그를 최우선으로 읽어 데모 대신 사용자의 제품을 바로 표시한다.)
   - ⚠️ 반드시 embedded-sot 태그에 데이터를 심어라. 비워두면 데모만 보인다.
   - present_files로 두 파일을 함께 전달한다.

4. **사용법 안내**(평이한 표현)
   - `<제품명>.html`을 브라우저로 열면 사용자 제품이 바로 표시된다(불러오기 불필요).
   - 편집은 뷰어에서, 저장은 저장(JSON 내보내기)으로. 되돌리기·히스토리도 지원한다.

## 참고
- 상세 스키마와 예시는 `references/sot-schema.md`.
- IA와 기능명세서는 refs로 연결된 별개 축이다. flow는 실제 이동 경로로 채운다.
