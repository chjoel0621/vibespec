---
name: vibespec
description: >-
  제품 아이디어나 기획 문서로 PRD·기능명세서·IA·유저플로우가 담긴 SOT(JSON)와 HTML 뷰어를 생성하고, KPI 측정 가능성 점검, ID 기반 안전 수정, 제품 기획 위 증분 추가 기획, 제품 검토 버전을 처리한다. Turn a product idea or planning document into a SOT (JSON) plus an HTML viewer with PRD, Feature Spec, IA, User Flow, and a KPI measurement readiness check; apply ID-addressed safe edits, create incremental initiatives, and build navigable product workspaces. 트리거/triggers: 기획도구·기획서·PRD·기능명세·IA·유저플로우 만들어줘, SOT 생성·수정, KPI 측정 가능성 검토, 기능 추가 기획, 결제/검색 기능 얹어줘, 제품 작업공간(통합·검토 버전), 사업계획서로 기획, make a planning tool, generate a PRD/spec, review KPI evidence, update my SOT, add a feature initiative on top of an existing product. 기획 문서나 기존 .sot.json을 첨부하며 요청할 때도 사용.
---

# VibeSpec

제품 아이디어나 기존 기획을 연결된 SOT JSON으로 만들고, 편집 가능한 HTML 뷰어와 함께 전달한다. HTML은 고정 앱이고 JSON이 데이터다. 뷰어 소스를 요청받지 않은 한 수정하지 않는다.

## 런타임 부트스트랩

1. 호스트가 이 스킬을 로드하며 제공한 **현재 `SKILL.md`의 절대 경로**를 확인하고, 그 부모를 `<VIBESPEC_SKILL_DIR>`로 사용한다. 현재 작업 폴더나 저장소 이름으로 추측하거나 전체 디스크를 검색하지 않는다.
2. 이 작업에서 처음 스크립트를 쓰기 전에 다음을 실행한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/doctor.mjs" "<사용자 작업 폴더>" --json`
3. doctor가 실패하거나 호스트가 스킬 경로·Node 실행을 제공하지 않으면 경로를 지어내지 않는다. 전체 기능이 필요한 이유와 실패 항목을 사용자에게 알리고 `references/workflows/common.md`의 축소 모드만 사용한다.

## 모드 판별

`.sot.json`이나 폴더가 있으면 먼저 다음을 실행한다.

`node "<VIBESPEC_SKILL_DIR>/scripts/inspect.mjs" "<파일 또는 폴더 절대경로>" --json`

`suggestedModes`와 아래 우선순위를 그대로 따른다.

1. `invalidReason` 또는 `suggestedModes=["repair"]` → 구조 복구. stale이어도 rebase보다 먼저다.
2. `legacyCount` → 원본을 덮지 않는 마이그레이션.
3. `incompleteTree` → 제품 기획 파일 요청.
4. `needsRebase` → 재기준 우선 제안.
5. SOT 없음 → 신규 제품 기획 생성.
6. 작은 제자리 교정 → ID 기반 수정.
7. 독립 검토·승인 가능한 새 기능 묶음 → 추가 기획. `pathAuthority=complete`인 폴더 inspect의 `nextPath`만 사용한다.
8. 전체 조망·제안 비교 → 검토/통합 버전.
9. 구현된 추가 기획을 기준선에 영구 반영 → 병합(land). 읽기 전용 합성과 혼동하지 않는다.

수정과 추가 기획이 애매할 때만 “제품 기획을 직접 고칠지, 별도 추가 기획으로 둘지” 한 번 확인한다. 제품 목적·핵심 사용자·주요 기능이 충분하면 추가 질문 없이 진행한다.

## 지연 로드

모드를 고른 뒤 `references/workflows/common.md`와 **해당 모드 하나만** 읽고 따른다. 관련 없는 모드 문서를 미리 읽지 않는다.

- 신규 생성 → `references/workflows/create.md`
- 수정·복구·마이그레이션 → `references/workflows/edit.md`
- 추가 기획 → `references/workflows/initiative.md`
- 재기준 → `references/workflows/rebase.md`
- 제품 작업공간·검토/통합 버전 → `references/workflows/workspace.md`
- 병합(land) → `references/workflows/merge.md`

## 공통 불변조건

- 기존 SOT를 수정할 때 전체 JSON을 재생성하지 않는다. query + change-plan-v2 + dry-run/apply 경로를 사용한다.
- ID는 안정 식별자다. 삭제한 ID를 재사용하지 않는다.
- 구조 검증은 PASS까지 고치고, 내용 리뷰 경고는 해소하거나 의도적 예외를 사용자에게 설명한다.
- `semantic`이 있는 SOT는 KPI 측정 가능성 점검을 실행한다. 측정 준비도가 blocked이면 초안은 전달할 수 있지만 승인 가능·개발 전달 준비 완료라고 표현하지 않는다. 사람의 결정을 AI가 임의로 확정해 차단을 숨기지 않는다.
- 산출물 JSON과 HTML은 같은 SOT에서 결정적으로 만든다.
- `--apply`는 사용자가 요청한 쓰기 작업에서만 실행하고, 드라이런 결과와 영향 범위를 먼저 확인한다.
