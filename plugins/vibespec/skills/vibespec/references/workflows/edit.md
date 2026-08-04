# 기존 SOT 수정·복구·마이그레이션

## ID 기반 수정

전체 SOT를 다시 출력하지 않는다.

1. 필요한 문맥만 조회한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/query-sot.mjs" "<sot>" --ids R1,F5,F5:0,S2,P8,K1,E1,D1 --prd problem,kpis --json`
2. `vibespec-change-plan-v2`에 `baseDigest`, `operations`, `expected.touchedIds/addedIds/removedIds/touchedPaths`를 정확히 넣는다.
3. plan은 `history/change-plans/<날짜>-<요약>.plan.json`에 둔다. 적용 후 다시 실행하지 않는다.
4. 드라이런 후 요청 범위와 같을 때만 적용한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/apply-change-plan.mjs" "<sot>" "<plan>"`
   `node "<VIBESPEC_SKILL_DIR>/scripts/apply-change-plan.mjs" "<sot>" "<plan>" --apply --receipt "<receipt>"`

지원 연산은 문서/PRD, requirement/feature/spec, section/page, flow 전환과 Semantic Assurance의 타입 지정 연산이다. 의미 계약 활성화, KPI 측정, 이벤트, 결정을 바꿀 때도 `change-plan-v2`의 전용 연산과 K/E/D expected ID를 사용한다. 범용 JSON Patch와 전체 배열 교체는 쓰지 않는다. 상세기능은 append 또는 마지막 항목 삭제만 허용하고 수정·삭제 시 현재 값을 `before`로 증명한다. boundary와 initiative 메타는 단일 파일 plan으로 수정하지 않는다.

삭제는 `removedIds`와 `touchedPaths`에 명시되지 않으면 적용하지 않는다. 큰 개편은 작은 계획으로 나누고 삭제·추가·영향 반경을 먼저 제시한다.

적용 뒤 validate-sot, review-sot, `semantic`이 있으면 review-semantic, 필요하면 validate-tree를 실행하고 HTML을 다시 만든다. 의미 검토 보고서는 편집 전 결과를 재사용하지 않는다.

## 복구와 마이그레이션

inspect의 `invalidReason`을 먼저 고친다. 지원하지 않는 명시 버전을 다른 역할로 해석하지 않는다.

schemaVersion이 생략된 레거시는 다음 명령으로 새 파일에 승격한다. 원본 경로를 `--out`으로 쓰지 않는다.

`node "<VIBESPEC_SKILL_DIR>/scripts/migrate-sot.mjs" "<input>" --out "<new-output>"`

드라이런과 검증 후에만 `--apply`를 붙인다.
