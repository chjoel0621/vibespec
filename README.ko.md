# VibeSpec

**🌐 언어 / Language: [English](./README.md) · 한국어 (현재)**

> 바이브 코딩처럼, **기획도 바이브로.**
> 제품 아이디어나 기획 문서를 넣으면 하나의 **SOT(Single Source of Truth, JSON)** 로 정리하고,
> **PRD · 기능명세서 · IA(정보구조) · 유저플로우**를 한 화면에서 보고 편집하는 기획 도구입니다.

VibeSpec은 Claude Cowork / Claude Code와 OpenAI Codex에서 함께 쓸 수 있는 듀얼 포맷 **플러그인 마켓플레이스**입니다. 아이디어를 설명하거나 사업계획서·PRD 초안 같은 문서를 첨부하면, AI가 스키마에 맞는 SOT JSON을 생성하고 전용 HTML 뷰어로 열어 바로 편집할 수 있습니다.

**🕹️ [라이브 데모](https://chjoel0621.github.io/vibespec/)** — "내 제품 아이디어로 기획도구 만들어줘" 또는 사업계획서를 첨부해 요청하면 데모와 같은 HTML을 산출합니다. 설치 없이 브라우저에서 바로 뷰어를 체험해 보세요. 샘플 제품(회의실 예약 앱)이 열리고, 모든 항목을 편집할 수 있으며 저장을 누르면 SOT JSON이 내보내집니다. [영어 데모](https://chjoel0621.github.io/vibespec/en/)도 있습니다.

데모는 서로 연결된 세 페이지로 되어 있습니다. 오른쪽 아래 이동 바로 옮겨 다닐 수 있습니다 — **[제품 기획](https://chjoel0621.github.io/vibespec/)**, 그 위에 얹은 **[추가 기획](https://chjoel0621.github.io/vibespec/notif/)**(알림 증분), 둘을 합성한 **[통합 버전](https://chjoel0621.github.io/vibespec/map/)**. 합성 버전에서는 아무 노드나 누르면 그 노드를 정의한 문서가 열립니다.

**[두 번째 데모 — 동네장터](https://chjoel0621.github.io/vibespec/flea/)**(위치 기반 중고거래)는 **작업공간 데모**입니다. 승인된 안전결제(에스크로) 추가 기획 *와* 제안 단계인 가격 제안 증분을 함께 담고 있어, 합쳐진 두 화면을 비교할 수 있습니다 — **[통합 버전](https://chjoel0621.github.io/vibespec/flea/map/)**(출시할 것만) vs **[검토 버전](https://chjoel0621.github.io/vibespec/flea/workspace/)**(제안 중인 작업까지 포함). 같은 이동 바로 두 데모 사이를 오갈 수 있습니다.

## 핵심 개념

- **HTML = 앱(뷰어/편집기)** · **JSON = 데이터(SOT)** — 둘을 분리했습니다.
- 모든 화면이 **하나의 SOT**만 읽고 씁니다. 한 곳에서 고치면 나머지 뷰가 전부 동기화됩니다.
- 뷰어(앱)는 한 번만 공유하고, 이후에는 **JSON 파일만 주고받으면** 같은 화면을 봅니다.

## 5개 뷰

| 뷰 | 내용 |
| --- | --- |
| **PRD** | 개요 · 문제/가치 · 사용자 · 성공 지표 · 범위 · 리스크/가정 (6섹션). 페르소나 카드, 시나리오→유저플로우 연결, KPI 구조화(목표치·측정 + 기능 연결) |
| **기능명세서** | 요구사항 → 기능 → 상세기능 (상태·중요도·설명·수용 기준). 상세 패널에서 **연결(IA 화면·유저플로우·KPI)**과 **진행 요약**(상태 분포·수용 기준 달성률) 표시, 칩 클릭 시 해당 뷰로 이동 |
| **트리** | 요구사항 계층 노드 캔버스. 노드 클릭 시 기능명세서로 이동 |
| **IA (정보구조도)** | 섹션 → 페이지 → 행동 사이트맵. 기능↔화면 매핑, 누락 경고·자동 채우기 |
| **유저플로우** | 화면 전환 그래프 (시작 → 화면 이동, 분기·루프, 줌/이동). 패널에서 전환 추가·삭제, 트리거를 기능에 연결하면 라벨 자동 동기화, 미연결·누락 경고 |

## 설치

설치 방법은 사용하는 환경에 따라 다릅니다. Claude와 Codex의 플러그인 명령은 서로 다르며, 아래 `/plugin` 슬래시 명령은 **Claude Code 터미널 전용**이라 Cowork와 Codex에서는 동작하지 않습니다.

### Cowork (데스크탑 앱)

UI에서 클릭으로 설치합니다.

1. 왼쪽 사이드바에서 **Customize(커스터마이즈)** 를 엽니다.
2. **Plugins(플러그인)** 탭 → **개인 플러그인(Personal plugins)** 에서 **`+`** 버튼 → **Add marketplace(마켓플레이스 추가)** 를 누릅니다.
3. **GitHub 저장소**로 추가를 선택하고 `https://github.com/chjoel0621/vibespec.git` 를 입력합니다.
4. 추가된 마켓플레이스에서 `vibespec` 의 **Install(설치)** 을 누릅니다.
5. 업데이트도 같은 Plugins 화면에서 진행합니다.

> 참고: Cowork에서는 `/plugin` 명령이 인식되지 않습니다("Claude Code 터미널에서만 작동"). 반드시 위 UI 경로를 사용하세요.

### Claude Code (CLI · 터미널)

입력창(터미널)에 아래를 차례로 실행합니다.

```
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

업데이트는 `/plugin marketplace update vibespec` 후 `/plugin` 관리 화면의 Installed 탭에서 갱신합니다.

### OpenAI Codex (CLI / 데스크탑 앱)

저장소를 복제하고 저장소 내부 Codex 마켓플레이스를 등록합니다.

```
git clone https://github.com/chjoel0621/vibespec.git
codex plugin marketplace add <복제한-vibespec-저장소의-절대-경로>
```

그다음 ChatGPT 데스크톱 앱의 **Codex → Plugins**에서 `vibespec` 마켓플레이스를 고르고 VibeSpec을 설치한 뒤 새 작업을 시작합니다. Codex CLI에서는 `codex`를 실행하고 `/plugins`를 열어 `vibespec` 마켓플레이스에서 VibeSpec을 설치한 다음 새 세션을 시작합니다. 설치하거나 업데이트한 뒤 새 작업을 시작해야 스킬이 반영됩니다. 자연어로 요청하거나 `$vibespec`으로 직접 호출할 수 있습니다.

**첫 설치 수용 확인.** 쓰기 가능한 폴더에서 새 작업을 열고 `$vibespec`으로 “회의실 예약 기획을 간단히 만들고 `outputs/meeting-room.sot.json`과 `outputs/meeting-room.html`에 저장해줘”라고 요청합니다. 두 파일이 생기고, HTML을 열었을 때 뷰어 데모가 아닌 방금 만든 기획이 보이며, `node <VibeSpec-스킬-디렉터리>/scripts/validate-sot.mjs outputs/meeting-room.sot.json`이 `PASS`면 성공입니다. 새 작업에서 VibeSpec이 보이지 않으면 설치 뒤 작업을 다시 열거나 데스크톱 앱을 재시작하세요.

## 사용

"내 제품 아이디어로 기획도구 만들어줘" 또는 사업계획서를 첨부해 요청하면, 스킬이 SOT JSON을 담은 뷰어 HTML을 산출합니다. 열면 바로 5개 뷰가 표시되고, 편집·저장·불러오기가 됩니다.

**기존 기획 수정하기:** `*.sot.json`을 첨부하고 "F3 이름 바꾸고 수용 기준 하나 추가해줘"처럼 요청하세요. 스킬이 기존 id를 전부 보존한 채 최소한만 고치고, 검증을 통과시킨 뒤 무엇이 바뀌었는지·어디에 영향이 가는지(화면·전환·KPI)·어느 섹션이 바이트 단위로 그대로인지 리포트합니다.

**큰 기획도 안전하게 수정하기:** 스킬은 큰 JSON 전체를 다시 쓰지 않습니다. 요청한 requirement·기능·상세기능·section·화면 또는 PRD 필드만 읽고, base digest·안정 id·실제 diff 경로 전체를 명시한 `change-plan-v2`를 드라이런합니다. 기능·수용 기준·KPI·범위 항목이 참조와 함께 조용히 사라지는 누락을 막습니다. 적용한 plan과 기준·결과 해시 영수증은 `history/change-plans/`에 감사 이력으로 보관하고, `outputs/`에는 현재 SOT·HTML만 둡니다. 다만 boundary·initiative 메타 변경은 교차 파일 검증이 필요하므로 별도 트리 작업으로 처리합니다.

**추가 기획 추가하기(범위 있는 증분):** 제품 기획 `*.sot.json`을 첨부하고 "결제 기능 추가 기획으로 얹어줘"처럼 요청하세요. 제품 기획을 비대하게 만드는 대신, 스킬이 그 위에 얹히는 **별도 추가 기획 파일**(`<제품>.<경로>.<id>.sot.json`)을 만듭니다 — 자체 경량 PRD(문제·해결·포함범위·비목표)와, 제품 기획 화면에 붙는 지점을 표시하는 **경계(boundary)**를 담아서요. 제품 기획은 그대로 두므로 추가 기획을 독립적으로 검토·승인·출시할 수 있습니다. 각 추가 기획은 작성 기준이 된 제품 기획의 digest를 기록하고, 나중에 제품 기획이 바뀌면 스킬이 영향받은 추가 기획들을 **재기준(rebase)**(부모→자식 순서)해 조용한 드리프트가 없게 합니다.

**제품 전체 보기:** "통합 버전 보여줘"라고 하면 스킬이 제품 기획과 **활성** 추가 기획들을 하나의 읽기 전용 뷰로 합성합니다 — 각 추가 기획의 화면이 붙는 제품 기획 화면 아래에 접붙고, 복합 id(`root/P6`·`notif/P2`)로 출처를 보여줍니다. proposed·dropped 추가 기획은 "제외"로 표시됩니다. 
합성 버전은 그림이 아니라 **들어가는 입구**입니다. 각 scope의 원본 문서를 파일 안에 품고 있어서, **아무 노드나 누르면 그 화면을 정의한 기획서가 열립니다** — 읽기 전용이고, 합성 버전으로 돌아오는 링크가 있습니다. 파일 하나로 자기완결이라 합성 버전만 건네도 팀원이 제품 전체를 열람할 수 있습니다. 합성된 **[통합 버전 데모](https://chjoel0621.github.io/vibespec/map/)**(예약 앱 + 알림 추가 기획)를 열어보세요. [영어 합성 버전](https://chjoel0621.github.io/vibespec/en/map/)도 있습니다.

**작업 중인 제품 함께 검토하기:** 제품 폴더에 `main.sot.json` 하나와 `initiatives/` 아래 증분 파일들을 둡니다. workspace 빌더는 proposed·approved·implemented를 모두 포함한 자기완결 `workspace.html`을 만들고, 제품 기획·상위/하위 추가 기획·합성 버전을 오갈 수 있게 합니다. 별도 release map에서는 proposed를 출시 기능으로 취급하지 않습니다. 동네장터 데모에서 라이브로 보세요: [검토 버전](https://chjoel0621.github.io/vibespec/flea/workspace/)(제안 포함) vs [통합 버전](https://chjoel0621.github.io/vibespec/flea/map/)(제외).

### 스킬이 자동으로 안 뜰 때 (직접 호출)

자연어로 요청하면 스킬이 자동 발동하지만, 안 걸릴 때는 직접 부를 수 있습니다.

- **Cowork(데스크탑)**: 입력창에 `/` 를 입력하거나 `+` 버튼을 눌러 스킬 목록에서 **VibeSpec** 을 선택합니다.
- **Claude Code(터미널)**: `/vibespec:vibespec` 를 실행합니다.
- **Codex**: 새 작업에서 VibeSpec 플러그인/스킬을 선택하거나 `$vibespec`으로 호출합니다.

## 활용 팁

- **팀 협업은 JSON 파일만 공유하세요.** 뷰어(HTML)는 앱이라 한 번만 나눠 가지면 됩니다. 이후에는 저장(JSON 내보내기)으로 받은 `*.sot.json` 파일만 주고받으면, 상대가 같은 뷰어에서 불러오기로 열어 **똑같은 5개 뷰**를 봅니다. 무거운 문서를 계속 복사할 필요가 없습니다.

- **수정은 기능명세서에서 한 번만.** 모든 뷰가 하나의 SOT를 읽고 쓰기 때문에, 기능 이름을 바꾸면 유저플로우 라벨·KPI 연결·IA 매핑이 전부 자동으로 따라옵니다. 같은 내용을 여러 곳에 다시 쓰지 마세요.

- **AI로 초안부터 만들고 뷰어에서 다듬으세요.** 처음부터 완벽하게 쓰려 하지 말고, 아이디어나 사업계획서로 SOT를 생성한 뒤 뷰어에서 편집하는 흐름이 가장 빠릅니다.

- **큰 변경 전에는 히스토리를 믿으세요.** 되돌리기·히스토리로 특정 시점으로 복원할 수 있고, 초기화는 첫 버전으로 되돌립니다. 과감히 바꿔도 됩니다.

- **경고를 로드맵처럼 쓰세요.** IA의 "누락 경고"와 유저플로우의 "미연결" 표시는 빠진 화면·전환을 알려줍니다. 자동 채우기로 뼈대를 빠르게 세운 뒤 다듬으면 됩니다.

- **연결(추적성)으로 영향 범위를 확인하세요.** 기능명세서 상세 패널의 연결(IA·유저플로우·KPI)과 진행 요약을 보면 "이 기능을 빼면 어디가 영향받나"를 개발 착수 전에 점검할 수 있습니다.

- **KPI엔 기능을, 시나리오엔 시작화면을 연결해 두세요.** 지표-기능, 시나리오-플로우를 이어두면 이름이 바뀌어도 자동 반영되고, 칩을 눌러 바로 이동합니다. PRD가 살아 있는 허브가 됩니다.

- **`*.sot.json`을 버전 관리하세요.** SOT 파일을 git이나 드라이브에 두면 변경 이력과 백업이 됩니다. 이 JSON이 곧 개발자·AI 코딩 에이전트에게 넘길 스펙 원본입니다.

## 선택: Git으로 버전 관리 (팀 협업 시)

**Git은 필수가 아닙니다.** 혼자 쓴다면 뷰어의 되돌리기·히스토리(브라우저에 자동 저장)만으로 충분하고, 공유는 `*.sot.json` 파일을 아무 방법으로나 건네면 됩니다. 아래는 **여러 명이 함께 편집**하거나 **영구 이력이 필요할 때**의 선택지입니다.

데이터가 순수 `*.sot.json` 파일이라, 이 파일을 Git에 넣으면 별도 도구 없이 **이력·브랜치·리뷰·되돌리기**를 Git이 다 해줍니다.

- **저장이 Git 친화 파일을 만듭니다.** 저장(내보내기)은 표준 JSON을 출력합니다 — 키 정렬을 고정하고 pretty-print하며 `schemaVersion`을 포함합니다. 파일명이 날짜 없이 `<제품명>.sot.json`으로 고정되므로, 내려받은 파일을 저장소의 같은 이름 위에 덮어쓰면 됩니다(git이 파일 교체를 삭제＋추가로 오인하지 않습니다). 같은 내용은 항상 동일하게 직렬화되므로 실제로 바뀐 곳만 diff에 남습니다.
- **권장 흐름.** 뷰어에서 편집 → **저장** → 저장소의 `*.sot.json` 교체 → 커밋 / PR. 동료는 pull 후 같은 뷰어로 열어 **똑같은 5개 뷰**를 봅니다.
- **`.gitattributes`.** SOT를 텍스트·일관된 줄바꿈으로 다루도록 추가하세요:

  ```
  *.sot.json text eol=lf
  ```

- **병합.** 표준 포맷 덕에 대부분의 diff가 읽히고 충돌도 손으로 해결됩니다.

## 저장소 구조

```
vibespec/
├── .agents/plugins/marketplace.json   # Codex 저장소 마켓플레이스
├── .claude-plugin/marketplace.json     # 플러그인 카탈로그
├── plugins/vibespec/
│   ├── .codex-plugin/plugin.json       # Codex 플러그인 매니페스트
│   ├── .claude-plugin/plugin.json
│   └── skills/vibespec/
│       ├── agents/openai.yaml          # Codex 스킬 UI 메타데이터
│       ├── SKILL.md                    # 아이디어/문서 → SOT JSON 생성 (+ 국소 수정) 스킬
│       ├── references/sot-schema.md    # JSON 데이터 계약(스키마)
│       ├── references/sot.schema.json  # 기계 판독용 JSON Schema
│       ├── scripts/
│       │   ├── inspect.mjs             # 라우팅 사전판별(분류·다음 path·추천 모드)
│       │   ├── validate-sot.mjs        # 단일 파일 검증기(구조·참조·커버리지)
│       │   ├── validate-tree.mjs       # 교차 파일 검증(scope·digest·boundary·path)
│       │   ├── sot-digest.mjs          # 부모 digest 계산(추가 기획이 기록할 값)
│       │   ├── rebase.mjs              # 제품 기획 변경 후 root→leaf 연쇄 재기준
│       │   ├── merge.mjs               # 구현된 추가 기획을 제품 기획에 접어 넣기(land)
│       │   ├── product-map.mjs         # 제품 기획+활성 추가 기획 합성 버전(--html/--json)
│       │   ├── diff-sot.mjs            # 두 SOT의 변경·영향 반경 리포트
│       │   ├── embed-sot.mjs           # SOT를 뷰어 embedded-sot 태그에 주입
│       │   └── lib/                    # 공용: c14n(sot-c14n-v1)·diff·tree·rebase·product-map·inspect
│       ├── tests/                      # 검증기·트리·재기준·합성 버전·inspect + 헤드리스 뷰어 회귀
│       ├── assets/viewer.html          # HTML 뷰어(앱) — 빌드 산출물
│       ├── src/                        # 뷰어 소스 (styles.css, head.html, js/NN-*.js)
│       ├── build.mjs                   # src/ 를 단일 파일 뷰어로 인라인
│       └── package.json                # npm run build · check · validate
├── demo/                               # 데모 제품 둘(ko/en), 각각 제품 기획 + 승인된 추가 기획을
│                                       #   합성 버전로: meeting-room-booking(/), flea-market(/flea/).
│                                       #   nav.mjs가 페이지를 잇고 두 제품을 상호 연결
├── .github/workflows/                  # CI(빌드+테스트)와 Pages 데모 배포
├── LICENSE
├── README.md                           # 영어(기본)
└── README.ko.md                        # 한국어
```

### 뷰어 수정하기

`assets/viewer.html`은 생성되는 파일입니다. `src/` 아래 모듈을 편집한 뒤 다시 빌드하고, 둘을 함께 커밋하세요.

```
cd plugins/vibespec/skills/vibespec
npm run check       # 빌드 + 구문 + 스키마/왕복 + Claude/Codex 플러그인 계약
npm run check:all   # check + Chrome/Edge 대형 플로우 레이아웃 검사
```

생성하거나 편집한 SOT 파일은 아래처럼 별도로 검증할 수 있습니다. JSON Schema 구조뿐 아니라 ID 중복, IA 기능 커버리지, KPI·시나리오·유저플로우 참조까지 검사합니다.

```
npm run validate -- path/to/product.sot.json
```

두 버전의 SOT를 비교하려면(무엇이 바뀌었는지·어디에 영향이 가는지(화면·전환·KPI)·무엇이 바이트 단위로 그대로인지):

```
node scripts/diff-sot.mjs before.sot.json after.sot.json
```

제품 트리(제품 기획 + 추가 기획들)를 사전판별·검증하고, 제품 기획이 바뀐 뒤 재기준하고, 읽기전용 통합 버전을 합성하려면:

```
node scripts/inspect.mjs path/to/product-folder          # 입력 분류·다음 path·추천 모드
node scripts/validate-tree.mjs path/to/product-folder    # scope·digest·boundary·path 검사
node scripts/rebase.mjs path/to/product-folder           # 드라이런 연쇄; --apply로 기록
node scripts/merge.mjs path/to/product-folder --only <id> # 구현된 추가 기획을 제품 기획에 접어 넣기(--apply)
node scripts/product-map.mjs path/to/product-folder --html map.html   # 읽기전용 합성 버전
node scripts/workspace.mjs path/to/product-folder                    # workspace.html + release-map.html
node scripts/query-sot.mjs main.sot.json --ids F3,P8 --json          # 필요한 수정 문맥만 조회
node scripts/apply-change-plan.mjs main.sot.json history/change-plans/edit.plan.json  # 드라이런; --apply --receipt history/change-plans/edit.receipt.json으로 기록
node scripts/review-sot.mjs main.sot.json                            # 내용 품질 경고 검토
node scripts/migrate-sot.mjs old.sot.json --out main.sot.json       # 구버전 승격 드라이런; --apply로 기록
```

구버전 SOT는 먼저 뷰어에서 불러온 뒤 저장하여 1.0 형식으로 승격하고, 새로 저장된 파일을 검증하세요. 뷰어의 불러오기가 구형 KPI·시나리오·필드명을 현재 구조로 정규화합니다.

빌드는 `src/js/*.js`를 파일명 순서대로 하나의 스코프에 이어붙이므로, `90-init.js`(이벤트 배선·부팅)는 항상 마지막에 정렬돼야 합니다. npm 의존성이나 설치 과정은 없습니다. 로컬 Chrome 또는 Edge는 `npm run check:browser`나 `npm run check:all`에서만 필요합니다.

## 라이선스

[MIT](./LICENSE) © 2026 chjoel0621
