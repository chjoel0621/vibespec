# VibeSpec

**[English](README.md) · 한국어**

> Claude 또는 Codex로 제품 아이디어를 구현 준비가 끝난 기획 단일 기준 정보로 전환합니다.

## 생성 결과

아이디어를 설명하거나 사업계획서, PRD 초안, 회의록을 첨부하세요. VibeSpec은 다음을 생성합니다.

- PRD, 기능 명세, 정보 구조, 사용자 흐름, KPI 측정 근거를 연결한 스키마 준수 `*.sot.json`
- 같은 SOT에서 생성되어 기획을 검토하고 편집할 수 있는 자기완결 HTML 뷰어
- 해결되지 않은 결정을 드러내는 구조, 내용, 측정 점검 결과

JSON이 기획의 기준 원본이며, HTML은 JSON을 읽는 뷰어이자 편집기입니다.

## 호스트 지원

VibeSpec은 Claude Cowork, Claude Code, OpenAI Codex용 플러그인으로 실행됩니다.

전체 모드에는 Node.js 18 이상, 설치된 VibeSpec 스킬 디렉터리 읽기 권한, 작업 폴더 쓰기 권한이 필요합니다. 검증된 JSON과 자기완결 HTML 뷰어를 생성하며 안전 수정, 재기준, 지도, 병합을 지원합니다. Claude Code와 파일시스템을 사용할 수 있는 Codex 작업은 보통 이 조건을 충족합니다.

Node.js나 셸에 접근할 수 없는 Cowork 작업은 사용자가 제약을 수락한 뒤 축소 모드를 사용할 수 있습니다. VibeSpec은 SOT JSON을 제공합니다. 호스트가 설치된 `assets/viewer.html`을 읽어 복사할 수 있을 때만 사용자가 JSON을 불러올 수정하지 않은 뷰어도 함께 제공합니다. `assets/viewer.html`에 접근할 수 없으면 JSON만 제공할 수 있습니다. 축소 모드에서는 검증된 SOT 내장 HTML을 보장하거나 결정적 트리 수정을 적용할 수 없습니다.

아래 `/plugin` 슬래시 명령은 Claude Code 터미널 전용입니다. Cowork나 Codex에서는 동작하지 않습니다.

## 설치

### Cowork

데스크톱 UI에서 설치합니다.

1. 왼쪽 사이드바에서 **Customize**를 엽니다.
2. **Plugins** 탭을 엽니다. **Personal plugins**에서 **`+`**를 선택한 다음 **Add marketplace**를 선택합니다.
3. GitHub 저장소를 선택하고 `https://github.com/chjoel0621/vibespec.git`을 입력합니다.
4. 추가된 마켓플레이스에서 `vibespec`의 **Install**을 선택합니다.
5. 업데이트도 같은 Plugins 화면에서 진행합니다.

Cowork는 `/plugin`을 인식하지 않습니다. 위 UI 경로를 사용하세요.

### Claude Code

Claude Code 터미널 입력창에서 다음 명령을 순서대로 실행합니다.

```text
/plugin marketplace add https://github.com/chjoel0621/vibespec.git
/plugin install vibespec@vibespec
```

업데이트하려면 `/plugin marketplace update vibespec`을 실행한 다음 `/plugin` 관리자의 Installed 탭에서 VibeSpec을 업데이트합니다.

### OpenAI Codex

저장소를 복제하고 저장소 내부 마켓플레이스를 등록합니다.

```text
git clone https://github.com/chjoel0621/vibespec.git
codex plugin marketplace add "<absolute-path-to-the-cloned-vibespec-repo>"
```

따옴표로 감싼 자리표시자를 복제한 저장소의 절대 경로로 바꾸세요.

ChatGPT 데스크톱 앱에서 **Codex -> Plugins**를 열고 `vibespec` 마켓플레이스를 선택해 VibeSpec을 설치한 뒤 새 작업을 시작합니다. Codex CLI에서는 `codex`를 실행하고 `/plugins`를 열어 `vibespec` 마켓플레이스에서 VibeSpec을 설치한 뒤 새 세션을 시작합니다. 자연어로 요청하거나 `$vibespec`으로 직접 호출할 수 있습니다.

## 첫 요청

설치 후 쓰기 가능한 폴더에서 새 작업이나 세션을 열고 VibeSpec을 자연어 또는 명시적으로 호출합니다. Codex에서는 `$vibespec`, Claude Code에서는 `/vibespec:vibespec`을 사용하고, Cowork에서는 **VibeSpec**을 선택합니다.

전체 모드에서는 로드된 스킬이 설치된 자신의 경로를 확인하고 스크립트를 사용하기 전에 doctor/preflight를 실행합니다. 사용자가 `<VibeSpec-skill-dir>`를 알거나 추측할 필요가 없습니다. 그다음 다음과 같이 요청합니다.

> 간결한 회의실 예약 기획을 만들고 `outputs/meeting-room.sot.json`과 `outputs/meeting-room.html`을 모두 저장하세요.

두 파일을 요청하는 이 예시는 전체 모드용입니다. 축소 모드에서는 JSON만 제공될 수 있으며, 호스트가 설치된 `assets/viewer.html`을 읽어 복사할 수 있을 때만 수정하지 않은 뷰어를 함께 제공합니다.

새 작업에서 VibeSpec을 사용할 수 없다면 설치 후 작업을 다시 열거나 데스크톱 앱을 재시작하세요. 호스트 검증은 호스트나 로드된 스킬이 설치 경로를 알려준 뒤 수행하는 선택적 개발·수용 확인 단계입니다. 자세한 내용은 [시작하기](docs/getting-started.md)를 참고하세요.

## 라이브 데모

| 체험 | 데모 |
| --- | --- |
| 연결된 제품 기획 생성·편집 | [회의실 예약 기획](https://chjoel0621.github.io/vibespec/) |
| 차단된 KPI 측정 결정 해결 | [CRM KPI 측정 점검](https://chjoel0621.github.io/vibespec/crm/review/?view=semantic) |

추가 예제와 평가 사례는 [전체 라이브 데모](docs/live-demos.md)에서 확인하세요.

## 핵심 워크플로우

1. 제품 아이디어를 설명하거나 기존 기획 문서를 첨부합니다.
2. 생성된 SOT와 HTML 뷰어에서 열린 KPI 측정 결정을 포함한 기획을 검토합니다.
3. 뷰어에서 SOT를 편집하거나 Claude 또는 Codex에 범위가 제한된 검증 수정을 요청합니다.
4. 현재 `*.sot.json`을 기획 단일 기준 정보로 개발자나 코딩 에이전트에 전달합니다.

VibeSpec은 범위가 제한된 수정에서 기존 ID를 유지하고, 영향받은 기획이 점검을 통과한 뒤에만 측정 결정을 완료합니다. 생성, 편집, 추가 기획, 재기준, 검토, 병합 흐름은 [기획 워크플로우](docs/workflows.md)를 참고하세요.

## VibeSpec이 생성하지 않는 것

VibeSpec은 제품 구현 코드를 생성하거나 배포하지 않습니다. 개발자와 코딩 에이전트를 위한 기획 산출물을 만듭니다. 필수 KPI 결정이나 측정 근거가 해결되지 않은 기획을 승인 또는 개발 전달 준비 완료로 표시하지도 않습니다.

## 더 알아보기

- [문서 색인](docs/README.md)
- [시작하기](docs/getting-started.md)
- [기획 워크플로우](docs/workflows.md)
- [라이브 데모](docs/live-demos.md)
- [아키텍처와 데이터 경계](docs/architecture.md)
- [개발 및 테스트](docs/development.md)
- [기여 안내](CONTRIBUTING.md) · [보안](SECURITY.md)

## 라이선스

[MIT](LICENSE) © 2026 chjoel0621
