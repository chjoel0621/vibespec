# 선택적 기획 변경 이력

0.18.0의 선택적 초기 기능이다. 기존 SOT와 HTML 형식은 그대로 유지하고,
정규 제품 작업공간에 변경 전후 스냅샷과 검토 잔여 항목을 별도로 보존한다.

[명령·상태·복구 안내](../plugins/vibespec/skills/vibespec/references/lifecycle-journal.md)를
참고한다. 설치된 플러그인에서는 `node <스킬폴더>/scripts/lifecycle.mjs <제품폴더> status --json`을 사용한다.
소스 저장소의 스킬 폴더에서만 `npm run journal -- <제품폴더> status --json`도 사용할 수 있다.

자동으로 처리하는 것은 기준선 기록, 명시적 영향 추적, 오래된 검사 표시,
병합 잔여 항목 보존, ID 재사용 거절 및 인식 가능한 중단 쓰기의 복구다.
정책의 옳고 그름과 사람의 검토 완료는 자동 판단하지 않는다.

## 도입과 이전 버전 사용

0.17.2에서 SOT 스키마 마이그레이션은 필요하지 않다. 플러그인을 업데이트한 뒤
새 세션에서 설치 버전과 doctor 결과를 확인한다. 이력을 원할 때만 제품 폴더 전체를
백업하고 `init`의 dry-run을 확인한 다음 `--apply`로 등록한다.

이전 플러그인도 기존 형식의 SOT를 읽을 수 있지만 새 저널 보호를 수행하지 않는다.
이력이 있는 제품을 이전 버전으로 수정하면 이후 0.18.0에서 외부 변경으로 확인해야 한다.
되돌릴 때에는 같은 시점의 제품 파일과 `history/lifecycle`을 함께 복원한다.
저널만 삭제하거나 완료 기록을 편집해 오류를 없애지 않는다.

이 저널은 기획 변경 스냅샷과 잔여 검토를 보존하는 기능이다. Semantic Assurance의
사람 승인·면제·서명된 검토 증빙을 관리하는 별도 거버넌스 장부를 구현한 것은 아니다.

대체 관계를 지정하는 `--replacements` JSON은 객체여야 한다. 예를 들어
`{"root/F3":"root/F1"}`처럼 삭제한 ID와 남아 있는 대체 ID를 연결한다.
옵션 생략 또는 빈 객체는 대체 관계 없음으로 처리하지만, 명시적인 `false`,
`0`, 빈 문자열, `null`, 배열은 거절한다. 거절 시 새 이력을 기록하지 않는다.

## 파일 이동과 부모 누락

기획 파일을 정규 `initiatives` 경로 안에서 옮긴 뒤 capture하면 변경 요약의
`previousFile`과 `file`에 이전·새 경로를 남긴다. 내용과 scope ID가 같으면
내용 검사 결과를 만료시키거나 새 내용·부모 정책 검토를 만들지 않는다.
이동과 내용 수정이 함께 있으면 경로 이력과 내용 변경 검토를 모두 남긴다.
이전의 불변 기록을 고쳐 쓰지는 않으므로 과거 요약에 누락된 이동은 당시
전후 스냅샷에서 확인한다.

부모 파일이 없는 상태에서 부모 영향 분석에 도달하면 `missing parent scope`
오류로 기록을 거절한다. 오류에는 누락된 부모와 영향을 받는 기획의 scope가
포함된다. 원래 부모를 복원하거나, 의도적인 구조 변경이라면 부모·경로·boundary
참조를 먼저 올바르게 고친 뒤 capture한다. 부모의 내용이나 대체 관계를 자동
추정하지 않는다. 거절된 기록은 원본과 기존 이력 파일을 덮어쓰지 않는다.

## 검증

스킬 폴더에서 `npm run test:journal`은 순수 엔진, 실제 파일 저장·복구,
패키징된 CLI, 세 가상 서비스의 연속 변경을 검사한다.
저장소 루트에서 아래 명령으로 새로운 가상 검토 패킷을 생성할 수 있다.

```text
node evaluation/lifecycle/managed.mjs --write outputs/managed-lifecycle-new
```

기존 비관리 재현과 새 이력 관리 재현을 구분한다. 비관리 경로는 이전처럼
폐기 ID를 받아들이는 한계를 재현하고, 새 경로는 같은 재도입을 거절한다.
각각의 테스트 통과 의미가 다르며 서비스 승인으로 합산하지 않는다.

별도의 논리 조합·중첩 구조·프로세스 복구 검사는 저장소 루트에서 실행한다.
보고서 파일은 새 경로여야 하며 `outputs` 폴더는 미리 존재해야 한다.

```text
node evaluation/lifecycle/logic-matrix.mjs --write outputs/lifecycle-logic-audit-new.json
node evaluation/lifecycle/holdout.mjs --write outputs/lifecycle-holdout-new.json
node evaluation/lifecycle/resilience.mjs --write outputs/lifecycle-resilience-new.json
```

입력 타입, 파일 이동, 부모 누락의 빠른 회귀 검사는 `test:journal`과 기본
`check`에도 포함된다. 세 독립 감사의 상세 범위는 [평가 안내](../evaluation/lifecycle/README.md)를 참고한다.

이 기능을 실제 서비스에 등록하거나 배포하기 전에는 저장 위치·백업 및
실제 호스트 사용성을 확인한다. 이번 구현이 기존 작업공간을 자동 전환하지는 않는다.
