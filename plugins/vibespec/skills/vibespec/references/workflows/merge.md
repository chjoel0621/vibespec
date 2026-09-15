# 병합(land)

구현된 추가 기획을 편집 가능한 제품 기획 SOT 1.0에 영구 반영한다. 읽기 전용 지도 합성과 다르다.

1. 드라이런한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/merge.mjs" "<제품 폴더>" --only <추가 기획 id>`
2. 재번호·접점·PRD 검토 항목·stale 형제를 확인한다.
3. 조건이 맞을 때만 `--apply`한다.

도구가 강제하는 적격 조건:

- status가 `implemented`
- 제품 기획 직속
- 활성 자식 없음
- stale 외에도 트리 오류 없음

병합은 요구사항·화면·flow를 제품 기획 ID 공간으로 재번호하고 boundary를 해소한다. PRD는 `inScope`만 자동 추가하며 `problem`, `solution`, `nonGoals`, `goal`은 사람이 검토할 항목으로 남긴다. 적용된 추가 기획은 삭제하지 않고 `landed`로 보존한다.

제품 기획 digest가 바뀌므로 나머지 추가 기획의 stale을 보고하고 rebase로 이어간다. 최종 validate-sot/validate-tree와 제품 기획 HTML 재생성을 수행한다.

병합 보고서의 manualPrdReview·manualSemanticReview는 자동 반영되지 않는다. 해당 항목의 반영 또는 해당 없음 판단을 검토 기록에 남기고, 미반영 항목이 있으면 기능 병합 완료와 기획 전체 통합 완료를 구분해 보고한다. 현재 도구는 이 후속 검토의 영속 완료 상태를 자동 관리하지 않는다.
