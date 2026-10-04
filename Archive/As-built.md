# 메이플 워 (가칭) — As-built log

> Running record of the world's implementation. Survives across milestones. ⚠️confirm = survey guess to verify with the user.

## Current state (by system)
| System | Built | Where (key files) | Notes / gotchas |
|---|---|---|---|
| 정의 데이터 | 데이터셋 4개(CSV) + 읽기 창구 @Logic `BattleConfig` | `RootDesk/MyDesk/Data/{UnitTable,UnitLevelTable,StageTable,StageWaveTable}.csv`(+`.userdataset`), `Battle/BattleConfig.mlua` | 수치 수정은 CSV에서. `BattleConfig`는 표를 한 번 읽어 캐시: `GetUnit`, `GetUnitAtLevel(id, level)`(HP·공격력·스킬 피해에 레벨 배율), `GetLevels`, `GetStage`, `GetStageWaves`. 전역 조절값(UnitScale 0.65 / RangeScale 0.65 / SpeedScale 0.5, 코스트 시작 100·초당 20·상한 500)은 스크립트 속성으로 남아 있다. `GetDeck()`은 아직 고정 덱 5종. 수치는 테스트용 잠정값 |
| 전투 진행 | battle 맵 루트의 @Component `BattleDirector` | `Battle/BattleDirector.mlua` | 진영 중립 진행자. `@Sync` State(WAITING/PLAYING/ENDED)·WinnerTeam·AllyBaseX/EnemyBaseX. 플레이어가 맵에 도착하면 `StartBattle(userId, stageId)`. `UseCard(team, slot, x)`는 검증 후 실행, `PlayUnit(team, unitId, x)`는 검증 없이 실행(AI 경로). `Restart()` |
| 진영 | 기지 엔티티의 @Component `BattleSide` | `Battle/BattleSide.mlua`, `Models/Bases/BaseTower.model` | `@Sync` Team·ControllerUserId("" = AI)·DeckCsv·Cost·CostMax, 서버 전용 쿨타임과 FreePlay. `Reset` / `Tick` / `CheckCard` / `PayCard`. 기지 HP는 같은 엔티티의 `BattleUnit.Hp` |
| 스테이지 AI | battle 맵 루트의 @Component `StageAI` | `Battle/StageAI.mlua` | 스테이지 시간표를 읽어 팀 2의 카드를 `PlayUnit`으로 넣는다. 시간표가 끝나면 풀에서 무작위로 간격을 줄여 가며 소환 |
| 유닛(몬스터·설치물·기지) | @Component `BattleUnit` 하나 + 공용 모델 | `Battle/BattleUnit.mlua`, `Models/Units/BattleUnit.model`(id `battleunit`), `Models/Bases/BaseTower.model` | 차이는 데이터뿐(speed 0 = 고정, attack 0 = 공격 안 함). 타깃은 Director 목록에서 x 거리로 탐색, 피해는 `TakeDamage` 직접 적용(Attack/Hit 충돌 파이프라인 미사용). 클립은 서버가 `SpriteRUID` 교체(동기화). 원거리만 Multicast `NotifyAttack` |
| 플레이어(지휘관) | DefaultPlayer의 @Component `Commander` | `Commander/Commander.mlua`, `Global/DefaultPlayer.model` | 아바타·이름표·말풍선·PlayerController 비활성. 클라이언트는 `GetSideOf(true/false)`로 내 진영/상대 진영을 찾는다(ControllerUserId 비교). 숫자키 1~0·Esc·R(종료 후 재시작)·B(로비: 입장)·L(전투: 나가기). 서버 RPC는 유저 → 진영을 Director에서 찾아 `UseCard(side.Team, ...)` 호출 |
| 연출 | 클라이언트 전용 @Logic `BattleFx` | `Battle/BattleFx.mlua`, `Models/Effects/BattleHpBar.model`, `Models/Effects/BattleProjectile.model` | HP 바·타격 이펙트·효과음은 `Hp` 동기화 감소로 구동, 투사체는 `NotifyAttack`으로 구동 |
| 전장 연출 | 클라이언트 전용 @Logic `FieldFx` | `Battle/FieldFx.mlua` | 소환 포탈 2개(타워 앞 `SpawnOffsetX` 지점), 대기 중인 카드의 미리보기: 설치물 = 반투명 고스트 + 설치 불가 영역 음영(서버와 같은 범위 규칙), 스킬 = 범위 박스. 커서는 `_InputService:GetCursorPosition()`. 클라이언트 로컬 엔티티는 `battleprojectile`(스프라이트)·`battlehpbar`(색 사각형) 모델 재사용 |
| 플레이어 데이터 | DefaultPlayer의 @Component `PlayerData` | `Player/PlayerData.mlua` | `@TargetUserSync` Loaded·Meso·UnitsCsv("id:level,...")·DeckCsv·StagesCsv. 유저 저장소 키 `PlayerData`(JSON 한 덩어리, ProfileCode 기준). 룸마다 플레이어 엔티티가 새로 생기므로 로비·전투 룸 각각 입장 시 한 번 읽는다. 저장 시점: 신규 지급, 구매, 레벨업, 덱 변경(3초 모아서), 전투 종료, 룸 이탈·퇴장(변경이 남아 있을 때만). dirty + generation으로 중복·유실 방지. 서버 메서드 `BuyUnit` / `LevelUpUnit` / `SetDeck` / `GrantBattleResult`, 클라이언트 요청 `RequestBuyUnit` / `RequestLevelUp` / `RequestSetDeck` |
| 사운드 | 클라이언트 전용 @Logic `BattleSound` | `Sound/BattleSound.mlua` | 키 → RUID 표 6종(bgm_battle, hit, card, win, lose, click). 추가는 표에 한 줄 |
| HUD | `ui/BattleHUD.ui` + @Component `BattleHUD` | `UI/BattleHUD.mlua`(`/ui/BattleHUD/Controller`에 부착) | 전부 ClientOnly. 현재 맵에 Director가 있을 때만 표시. 덱·코스트는 내 진영, 기지 HP는 내 기지/상대 기지, 승패는 `WinnerTeam == 내 팀`으로 판단. 덱이 바뀌면 `ApplyDeck`으로 슬롯 재구성 |
| 맵 | `map/map01.map` = 로비(스태틱, 시작 지점), `map/battle.map` = 전투(인스턴스 맵, MapleTile) | battle: AllyBase x=-13.4, EnemyBase x=-2.6 (스케일 0.65), 평지 y=-1.36, 맵 루트에 `BattleDirector` | 타워를 Maker에서 옮기면 소환·설치 범위·카메라가 따라감. 로비 맵은 지형만 있고 전투 엔티티 없음 |
| 룸 전환 | @Logic `MatchService` + @Event `BattleEnterEvent` | `RootDesk/MyDesk/Match/` | 로비: `EnterBattle(userId, stageId)`가 룸 `pve_<userId>` 생성 → 입장 이벤트 전송 → 유저 이동. 전투 룸: 같은 Logic이 이벤트를 받아 보관(`GetEntryStage`), `LeaveBattle`로 로비 복귀. 임시 입력: 로비 B = 입장, 전투 L = 나가기 |

## Standing issues & handoff rules   (update in place — never re-append)
| Issue / rule | Workaround / rule | Count | First → last seen |
|---|---|---|---|
| 유닛 로스터 규칙 | 공격 클립이 있는 몬스터만 사용. 클립 출처는 공식 리소스 팩과 메토체스(`/Volumes/T7 Shield APFS/MSW/ProjectWorkspaces/MSWRemake/[Remake] Maple Auto Battler/RootDesk/MyDesk/InGame/CharacterInfo/CharacterInfo.csv`). 코드로 모션을 만들지 않는다 | 1 | 10-03 → 10-03 |
| 연출은 클라이언트 | 모션·이펙트·사운드·UI는 ClientOnly 코드에서만. 서버는 게임 상태만 | 1 | 10-03 → 10-03 |
| Maker 새로고침과 사용자 편집 충돌 | AI가 refresh/play를 돌리는 동안 사용자가 Maker에서 저장하지 않은 편집은 사라질 수 있다. 맵 편집은 저장 후 알려 달라고 안내 | 1 | 10-03 → 10-03 |
| MCP로 UI 버튼 클릭 불가 | `mouse_input`은 엔진 UI 버튼을 누르지 못한다. 버튼 경로는 사용자 테스트로 확인 | 1 | 10-03 → 10-03 |
| 새 맵 파일의 인스턴스 맵 지정 | 빌더로 만든 새 `.map`은 refresh만으로는 인스턴스 맵으로 인식되지 않았다(`[LEA-3002] 인스턴스 맵으로 지정된 맵이 없습니다`). Maker에서 그 맵을 한 번 열고(`maker_move_map`) 저장(`maker_save`)한 뒤 정상 동작 | 1 | 10-03 → 10-03 |
| 룸 이동과 클라이언트 상태 | 룸을 옮기면 클라이언트의 컴포넌트·UI가 다시 초기화된다(`OnBeginPlay` 재실행, `_T` 초기화). 룸을 넘는 클라이언트 상태는 서버 데이터에서 다시 받아야 한다. 유저를 옮긴 서버 RPC는 이동 직후 중단되므로 이동 뒤에 코드를 두지 않는다 | 1 | 10-03 → 10-03 |
| 로컬 워크스페이스 | 프로젝트 루트는 `/Volumes/T7 Shield APFS/MSW/maple_war`. 스킬·AGENTS.md는 상위 `MSW/`에 있다 | 1 | 10-03 → 10-03 |

## Log   (entries: the ACTIVE milestone only + ONE summary per completed milestone)
### 2026-10-03 Milestone M1 complete — summary
- 코어 전투 1스테이지 완성: 고정 덱 5종(주황버섯·스톤골렘·스타픽시 / 자동경비시스템 포탑 / 범위 스킬) vs 적 3종(슬라임·머쉬맘·돌의 정령), 기지 HP, 소환 코스트, 승패, 재시작, HUD, HP 바·타격·투사체·사운드.
- 계획과 달라진 점: 유닛 간 피해는 충돌 파이프라인 대신 거리 판정 직접 적용. 유닛별 모델 대신 공용 모델 1개 + 데이터. 전장은 24유닛 스크롤에서 한 화면(스케일 0.65)으로 축소.
- M1에서 뺀 것(로드맵으로): 밸런스 패스, 모바일 점검.
- 검증: 로직은 플레이 로그, 화면·소리·이펙트·버튼은 사용자가 직접 테스트해 확인(2026-10-03).
- 다음 마일스톤 전에 정할 구조 문제: 전투가 맵당 하나라 플레이어별로 분리되지 않음, 데이터가 스크립트 하드코딩, 영구 저장 없음.
- 전체 기록: `Archive/MapleWar-M1-GDD.md`.
### 2026-10-03 M2 Phase 1 complete
- 로비(`map01`) ↔ 전투 인스턴스(`battle`) 왕복 확인: 로비에서 B → 룸 `pve_<userId>` 생성, 입장 이벤트(stage1) 수신, 유저 이동, 전투 진행, L → 로비 복귀, 유저가 나가면 룸은 자동 제거.
- 이동 시간은 양방향 모두 약 1초(로그 시각 기준). 전투는 룸 생성 즉시 시작되어 유저 도착보다 약 1초 빠르다 → Phase 2에서 대기 상태를 넣어 유저 도착 후 시작하도록 한다.
- 맵 등록: `map/`에 파일이 있으면 등록된다(SectorConfig 없음). 시작 지점은 기본값 `/maps/map01`.
- HUD는 현재 맵에 `BattleDirector`가 있을 때만 보인다(로비에서는 숨김).
### 2026-10-04 M2 Phase 2 complete
- 전투 코어를 대칭 구조로 재구성: Director(진행자) / BattleSide(진영 상태, 기지 엔티티) / 조종자(Commander 또는 StageAI).
- 전투는 WAITING에서 시작해 플레이어가 전투 맵에 도착하면 PLAYING으로 넘어간다. 종료는 ENDED + WinnerTeam.
- 로그 확인: 진영 초기화(팀 1 = 유저·덱 5종, 팀 2 = AI·FreePlay), StageAI 소환, 카드 사용과 쿨타임 거부, 적 기지 파괴 → winner=team 1 → HUD 승리, R 재시작.
- 남은 팀 고정 요소: `BattleFx`의 HP 바 색(팀 1 초록 / 팀 2 빨강)과 카메라·유닛 방향은 팀 번호 기준이다. 대전에서 팀 2 플레이어 시점 처리는 M5에서 다룬다.
- 스크립트 간 타입 참조가 새로 생기면 첫 refresh에서 `LEA-1118`(타입 없음)이 남는다. 참조하는 쪽 파일을 한 번 더 저장하고 refresh하면 사라진다.
### 2026-10-04 M2 Phase 3 complete
- 유닛 9종·레벨 10단계·스테이지 1개·시간표 10줄을 데이터셋으로 옮기고 스크립트 하드코딩 테이블을 제거했다.
- CSV 열: UnitTable은 `UnitId, Kind, Name, Cost, Cooldown, Price, MaxHp, Attack, Range, AttackInterval, Speed, Scale, 클립 4종, AttackPlayRate/Pose/HitDelay, Projectile*, BarY/BarWidth, SkillDamage/SkillRadius, Effect*, #Memo`. 선택 열은 비워 두면 기본값. `#`로 시작하는 열은 메모.
- 기지 HP는 스테이지 표의 `BaseHp`를 쓴다(양쪽 기지 동일). 스테이지 시간표에 유닛 레벨 열이 있다.
- 플레이어 카드의 레벨은 아직 1 고정(Phase 4에서 플레이어 데이터로 대체).
- 로그 확인: 전투 중 유닛 수치가 표와 일치(스톤골렘 HP 220, 슬라임 70 등), `GetUnitAtLevel` 주황버섯 L3 = HP 72·공격 14.4, 범위 공격 L5 피해 84, 한글 이름 정상 로드.
- CSV는 BOM 포함 UTF-8로 저장했다(메토체스와 같은 형식).
### 2026-10-04 M2 Phase 4 complete
- 플레이어 데이터 저장·로드, 스타터 지급(UnitTable의 `Starter = 1`인 유닛 전부 + 앞에서부터 덱), 전투에 덱·레벨 반영, 승리 시 메소 지급과 클리어 기록, 구매·레벨업·덱 변경(서버 검증).
- Director는 플레이어 데이터가 로드될 때까지 WAITING에 머문다. 정산은 `SettleResult`(승리 = 스테이지 `RewardMeso`, 패배 = 0), `@Sync RewardMeso`는 결과 화면용.
- 로그 확인: 신규 유저 스타터 5종 지급·저장 → 전투 룸에서 로드 → 승리 +100 메소·stage1 클리어 저장 → 로비 복귀 후 meso=100 로드 → 주황버섯 레벨업(100 차감, 2레벨) → 슬라임 구매는 메소 부족으로 거부 → 덱 변경 성공/미보유 유닛 거부 → 다음 전투에서 주황버섯 HP 66·공격 13.2(2레벨) 적용.
- 테스트 잔여 데이터: Maker 로컬 저장소에 이 계정의 테스트 결과(메소 0, 주황버섯 2레벨, 덱 3장, stage1 클리어)가 남아 있다. 초기화는 `maker_reset_data_storage`(전체 삭제, 되돌릴 수 없음).
- UnitTable에 `Starter` 열 추가. 구매 테스트용으로 슬라임 300 / 머쉬맘 800 / 돌의 정령 600 가격을 넣었다(잠정).
