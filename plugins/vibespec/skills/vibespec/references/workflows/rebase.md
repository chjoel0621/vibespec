# 재기준(rebase)

제품 기획 변경 뒤 parent digest가 stale인 추가 기획을 root→leaf 순서로 갱신한다.

1. 구조 오류를 먼저 고친다. rebase는 stale digest 외 오류를 고치지 않는다.
2. 드라이런한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/rebase.mjs" "<제품 폴더>"`
3. 전체 적용은 `--apply`, 부분 적용은 `--apply --only <id,...>`를 쓴다.
4. 실제 부모가 적용되지 않은 자식은 기록하지 않는다. 남은 stale을 사용자에게 보고한다.
5. 갱신된 추가 기획 HTML을 다시 만들고 validate-tree로 최종 확인한다.

Merkle digest는 자동 전파되지 않는다. 부모 해시가 바뀌면 자식도 다시 stale이므로 계획 순서를 바꾸지 않는다.

rebase는 참조 기준 digest를 갱신하며 내용의 정책 적합성을 검증하지 않는다. 적용 전 이전/현재 부모의 변경과 영향받는 추가 기획 내용을 검토하고 필요하면 먼저 수정한다. 이전 기준선이 없어 비교할 수 없으면 미검토 상태와 이유를 보고한다. 최신 해시만으로 내용 검토·승인·운영 확인이 완료됐다고 표현하지 않는다.
