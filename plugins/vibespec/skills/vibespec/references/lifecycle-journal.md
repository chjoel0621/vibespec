# Lifecycle journal candidate

선택적으로 사용하는 변경 이력 CLI다. SOT 1.0/1.1과 기존 뷰어는 바꾸지
않고, 정규 작업공간의 `history/lifecycle`에 스냅샷과 검토 잔여 항목을 남긴다.
사용자가 이력 관리를 요청했거나 이미 등록된 작업공간을 변경할 때 사용한다.
기존 산출물을 자동 이동·일괄 등록하지 않는다.

## 대상과 호출

대상 폴더에는 `main.sot.json`과 선택적인 `initiatives/**/*.sot.json`이 있다.
`<SKILL>`은 현재 로드한 스킬 폴더, `<PRODUCT>`는 사용자가 지정한 제품
작업공간이다. 다음 명령은 모두 `<SKILL>/scripts/lifecycle.mjs`를 사용한다.

```text
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" status --json
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" init --reason "기준선 이력 관리 시작"
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" init --reason "기준선 이력 관리 시작" --apply
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" apply --scope root --plan "<PLAN>" --reason "변경 이유"
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" apply --scope root --plan "<PLAN>" --reason "변경 이유" --apply
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" rebase --reason "부모 참조 갱신" --apply
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" merge --initiative batch --reason "추가 기획 병합" --apply
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" status --id root/F3 --json
```

모든 쓰기는 기본 dry-run이다. 사용자가 요청한 쓰기 범위에서 dry-run의
변경·영향을 확인한 뒤 같은 명령에 `--apply`를 붙인다. `scope`는 `root` 또는
추가 기획의 안정 ID다. apply는 기존 change-plan-v2를 사용한다. rebase는
전체 stale 체인을 위에서 아래로 갱신하므로 범위를 먼저 확인한다.

이미 등록된 작업공간의 지원되는 수정·rebase·merge에는 이 명령을 사용한다.
기존 직접 CLI나 뷰어 저장은 이력 보호를 우회한다. 저널이 거절했다고 직접
JSON 쓰기로 우회하지 않는다. 지원하지 않는 부분 재기준이나 새 파일 생성은
별도 외부 편집·capture 절차가 필요하며 자동으로 보호되는 작업이라고 부르지 않는다.

## 상태의 의미

| 상태 | 의미와 다음 작업 |
| --- | --- |
| not-enrolled | 캡처한 이력이 없음. 등록 요청이 있을 때만 init |
| current | 현재 파일이 마지막 기록과 일치. 기획 검토·승인 완료가 아님 |
| pending-write | 기록된 쓰기를 완료하지 못함. 현재 내용을 확인하고 recover |
| external-drift | 완료 기록 이후 외부 수정 또는 인식하지 못하는 내용. recover로 덮지 않음 |

`pendingReviews`는 내용 검토, 부모 변경 영향, 병합 후 PRD/semantic 검토
잔여 항목이다. `stale`은 대상 또는 부모 기준 digest가 달라졌다는 뜻이다.
rebase·자동 검사·쓰기 완료 영수증으로 이 항목을 닫지 않는다. 본 후보에는
사람 검토 증빙을 등록하거나 승인하는 명령이 없다. 기획 승인·실제 구현·
운영 활성은 항상 별도 확인 사항이다.

## 외부 편집, 복구, 폐기

```text
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" capture --reason "외부 편집 내용을 확인하고 기록" --apply
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" recover
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" recover --apply
node "<SKILL>/scripts/lifecycle.mjs" "<PRODUCT>" unlock --apply
```

capture는 현재 파일을 변경하지 않고 명시적으로 이력에 기록한다. 미완료
쓰기를 숨기거나 과거 폐기 ID를 재사용하는 capture는 거절된다. recover는
저장된 전후 스냅샷 중 하나로 식별되는 파일만 기록된 after로 완성한다.
이미 완료된 변경을 외부에서 되돌린 경우는 복구가 아니라 외부 변경이다.

unlock은 같은 컴퓨터에서 기록된 소유 프로세스가 종료됐음을 확인할 수
있을 때만 잠금을 해제한다. 실행 중·다른 호스트·손상된 잠금을 추측해서
삭제하거나 프로세스를 종료하지 않는다. 손상·누락된 이력은 백업 조사
대상이며, 새 이력으로 덮어쓰거나 init으로 해결하지 않는다.

폐기 이유는 변경의 reason으로 남는다. 확인된 대체 관계가 있으면 apply나
capture에 `--replacements <JSON>`을 추가할 수 있다. 예:
`{"root/F3":"root/F1"}`. 출발 ID는 그 변경에서 삭제되고 도착 ID는 변경 후
존재해야 한다. 대체 관계를 자동 추정하지 않는다. 동일 로컬 ID라도 scope가
다르면 별개다. 폐기한 상세기능 F#:index도 재발급하지 않는다.

## 안전·해석 경계

- 등록 이전 이력이나 통째로 유실된 저널은 복원할 수 없다. 제품 폴더 전체를
  백업하고 함께 보존한다. 살아 있는 완료 영수증과 누락 이력의 불일치는 거절한다.
- digest는 동일성 검사이지 작성자 서명·정책의 진실성·배포 증명이 아니다.
- 부모 연결에 따른 재검토 대상은 보수적으로 잡는다. 자연어 정책 의존성을
  완전히 찾아냈다고 주장하지 않는다.
- 잠금은 이 CLI끼리의 동시 쓰기를 막는다. 별도 편집기의 동시 쓰기는 잠그지
  못하므로 적용 중 외부 편집기를 멈춘다. 파일 비교와 교체 사이의 경쟁까지
  제거하는 운영체제 수준 트랜잭션은 아니다.
- 로컬 파일시스템에서 파일별 교체와 프로세스 중단 복구를 지원한다. 전체
  다중 파일 원자성, 네트워크 공유 폴더, 전원 장애 내구성은 보증하지 않는다.
- JSON 스냅샷과 검토 보고서가 누적된다. 장기 보관 용량·압축·보존 기간
  정책은 별도 설계 대상이며 자동 삭제하지 않는다.

이력 관리 후 기존 validate/tree/semantic 검사와 HTML 재생성은 필요하다.
HTML에 저널을 자동 삽입하지 않는다. 최신 인수인계 상태는 status --json의
현재 기준·변경 이유·잔여 검토·폐기 이력에서 확인한다.
