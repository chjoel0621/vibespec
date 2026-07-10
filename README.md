# VibeSpec

> 바이브 코딩처럼, **기획도 바이브로.**
> 제품 아이디어나 기획 문서를 넣으면 하나의 **SOT(Single Source of Truth, JSON)** 로 정리하고,
> **PRD · 기능명세서 · IA(정보구조) · 유저플로우**를 한 화면에서 보고 편집하는 기획 도구입니다.

VibeSpec은 Claude Cowork / Claude Code용 **플러그인 마켓플레이스**입니다. 아이디어를 설명하거나 사업계획서·PRD 초안 같은 문서를 첨부하면, AI가 스키마에 맞는 SOT JSON을 생성하고 전용 HTML 뷰어로 열어 바로 편집할 수 있습니다.

## 핵심 개념

- **HTML = 앱(뷰어/편집기)** · **JSON = 데이터(SOT)** — 둘을 분리했습니다.
- 모든 화면이 **하나의 SOT**만 읽고 씁니다. 한 곳에서 고치면 나머지 뷰가 전부 동기화됩니다.
- 뷰어(앱)는 한 번만 공유하고, 이후에는 **JSON 파일만 주고받으면** 같은 화면을 봅니다.

## 5개 뷰

| 뷰 | 내용 |
| --- | --- |
| **PRD** | 개요 · 문제/가치 · 사용자 · 성공 지표(North Star·KPI) · 범위(비목표) · 리스크/가정 |
| **기능명세서** | 요구사항 → 기능 → 상세기능 (상태·중요도·설명·수용 기준) |
| **트리** | 요구사항 계층 노드 캔버스. 노드 클릭 시 기능명세서로 이동 |
| **IA (정보구조도)** | 섹션 → 페이지 → 행동 사이트맵. 기능↔화면 매핑, 누락 경고·자동 채우기 |
| **유저플로우** | 화면 전환 그래프 (시작 → 화면 이동, 분기·루프, 줌/이동) |

## 설치

```
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

## 사용

"내 제품 아이디어로 기획도구 만들어줘" 또는 사업계획서를 첨부해 요청하면, 스킬이 SOT JSON을 담은 뷰어 HTML을 산출합니다. 열면 바로 5개 뷰가 표시되고, 편집·저장·불러오기가 됩니다.

## 저장소 구조

```
vibespec/
├── .claude-plugin/marketplace.json     # 플러그인 카탈로그
├── plugins/vibespec/
│   ├── .claude-plugin/plugin.json
│   └── skills/vibespec/
│       ├── SKILL.md                    # 아이디어/문서 → SOT JSON 생성 스킬
│       ├── references/sot-schema.md    # JSON 데이터 계약(스키마)
│       └── assets/viewer.html          # HTML 뷰어(앱)
├── LICENSE
└── README.md
```

## 라이선스

[MIT](./LICENSE) © 2026 chjoel0621
