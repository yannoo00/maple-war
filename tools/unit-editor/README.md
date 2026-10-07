# unit-editor — 유닛 데이터 입력 툴

`RootDesk/MyDesk/Data/UnitTable.csv`(+ `StageWaveTable.csv`, `StageTable.csv`의 LoopPool)에 몬스터 / 설치물 / 스킬을 넣고 고치는 툴. Node만 있으면 되고 설치할 패키지는 없다.

사람과 Claude가 **같은 검증·저장 코드**를 쓴다.

| 입구 | 누가 | 실행 |
|---|---|---|
| 브라우저 편집기 | 사람 | `node tools/unit-editor/server.cjs` → http://localhost:3456 이 열린다 |
| CLI | Claude (또는 스크립트) | `node tools/unit-editor/cli.cjs <명령>` — 명령 목록은 인자 없이 실행 |
| Claude 스킬 | Claude | `.claude/skills/add-unit/SKILL.md` — "유닛 추가해줘"라고 하면 이 절차로 CLI를 쓴다 |

## 파일

- `schema.cjs` — 열 정의, 종류별 필수/허용 칸, enum, 기본값, 도움말. **규칙을 바꾸려면 여기만 고친다.**
- `unitdata.cjs` — CSV 읽기/쓰기(UTF-8 BOM + CRLF 유지), 검증, 추가/수정/삭제, 시간표·반복 풀 반영, 아군/적 파생 상태.
- `cli.cjs`, `server.cjs`, `index.html` — 두 입구.

## 스테이지 편집

상단 "스테이지" 모드에서 `StageTable.csv`(스테이지 속성 + 반복 풀)와 `StageWaveTable.csv`(시간표)를 **스테이지 단위**로 편집한다.

- 시간표: "몇 초에 어떤 유닛을 몇 레벨로" 행 목록. 위에 타임라인이 그려지고 저장 시 시간순으로 정렬된다.
- 반복 풀: 시간표가 끝난 뒤 무작위로 계속 뽑는 유닛 목록. 같은 유닛을 여러 번 넣으면 가중치.
- 유닛 모드의 "스테이지 등장" 칸은 읽기 전용이고 "스테이지 열기" 버튼으로 넘어간다. 유닛 저장은 스테이지 파일을 건드리지 않는다.
- CSV에 스키마가 모르는 열이 있으면(다른 세션이 코드로 추가한 열) "기타 열"로 보여 주고 그대로 저장한다.

## 효과 편집

상단 "효과" 모드에서 `EffectTable.csv`를 편집한다. `Type`이 코드의 분기 키라서, 코드(`BattleUnit:ReceiveEffect`)에 없는 타입을 적으면 **미구현 · 설명만 저장**으로 표시된다. 그 상태로 저장해 두고, 화면에 뜨는 요청 글을 복사해 Claude 세션에 붙이면 Claude가 메모의 설명대로 구현한다(절차는 `.claude/skills/add-unit/SKILL.md`). 구현된 타입 목록은 코드에서 자동으로 읽으므로 구현이 끝나면 배지가 "구현됨"으로 바뀐다.

## RUID 미리보기

RUID 칸에 32자리 값을 넣으면 공개 리소스 API(`maplestoryworlds-resourcesearch-new.nexon.com`)에서 타입·이름·썸네일(GIF/PNG)을 가져와 칸 아래에 보여 준다. 목록의 작은 그림은 stand 클립(스킬은 범위 이펙트)이다. 인터넷이 없으면 미리보기만 비고 저장은 된다.

## 규칙 요약

- 유닛 하나 = UnitTable 한 행. `.model`은 만들지 않는다(공용 `BattleUnit.model`).
- 적/아군을 정하는 열은 없다. 아군 = `Starter=1` 또는 `Price>0`, 적 = 시간표(StageWaveTable) 또는 반복 풀(StageTable.LoopPool)에 있음. 툴은 이걸 계산해 배지로 보여 주고, 둘 다 아니면 "미등장" 경고를 낸다.
- 종류에 맞지 않는 칸(예: 스킬의 MaxHp)은 비어 있어야 저장된다.
- 설치물은 `Speed=0` 고정, `MoveRuid`가 비면 `StandRuid`로 채운다.
- `base` 행과 알 수 없는 열은 그대로 보존한다.

## 저장 후

Maker에서 **refresh**(플레이 중이면 stop 먼저). Maker의 데이터셋 편집기를 열어 둔 채 이 툴로 저장하면 서로 덮어쓸 수 있으니 닫고 쓴다. 되돌리기는 git(`git diff RootDesk/MyDesk/Data/`).

## 테스트

실제 표를 건드리지 않고 돌려 보려면 CSV를 복사한 폴더를 `UNIT_EDITOR_DATA_DIR`로 지정한다.

```
UNIT_EDITOR_DATA_DIR=/tmp/data-copy node tools/unit-editor/cli.cjs list
```
