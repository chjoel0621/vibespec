# VibeSpec

> 바이브 코딩처럼, **기획도 바이브로.**
> 제품 아이디어나 기획 문서를 넣으면 하나의 **SOT(Single Source of Truth, JSON)** 로 정리하고,
> **PRD · 기능명세서 · IA(정보구조) · 유저플로우**를 한 화면에서 보고 편집하는 기획 도구입니다.

VibeSpec은 Claude Cowork / Claude Code용 **플러그인 마켓플레이스**입니다. 아이디어를 설명하거나 사업계획서·PRD 초안 같은 문서를 첨부하면, AI가 스키마에 맞는 SOT JSON을 생성하고 전용 HTML 뷰어로 열어 바로 편집할 수 있습니다.

---

## 핵심 개념

- **HTML = 앱(뷰어/편집기)** · **JSON = 데이터(SOT)** — 둘을 분리했습니다.
- 모든 화면이 **하나의 SOT**만 읽고 씁니다. 한 곳에서 고치면 나머지 뷰가 전부 동기화됩니다.
- 뷰어(앱)는 한 번만 공유하고, 이후에는 **JSON 파일만 주고받으면** 같은 화면을 봅니다.

### 5개 뷰 (하나의 SOT에서 파생)

| 뷰 | 내용 |
| --- | --- |
| **PRD** | 개요 · 핵심 가치 · 타겟/시나리오 · 성공 지표 · 속성 설정 |
| **기능명세서** | 요구사항 → 기능 → 상세기능 (상태·중요도·설명·수용 기준) |
| **트리** | 요구사항 계층을 노드 캔버스로. 노드 클릭 시 기능명세서로 이동 |
| **IA (정보구조도)** | 섹션 → 페이지 → 행동 사이트맵. 기능↔화면 매핑, 누락 경고·자동 채우기 |
| **유저플로우** | IA를 타입 노드(시작·섹션 최상위·페이지·행동) 흐름으로 파생 |

---

## 설치

Claude Cowork 또는 Claude Code에서:

```
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

> GitHub 저장소는 `chjoel0621/vibespec` 짧은 형태로도 대개 인식됩니다.

---

## 사용법

### 1) 스킬로 생성

아래처럼 요청하거나, 사업계획서·기획 문서를 첨부하며 요청하세요.

- "내 제품 아이디어로 기획도구 만들어줘"
- "이 사업계획서로 PRD·기능명세·IA·유저플로우 만들어줘"
- "제품 설명으로 SOT 스펙 생성해줘"

스킬이 **`<제품명>.sot.json`** 과 **뷰어 HTML**을 산출합니다.

### 2) 뷰어에서 열고 편집

1. 뷰어 HTML을 브라우저로 엽니다.
2. 상단 **불러오기**로 생성된 JSON을 선택하면 5개 뷰가 채워집니다.
3. 텍스트·상태·수용 기준·화면 매핑 등을 그 자리에서 편집합니다.

**주요 버튼**

- **저장** — 현재 SOT를 JSON 파일로 내보내기 (백업·공유용)
- **불러오기** — 저장한 JSON 다시 열기
- **히스토리 / ↩ ↪** — 변경 이력에서 특정 시점 복원, 실행 취소·다시 실행 (Ctrl+Z)
- **초기화** — 이 문서를 연 시점의 첫 버전으로 복원
- **SOT 보기** — 전체 데이터(JSON) 확인

### 3) 팀 공유

뷰어 HTML은 한 번만 공유하고, 이후에는 **JSON 파일**만 주고받으면 됩니다. 받은 사람이 같은 뷰어에서 불러오면 동일한 화면을 봅니다.

---

## 저장소 구조

```
vibespec/                          # 마켓플레이스 저장소
├── .claude-plugin/
│   └── marketplace.json           # 플러그인 카탈로그
├── plugins/
│   └── vibespec/                  # 플러그인
│       ├── .claude-plugin/plugin.json
│       └── skills/vibespec/
│           ├── SKILL.md           # 아이디어/문서 → SOT JSON 생성 스킬
│           ├── references/sot-schema.md   # JSON 데이터 계약(스키마)
│           └── assets/viewer.html         # HTML 뷰어(앱)
├── LICENSE
└── README.md
```

---

## 업데이트

1. 파일을 수정합니다.
2. `plugins/vibespec/.claude-plugin/plugin.json`의 `version`을 올립니다 (예: `0.1.0` → `0.1.1`).
3. 커밋 후 푸시합니다.

```bash
git add .
git commit -m "뷰어 개선"
git push
```

사용자는 `/plugin marketplace update`로 최신본을 받습니다. (버전을 올리지 않으면 git 커밋마다 새 버전으로 취급됩니다.)

---

## 라이선스

[MIT](./LICENSE) © 2026 chjoel0621
