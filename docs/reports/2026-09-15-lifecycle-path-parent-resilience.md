# 파일 이동·부모 누락 수정 및 3차 검증

## 결과

요청한 두 결함을 수정한 뒤 이전 검사와 다른 사례를 추가 실행했다.
**92개 + 18개 + 신규 12개 = 122개 시나리오가 모두 통과**했고, 전체
`npm run check:all`도 빌드·패키징·브라우저 검사까지 종료 코드 0이었다.

이는 명시한 테스트 범위의 통과이며 모든 코드 분기, 실제 정책의 타당성, 운영 장애의
완전한 검증을 뜻하지 않는다. 실제 설치 호스트 증거가 현재 런타임과 불일치하므로
릴리스 게이트는 여전히 실패한다. 배포 완료로 표시하지 않았다.

## 수정 내역

### 파일 이동을 내용 변경과 구분

[lifecycle-journal.mjs](../../plugins/vibespec/skills/vibespec/scripts/lib/lifecycle-journal.mjs)의
변경 요약이 경로 변경도 남기도록 했다. 이동 항목에는 `previousFile`과 `file`이
들어가므로 이전·새 경로를 확인할 수 있다.

파일 내용·scope ID가 같으면 기존 내용 증거의 freshness, 폐기 ID, 내용 검토와
부모 정책 검토를 불필요하게 바꾸지 않는다. 이동과 내용 수정이 함께 있으면 두 가지
변경을 모두 기록하고 실제 내용·부모 영향 검토를 생성한다. 이전 기록에 새 필드를
강제로 넣거나 불변 기록을 다시 쓰지는 않는다.

### 누락된 부모를 명시적으로 거절

부모 영향 탐색 중 해당 scope의 문서가 없으면 내부 TypeError 대신 다음 의미의
오류를 발생시킨다: `missing parent scope <parent> for <child>; restore or repair parent references before recording`.

기록 게시 전에 거절하므로 원본과 기존 이력 파일은 보존된다. 부모 복원 또는 의도적인
부모·path·boundary 참조 수정을 마친 후 다시 capture할 수 있다. 잘못된 트리를
정상인 것처럼 기록하거나 부모 내용을 추정하지 않는다.

## 실패부터 통과까지의 증거

1. 수정 전 18개 감사: 기존과 같은 **16 통과 / 2 실패**, 종료 코드 1.
2. [기본 저널 회귀 테스트](../../plugins/vibespec/skills/vibespec/tests/lifecycle-journal.test.mjs)에
   경로 전환·내용 검토 분리·부모 진단 검사를 추가했다. 첫 실행은 이동 요약 누락으로 실패했다.
3. 경로 처리만 수정한 실행은 이동 검사를 통과하고 부모 TypeError 검사에서 실패했다.
4. 부모 처리를 수정한 후 `npm run test:journal`이 통과했다.
5. 기대값을 바꾸지 않은 기존 92개와 추가 18개 감사를 재실행해 모두 통과했다.
6. 이후 별도의 프로세스·복구 사례 12개를 새로 설계·실행했고 모두 통과했다.
7. 별도 리뷰에서도 수정 코드와 12개 테스트 도구의 중요한 문제는 발견되지 않았다.

테스트 우선 개발·디버깅 절차를 따라 두 원인을 각각 재현하고 최소 수정했다.
완료 전 검증 절차에 따라 실행 결과를 확인했으며 기존 실패 기대값을 완화하지 않았다.

## 새로 추가한 12개 사례

| 사례 | 기대 동작 | 결과 |
| --- | --- | --- |
| 작업공간 전체 이동 | 문서·저널을 함께 옮겨도 상태와 이력 바이트 유지 | 통과 |
| 두 기획 파일의 경로 맞교환 | 두 이동을 모두 기록, ID 및 내용 검토 유지 | 통과 |
| 파일 이동과 내용 수정 동시 수행 | 경로 이력과 실제 내용·하위 영향 검토 모두 생성 | 통과 |
| 부모 삭제 거절 후 원본 복원 | 새 이력 없이 정상 현재 상태로 돌아옴 | 통과 |
| 부모 삭제 후 하위 기획 재연결 | 명시적 참조 수정 후 capture 허용, 삭제 scope만 폐기 | 통과 |
| intent 게시 후 쓰기 0개에서 프로세스 종료 | 죽은 잠금의 명시적 해제 후 복구 | 통과 |
| intent 게시 후 쓰기 1개에서 프로세스 종료 | 부분 기록 상태에서 같은 복구 규칙 적용 | 통과 |
| intent 게시 후 쓰기 2개에서 프로세스 종료 | 소스가 모두 변경됐어도 영수증 완료를 확인 | 통과 |
| 실제 별도 프로세스의 동시 쓰기 | 기존 소유자가 잠근 동안 두 번째 쓰기 거절 | 통과 |
| 잠금 소유자 JSON 손상 | 추측해서 잠금을 해제하거나 덮어쓰지 않음 | 통과 |
| 소스 폴더의 junction 우회 | 소스 및 대상 폴더를 변경하지 않고 거절 | 통과 |
| 원본 SOT의 JSON 손상 | 상태·capture 거절, 기존 파일 바이트 유지 | 통과 |

중단 테스트는 별도 Node 프로세스가 실제 잠금을 보유하고 intent를 게시한 뒤,
정해진 수의 테스트 소스 파일을 쓰고 종료 코드 23으로 끝나게 한다. 잠금은 남지만
소유 프로세스는 종료된 상태에서 unlock/recover를 검사한다. 이는 제어된 중단 지점
검증이지 저장 엔진의 모든 내부 쓰기 지점에 대한 fault injection, 전원 장애, 디스크
내구성 보증이 아니다. 잠금과 파일 I/O는 mock으로 대체하지 않았다.

## 자료와 재실행

- [두 결함 수정 전 18개 결과](../../outputs/lifecycle-holdout-before-path-parent-fix-2026-09-15.json)
- [수정 후 18/18 결과](../../outputs/lifecycle-holdout-after-path-parent-fix-2026-09-15.json)
- [수정 후 92/92 결과](../../outputs/lifecycle-logic-after-path-parent-fix-2026-09-15.json)
- [신규 12개 테스트 코드](../../evaluation/lifecycle/resilience.mjs)
- [신규 12/12 결과](../../outputs/lifecycle-resilience-2026-09-15.json)
- [12개 반복 실행 결과](../../outputs/lifecycle-resilience-2026-09-15-recheck.json)

세 감사는 저장소 루트에서 실행하며, 출력 부모 폴더는 존재하고 보고서 파일은 새
경로여야 한다. 전체 자동 회귀는 플러그인 스킬 폴더에서 실행한다.

```text
node evaluation/lifecycle/logic-matrix.mjs --write outputs/logic-next.json
node evaluation/lifecycle/holdout.mjs --write outputs/holdout-next.json
node evaluation/lifecycle/resilience.mjs --write outputs/resilience-next.json
```

동일한 검사를 반복하거나 리뷰어가 다시 실행한 것은 사례 수에 중복 합산하지 않았다.
빠른 수정 회귀는 기본 `check`에 포함되고, 세 독립 감사는 별도의 릴리스 체크리스트에
명시했다. 이번 문서·검증 범위에 맞춰 변경 이력, 사용 안내, 개발·배포 안내도 갱신했다.

## 남은 배포 경계

`npm run check:host-acceptance`는 여전히 현재 후보 런타임과 기존
`claude-code.json`의 `pluginDigest` 불일치로 종료 코드 1이다. 과거 설치 증거를
현재 코드의 증거로 재사용하지 않았다. 최종 버전·런타임을 확정한 뒤 실제 Claude와
Codex의 새 full-mode 설치 검증 및 로컬·원격 릴리스 게이트가 필요하다.

이번에는 원본 서비스 수정, 설치 캐시 교체, 버전 bump, 커밋, push, 태그, 배포를
수행하지 않았다. 기획의 사업적 타당성·사람 검토 상태도 자동 승인으로 바꾸지 않았다.
