# 추가 기획 생성(SOT 1.1)

제품 기획은 그대로 두고 독립 검토할 증분을 별도 SOT로 만든다.

1. 제품 폴더 전체를 inspect해 `pathAuthority=complete`와 `nextPath`를 얻는다.
2. 부모 digest를 계산한다.
   `node "<VIBESPEC_SKILL_DIR>/scripts/sot-digest.mjs" "<부모 sot>"`
3. 최상위 initiative를 작성한다.

```json
{
  "productId": "<제품 slug>",
  "id": "<추가 기획 slug>",
  "path": "<inspect nextPath>",
  "status": "proposed",
  "parent": {
    "scopeId": "root",
    "canonicalization": "sot-c14n-v1",
    "digest": "sha256:..."
  }
}
```

`productId/id`는 소문자 slug이고 id는 유일·불변이며 `root`가 될 수 없다. 부모가 추가 기획이면 `scopeId`는 그 id다.

## 경량 PRD

`problem`, `solution`, `inScope`, `nonGoals`는 필수다. 필요한 `goal`, `kpis`, `scenarios`, `targets`를 추가할 수 있다. 제품 기획 소관인 `category`, `platforms`, `northStar`, `differentiator`, `alternatives`는 넣지 않는다.

추가 기획도 `semantic.contractVersion: "semantic-0.1"`을 사용한다. KPI·이벤트·결정은 이 파일 범위의 로컬 `K1..`, `E1..`, `D1..`로 발급하고, 해당 범위의 기능·화면 증거만 연결한다. 제품 기획의 의미 ID를 복사해 같은 ID 공간인 것처럼 참조하지 않는다. 병합 시 도구가 제품 기획 공간으로 재번호하며, 의미 내용 자체는 자동 승인하지 않고 검토 항목으로 보고한다.

## 경계 스텁

제품 기획의 접점 화면과 그 섹션을 boundary로 미러링한다. 스텁의 title/type은 부모와 같고 자체 refs는 비운다. 새 화면은 페이지 스텁 children에 둔다. 기존 섹션을 미러링하면 section boundary도 두고, 완전히 새 섹션이면 boundary를 두지 않는다.

상세 예시는 `references/sot-schema.md`의 SOT 1.1 절을 따른다. 이 파일의 모든 기능/spec은 자체 IA refs에 매핑하고 flow의 from/to는 이 파일의 경계 스텁을 포함한 페이지 ID를 쓴다.

검증은 두 단계다.

```text
node "<VIBESPEC_SKILL_DIR>/scripts/validate-sot.mjs" "<추가 기획>"
node "<VIBESPEC_SKILL_DIR>/scripts/review-sot.mjs" "<추가 기획>" --profile <operations|consumer|marketplace>
node "<VIBESPEC_SKILL_DIR>/scripts/review-semantic.mjs" "<추가 기획>" --json
node "<VIBESPEC_SKILL_DIR>/scripts/validate-tree.mjs" "<제품 폴더>"
```

파일명은 `<제품>.<path>.<id>.sot.json`이고 같은 JSON에서 HTML을 만든다. 제품 기획을 수정하지 않았음을 사용자에게 명시한다.
