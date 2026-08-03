# 재기준(rebase)

제품 기획 변경 뒤 parent digest가 stale인 추가 기획을 root→leaf 순서로 갱신한다.

1. 구조 오류를 먼저 고친다. rebase는 stale digest 외 오류를 고치지 않는다.
2. 드라이런한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/rebase.mjs" "<제품 폴더>"`
3. 전체 적용은 `--apply`, 부분 적용은 `--apply --only <id,...>`를 쓴다.
4. 실제 부모가 적용되지 않은 자식은 기록하지 않는다. 남은 stale을 사용자에게 보고한다.
5. 갱신된 추가 기획 HTML을 다시 만들고 validate-tree로 최종 확인한다.

Merkle digest는 자동 전파되지 않는다. 부모 해시가 바뀌면 자식도 다시 stale이므로 계획 순서를 바꾸지 않는다.
