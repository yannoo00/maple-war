---
name: add-unit
description: "메이플 워 유닛(몬스터 / 설치물 / 스킬) 추가·수정·삭제. UnitTable·StageWaveTable·StageTable을 직접 고치지 말고 tools/unit-editor CLI로 검증·저장한다. Triggers: 유닛 추가, 몬스터 추가, 설치물 추가, 스킬 추가, 유닛 수정, 유닛 삭제, 적으로 넣어줘, 스테이지에 등장, add unit, new monster, new skill, unit table."
---

# add-unit — 유닛 데이터 입력 절차

`RootDesk/MyDesk/Data/UnitTable.csv` 한 행이 유닛 하나다. 별도 `.model`은 만들지 않는다(모든 유닛이 공용 `BattleUnit.model`을 쓰고 `BattleUnit:Setup(cfg)`로 표의 행을 받는다).
**CSV를 Read/Edit로 직접 고치지 말 것.** 열 규칙·enum·필수 항목·적/아군 파생 규칙이 전부 `tools/unit-editor/schema.cjs`에 있고, CLI가 그 규칙으로 검증한 뒤 BOM·CRLF를 유지한 채 저장한다.

## 명령

```
node tools/unit-editor/cli.cjs list [monster|build|skill]   # 목록 + 아군/적 파생 상태
node tools/unit-editor/cli.cjs show <unitId>                 # 한 유닛 JSON
node tools/unit-editor/cli.cjs schema <kind>                 # 그 종류의 칸 정의(라벨·enum·필수·도움말)
node tools/unit-editor/cli.cjs template <kind>               # 채울 JSON 틀
node tools/unit-editor/cli.cjs validate <file.json>          # 저장 없이 검사 (--add / --update 로 모드 지정)
node tools/unit-editor/cli.cjs add <file.json>               # 새 유닛 (UnitId가 있으면 실패)
node tools/unit-editor/cli.cjs update <file.json>            # 기존 유닛 수정 (없으면 실패)
node tools/unit-editor/cli.cjs upsert <file.json>            # 추가 또는 수정
node tools/unit-editor/cli.cjs remove <unitId> [--force]     # 삭제 (--force: 시간표·반복 풀에서도 제거)
```

종료 코드 0 = 성공, 1 = 검증 실패. 결과는 JSON으로 stdout에 나온다(`errors`, `warnings`, `status`, `changed`).

## JSON 형식

키 = UnitTable 열 이름. 추가 키 두 개:

- `"waves": [{ "stage": "stage3", "time": 12, "level": 2 }]` — 이 유닛의 StageWaveTable 행을 **통째로 교체**. `[]`면 전부 제거. 키를 생략하면 건드리지 않음.
- `"loopPool": ["stage3"]` — 이 유닛이 들어갈 StageTable.LoopPool 목록을 **통째로 교체**. 생략하면 건드리지 않음.

## 절차

1. **종류 결정**: 몬스터(전진·교전) / 설치물(제자리, `Speed=0`) / 스킬(범위 피해 한 번). 사용자가 말한 역할에서 정한다.
2. **틀 받기**: `template <kind>`로 JSON 틀, 모르는 칸은 `schema <kind>`의 `help`를 본다. 비슷한 기존 유닛을 `show`로 열어 수치 감을 잡는다(근접 노멀 코스트 40~60 / HP 35~75 / 공격 9~15, 원거리 Range 3~3.5, 탱커 HP 220~340).
3. **RUID 찾기**: 클립 4종(`StandRuid` `MoveRuid` `AttackRuid` `DieRuid`)은 필수. `msw-search` 스킬로 몬스터 리소스 팩을 찾아 `stand` / `move` / `attack1` / `die1`을 넣고, 있으면 `hit1`→`HitRuid`, `attack1/info/ball`→`ProjectileRuid`, `attack1/info/effect`→`AttackEffectRuid`, `audio/Attack1·Damage·Die`→`*SoundRuid`. 사용자가 팩 목록 JSON(`action`→`ruid`)을 주면 그대로 옮긴다. **RUID를 지어내지 말 것.**
4. **적/아군은 입력 칸이 아니다.** 아군 = `Starter=1` 또는 `Price>0`. 적 = `waves` / `loopPool`에 들어감. 둘 다 아니면 어디에도 안 나오므로 CLI가 경고한다. 사용자가 "적으로"라고 하면 스테이지와 등장 시각을 정해 `waves`에 넣는다(기존 시간표는 `show`의 `_status.waves` 참고, 보통 4~6초 간격).
5. **화면 보고 맞추는 값**(`AttackPlayRate` `AttackPose` `AttackHitDelay` `BarY` `ProjectileScale`)은 비슷한 유닛 값을 복사해 넣고, 사용자에게 플레이 후 확인을 부탁한다.
6. JSON을 스크래치패드에 쓰고 `validate` → 오류 없으면 `add`(또는 `update`).
7. Maker MCP `maker_refresh_workspace`로 반영(플레이 중이면 먼저 `maker_stop`). 플레이로 확인할 때는 소환 로그 `[BattleUnit] setup <id> ...`를 본다.
8. 보고: 추가된 행 요약, 파생 상태(스타터/구매/적 스테이지), `warnings`, 사용자가 화면으로 확인할 항목.

## 스테이지(StageTable + StageWaveTable) 편집

적이 언제 나오는지는 **스테이지 단위**로 정한다. 유닛 JSON의 `waves` / `loopPool` 키는 한 유닛을 빠르게 끼워 넣는 지름길이고, 시간표 전체를 짜거나 고칠 때는 stage 명령을 쓴다.

```
node tools/unit-editor/cli.cjs stage list                   # 스테이지 + 시간표 수 + 마지막 시각 + 풀 + 맵 존재 여부
node tools/unit-editor/cli.cjs stage show <id>              # 속성 + _status.waves(시간순) + _status.pool
node tools/unit-editor/cli.cjs stage template
node tools/unit-editor/cli.cjs stage validate|add|update|upsert <file.json>
node tools/unit-editor/cli.cjs stage remove <id> [--force]  # --force: 이 스테이지를 선행으로 쓰는 칸도 비움
```

스테이지 JSON = StageTable 열 + `"waves": [{ "time": 4, "unitId": "slime", "level": 1 }, …]`(시간표 전체 교체) + `"loopPool": ["slime", "slime", "spirit"]`(반복 풀 전체 교체, 반복 = 가중치). 두 키를 빼면 파일의 것을 유지한다.

규칙(StageAI 동작): 시간표는 시간순으로 한 번씩 소환되고, 마지막 행 뒤에는 반복 풀에서 `LoopStartInterval`초 간격으로 뽑되 소환마다 0.3초씩 줄어 `LoopMinInterval`까지 내려간다. `MapName`은 `map/` 폴더에 있어야 하고(`.map` 이름), `UnlockStage`는 존재하는 다른 스테이지여야 한다. 시간표의 유닛은 보통 몬스터. 스킬은 x=0에 떨어지므로 피한다.

스테이지를 짤 때 감: 기존 스테이지는 4~6초 간격 10~13행, 마지막 행 54~66초, 레벨은 스테이지 번호에 따라 1→3. `stage show stage3`처럼 비슷한 것을 복제해서 조정한다.

## 효과(EffectTable) 추가·구현

효과 한 줄 = `EffectTable.csv` 한 행. 그 행의 `Duration` / `Power` / `Chance*`는 **기본값**이고, 몬스터·설치물이 `UnitTable`의 `EffectDuration` / `EffectPower` / `EffectChance*` 칸으로 덮어쓴다(빈칸 = 기본값). 유닛에 효과를 줄 때는 유닛 JSON에 `Effect`와 필요한 덮어쓰기 칸만 넣는다. `Type`이 코드가 분기하는 키이고, 구현된 타입은 `BattleUnit:ReceiveEffect`의 `effect.type == "..."` 분기에서 자동으로 읽는다.

```
node tools/unit-editor/cli.cjs effect types                 # 코드가 구현한 타입 목록
node tools/unit-editor/cli.cjs effect list                  # 효과 + 구현 여부 + 쓰는 유닛
node tools/unit-editor/cli.cjs effect template              # 채울 JSON
node tools/unit-editor/cli.cjs effect validate|add|update|upsert <file.json>
node tools/unit-editor/cli.cjs effect remove <id> [--force] # --force: 쓰는 유닛의 Effect 칸도 비움
```

**사용자가 편집기에서 미구현 타입의 효과를 저장한 뒤 "구현해줘"라고 요청하는 흐름**이 기본이다. 그때 절차:

1. `effect show <id>`로 행을 읽는다. `#Memo`가 구현 스펙이다(누구에게, 얼마 동안, 무엇이 일어나는지). 모호하면 사용자에게 한 번만 묻는다.
2. `RootDesk/MyDesk/Battle/BattleUnit.mlua`의 `ReceiveEffect`에 `elseif effect.type == "<type>" then` 분기를 추가한다. 상태가 필요하면 `property`를 선언하고(`_T` 외 미선언 필드 금지), `OnUpdate`에서 시간을 줄이고, `Setup`에서 초기화한다. 기존 4종(nullify / curse / warp / blow)의 구조를 따른다. `log()`로 걸림·해제를 남긴다.
3. 연출(클라이언트)이 필요하면 `BattleFx` 쪽에 두고 서버 로직과 섞지 않는다.
4. `effect types`로 새 타입이 잡히는지 확인 → Maker refresh → 플레이 로그로 `[BattleUnit] effect <id> (<type>) ...` 확인. 서버에서 직접 거는 테스트는 `maker_execute_script`로 `ReceiveEffect`를 호출하면 된다.
5. GDD(`Docs/MapleWar-M3-GDD.md`) §4 효과 동작 목록에 한 줄 추가한다.

**RUID 확인**: `node tools/unit-editor/cli.cjs resource <ruid>`로 타입·이름·썸네일 URL을 받을 수 있다. 사용자에게 RUID가 맞는지 보여 줄 때 쓴다.

## 데이터 구조가 바뀌었을 때 (툴 유지보수)

유닛·스테이지·효과 표의 열이 바뀌면 **`tools/unit-editor/schema.cjs`만** 고친다. 화면과 CLI는 그 정의를 읽어 그린다.

| 바뀐 것 | 고칠 곳 |
|---|---|
| 열 추가 (예: `GachaWeight`) | `FIELDS` / `STAGE_FIELDS` / `EFFECT_FIELDS`에 한 줄 (`key`, `type`, `label`, `kinds`, `required`, `help`). 안 넣어도 "기타 열"로 보이고 저장되지만 검증·설명이 없다 |
| 열 삭제 (예: `Price` 없어짐) | 스키마의 그 줄을 지운다. 지우지 않아도 CSV에 없는 열은 화면·검증에서 자동으로 빠진다 |
| enum 값 변경 (등급·속성·공격 타입) | `ENUMS` / `ENUM_LABELS` |
| "아군/적" 같은 파생 규칙이 바뀜 (예: 구매 → 뽑기) | `unitdata.cjs`의 `unitStatus` (게임 코드의 규칙을 그대로 옮긴다) |
| 새 표가 생김 (예: `GachaTable`) | `schema.cjs`에 필드 목록 + `unitdata.cjs`에 list/validate/save/remove + `cli.cjs`/`server.cjs`에 명령·엔드포인트 + `web/src/modes.js`에 모드 설정 + `web/src/forms/`에 폼 하나 + `Sidebar.jsx` 행. 효과 모드가 가장 단순한 본보기 |

바꾼 뒤에는 복사본으로 라운드트립을 확인한다: CSV를 임시 폴더에 복사하고 `UNIT_EDITOR_DATA_DIR`로 지정한 뒤 기존 행을 `show` → `upsert` 했을 때 파일이 바이트 단위로 같아야 한다.

## 하지 말 것

- `#Memo`에 "적"/"아군"을 적어 구분한 척하기 — 코드는 메모를 읽지 않는다.
- `base` 행 수정.
- `UnitLevelTable` / `CostLevelTable` 손대기 — 유닛별이 아니라 공용 표다.
- 브라우저 편집기(`node tools/unit-editor/server.cjs`)를 Claude가 켜서 쓰기 — 그건 사람용 입구다. Claude는 CLI를 쓴다.
