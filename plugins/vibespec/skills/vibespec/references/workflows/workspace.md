# 제품 작업공간과 합성 버전

권장 레이아웃:

```text
<product>/
  main.sot.json
  initiatives/
  history/
  output/
```

`history/`와 `output/`은 트리 입력이 아니다.

## 검토/통합 버전 함께 생성

`node "<VIBESPEC_SKILL_DIR>/scripts/workspace.mjs" "<제품 폴더>"`

- `output/workspace.html`: proposed·approved·implemented를 포함하는 검토 버전.
- `output/release-map.html`: approved-신선 + implemented만 포함하는 통합 버전.
- dropped·landed는 합성하지 않는다.

## 통합 버전만 생성

`node "<VIBESPEC_SKILL_DIR>/scripts/product-map.mjs" "<제품 폴더>" --html "<output.map.html>"`

proposed까지 보려면 `--workspace`를 사용한다. 트리에 오류나 stale approved가 있으면 먼저 rebase한다.

합성 HTML은 각 scope 원본을 내장하며 노드/범례에서 정의 문서를 읽기 전용으로 연다. 특정 시점의 스냅샷이므로 편집은 개별 원본에서 하고 필요할 때 다시 생성한다. 사용자에게 읽기 전용 스냅샷임을 알린다.
