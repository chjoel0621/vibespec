# Existing VibeSpec case comparison

This comparison asks what Semantic Assurance can honestly say about plans made
before semantic 0.1, without silently upgrading or rewriting them.

## Selected sources

| Cohort | Existing plans | Structural/content review | Semantic status |
| --- | --- | --- | --- |
| Operations | CRM, incident management, survey/feedback management | valid, 0 advisory findings | `not-assessed` |
| Consumer | habit tracker, personal finance tracker, workout tracker | valid, 0 advisory findings | `not-assessed` |

All sources are pinned by canonical SOT digest and file SHA-256. Their 18 legacy
KPIs are observed but do not count as semantically assessed KPIs because they
have no K/E/D identities or typed measurements.

## Finding 1: operations templates share one KPI vocabulary

CRM, incident management, and survey/feedback management have the same three
KPI names and methods:

1. `기한 내 처리 비율` — `상태 변경과 목표 기한을 월별 집계`
2. `운영 가시성` — `등록 기록과 리포트 연결 비율`
3. `감사 가능 운영 비율` — `감사 로그와 변경 이력 월별 점검`

Their targets mention different business outcomes, but the measurement
vocabulary is still a shared operations template. A structurally valid plan and
a warning-free content review therefore do not prove domain-specific KPI
quality.

## Finding 2: consumer templates share one KPI vocabulary

Habit, finance, and workout trackers likewise share:

1. `첫 주 핵심 행동 완료율`
2. `주간 재방문율`
3. `사용자 데이터 제어 완료율`

The phrases are plausible across consumer products, but the “core action” is
not named as a product-specific event. Semantic annotation should force that
choice to become explicit instead of assigning an event automatically.

## Interpretation

- This is not a Semantic Assurance false positive: legacy documents are
  correctly left `not-assessed` with no invented findings.
- It is evidence that the generation workflow can produce domain-shaped PRD
  copy while retaining template-shaped KPI definitions.
- `survey` is not automatically the correct measurement mode for a survey
  product. Response rate is normally an event ratio; a satisfaction score may
  use `survey`. Mode selection follows the metric evidence, not the product
  category.
- Automatically adding K/E/D to all legacy files would hide this ambiguity and
  manufacture confidence. Each plan needs a reviewed semantic overlay or a new
  host generation.

## Candidate follow-up

Treat cross-document KPI duplication as generation-quality evidence, not a
single-SOT blocker. During the 0.17 sprint:

1. annotate one operations and one consumer case with a human-reviewed
   `change-plan-v2`;
2. record where mode selection is ambiguous rather than forcing readiness;
3. compare the annotated result with a fresh Claude/Codex generation from the
   same brief;
4. decide whether 0.17.1 needs generation guidance, catalog-level duplicate
   reporting, or finding explanation improvements.
