# 동일 브리프 4자 비교

이 실험은 결정적 엔진의 동작과 AI 생성 품질을 분리한다. CRM 운영 도메인과
소비자 습관 관리 도메인에서 다음 네 종류의 산출물을 비교한다.

1. 변경하지 않은 레거시 SOT (`not-assessed`)
2. 검토자 기준 Semantic Overlay 후보
3. 동결 브리프로 Claude 호스트가 새로 생성한 결과
4. 같은 동결 브리프로 Codex 호스트가 새로 생성한 결과

원래 요청문이 보존되지 않았기 때문에 동결 브리프는 평가를 위해 재구성한
입력이다. 출처를 명시하고 기존 KPI 문구, Semantic ID, 제안된 측정 답안은
제외한다. 이를 과거의 실제 원본 요청문이라고 설명해서는 안 된다.

## 순서와 승인 게이트

모델 결과가 사람 기준점에 영향을 주지 않도록 새 호스트 생성보다 먼저
기준 Overlay를 작성한다. 현재 상태는 `candidate-needs-human-approval`이다.
사람이 판정 기록을 승인하기 전에는 후보 KPI 수와 mode를 평가 스프린트
종료 기준에 포함하지 않는다. 호스트 실행이 후보를 자동으로 승인된 기준점으로
바꿔서는 안 된다.

승인 후에는 신규 생성 실험을 먼저 수행한다. 레거시 보완 실험은 기존 사실
보존과 최소 편집을 측정하므로 처음부터 만드는 생성 품질 실험과 별도로 진행한다.

## KPI별 평가

각 KPI를 독립적으로 평가한다.

| 항목 | 확인 질문 |
| --- | --- |
| 도메인 특수성 | 실제 제품 행동이나 업무 사건을 명시하는가? |
| mode 적합성 | 분모와 측정 책임에 맞는 mode를 선택했는가? |
| 근거 충실성 | 주장한 사실이 동결 브리프나 생성된 SOT에 존재하는가? |
| 근거 조작 | 존재하지 않는 이벤트, 기준값, 연동, 조사 결과를 만들었는가? |
| 모호성 처리 | 해결되지 않은 사실을 결정 사항으로 보존했는가? |
| 생산 근거 | 이벤트가 실제 기능, 시스템 작업, 의존성, 수동 절차를 가리키는가? |
| 상호작용 근거 | 사용자 이벤트에 IA 화면이나 플로우 트리거가 있는가? |
| 검토 부담 | 검토자가 수정해야 한 필드와 제품 결정은 몇 개인가? |
| 준비 상태 | 결정적 검토 후 `ready`, `at-risk`, `blocked` 중 무엇인가? |
| 내용 품질 | KPI가 템플릿형이거나 도메인과 맞지 않는가? |

`ready` 자체가 성공을 뜻하지 않는다. 성공한 결과는 근거를 만들지 않고,
현재 사실에 맞는 준비 상태를 내며, 승인된 판정과 의미적으로 일치해야 한다.
열린 결정을 정확히 보존했다면 `blocked`가 가장 좋은 결과일 수 있다.

준비 상태 값과 별도로 준비 상태 보정 수준을 분류한다.

- `correct`: 근거가 충분하면 `ready`, 실제 미해결 의존성이 있으면
  `blocked` 또는 `at-risk`
- `overconfident`: 불확실성을 숨기거나 근거를 만들어 `ready`로 판정
- `underconfident`: 충분한 근거가 있는데도 불필요하게 `blocked`로 판정

## 지표 분리

엔진 지표는 라벨이 확정된 결정적 오류에만 적용한다. TP, FP, FN, blocker
오탐, finding fingerprint 안정성을 기록한다.

생성 지표는 자연스러운 호스트 산출물에 적용한다. 적절한 mode 선택, 근거
조작 수, 결정을 통한 불확실성 보존, 준비 상태 보정, 도메인 특화 KPI 수,
검토자 수정량, 반복 실행 편차를 기록한다. 템플릿 재사용은 생성 품질 신호이며
자동으로 Semantic Assurance의 FN이 되지는 않는다.

호스트가 만든 KPI ID는 순서대로 직접 비교할 수 없다. 검토자는 각 KPI를
안정적인 제품 개념에 연결하고 `exact`, `partial`, `split`, `merged`,
`additional`, `missing` 중 하나로 정렬 상태를 기록한다. 초기 비교 개념은
다음과 같다.

- `crm-follow-up-timeliness`
- `crm-operational-visibility`
- `crm-auditability`
- `habit-first-week-value-action`
- `habit-weekly-return`
- `habit-data-control-completion`

## 반복 실행

목표는 도메인과 호스트 조합마다 독립적인 신규 생성을 세 번 수행하는 것이다.
한 번의 실행은 호스트 호환성을 증명할 수 있지만 모델 일관성의 근거가 되지는
않는다. 각 실행은 호스트, 플러그인 버전, 브리프 해시, 산출물 해시, 신규 생성
또는 레거시 보완 여부를 고정한다.

각 실행은
[`templates/four-way-host-run.template.json`](templates/four-way-host-run.template.json)
에서 시작하고
[`templates/generation-quality.template.json`](templates/generation-quality.template.json)
으로 평가한다. 템플릿 자체는 평가 사례가 아니며 결과를 주장하지 않는다.

호출문은
[`templates/four-way-invocation-prompt.txt`](templates/four-way-invocation-prompt.txt)에
동결한다. 호출문 해시와 함께 호스트 버전, 설치된 플러그인 커밋과 번들 해시,
시작·완료 시각, 재시도 횟수를 기록한다. 신규 생성 실험 중 호스트의 추가
질문에는 답하지 않고 브리프의 공백을 열린 결정으로 남긴다. 대화형 추가
질문은 별도 실험으로 다룬다.

새 작업공간에서 동결 브리프만 제품 입력으로 사용한다. 호스트가 VibeSpec을
정상적으로 사용해 최종 SOT와 HTML을 보존하도록 한다. 신규 생성 실험이 끝날
때까지 레거시 SOT, 검토자 Overlay, 다른 호스트 결과, 이전 실행 결과를
노출하지 않는다.

사람 승인은
[`templates/baseline-approval.template.json`](templates/baseline-approval.template.json)
을 사용하는 별도의 불변 영수증이다. adjudication 파일 안에 자기 해시를 넣어
자기참조 digest를 만들지 않고, 승인 영수증이 adjudication 해시를 외부에서
고정한다. 미해결 제품 선택을 정확히 보존한 기준점은
`approved-with-open-decisions`를 사용한다.
