# 회의실 예약: 구조적으로 완성됐지만 측정할 수 없는 노쇼율

이 사례는 [회의실 예약 데모](../../../../demo/meeting-room-booking.ko.sot.json)를
원본으로 사용한다. 원본을 복제하거나 조용히 고치지 않고, digest로 고정한 뒤
두 개의 `change-plan-v2`를 순서대로 적용한다.

## Before

제품 기획에는 월간 노쇼율 KPI가 있고, 노쇼를 “예약 시작 시각에 체크인이
없는 상태”로 정의한다. 하지만 체크인 기능·화면·이벤트 생산자가 없고,
QR/NFC 방식도 미결정이다.

구조 검증은 통과하지만 Semantic Assurance는 다음을 차단한다.

| Finding | 의미 |
| --- | --- |
| `measurement-event-producer-required` · `E2` | 체크인 완료 이벤트를 실제로 만드는 기능이 없다. |
| `open-decision-blocks-measurement` · `D1,E2,K2` | QR/NFC 결정이 열려 있어 노쇼율 측정 정의를 확정할 수 없다. |

결과: `assessment=failed`, `measurement=blocked`.

## Decision and resolution

- MVP 체크인 방식은 QR로 결정한다.
- 예약 관리 requirement에 `F9 QR 체크인`을 추가한다.
- 내 예약 아래 `P18 QR 체크인` 화면과 `P10→P18` flow trigger를 추가한다.
- `E2` producer를 `F9`, interaction surface를 `P18`로 연결한다.
- `D1`을 `decided`로 바꾸고 결정문을 보존한다.

이 변경은 [Resolved plan](resolved.plan.json)에 명시되어 있으며 기존 `R/F/S/P`
ID를 재발급하거나 관계없는 내용을 재생성하지 않는다.

결과: `assessment=passed`, `measurement=ready`, finding 0건.

## Reproduce

```bash
node evaluation/semantic-assurance/evaluate.mjs --case meeting-room-no-show --json
```

이 사례의 목적은 QR이 유일한 정답이라고 주장하는 것이 아니다. KPI를 사용하려면
측정 이벤트를 생산하는 구현 근거와 선행 결정이 필요하다는 것을 검증한다.
