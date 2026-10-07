# 메이플 워 (가칭) — As-built log

> Running record of the world's implementation. Survives across milestones. ⚠️confirm = survey guess to verify with the user.

## Current state (by system)
| System | Built | Where (key files) | Notes / gotchas |
|---|---|---|---|
| 정의 데이터 | 데이터셋 5개(CSV) + 읽기 창구 @Logic `BattleConfig` | `RootDesk/MyDesk/Data/{UnitTable,UnitLevelTable,StageTable,StageWaveTable,CostLevelTable}.csv`(+`.userdataset`), `Battle/BattleConfig.mlua` | 수치 수정은 CSV에서(BOM 포함 UTF-8, `#` 열은 메모). `BattleConfig`는 표를 한 번 읽어 캐시: `GetUnit`, `GetUnitAtLevel(id, level)`, `GetLevels`, `GetCostLevels`, `GetStage`, `GetStageIds`, `GetStageWaves`, `GetStarterUnitIds`, `GetIconRuid`, `GetRarityColor`. 전역 조절값(UnitScale 0.65 / RangeScale 0.65 / SpeedScale 0.5, 코스트 시작 100·초당 20, DeckSize 10, DefaultCostLevelCap 3)은 스크립트 속성. 유닛 34종(스타터 20), 스테이지 5개. 수치는 전부 잠정값 |
| 전투 진행 | 전투 맵 루트의 @Component `BattleDirector` | `Battle/BattleDirector.mlua` | 진영 중립 진행자. `@Sync` State(WAITING/PLAYING/ENDED)·WinnerTeam·RewardMeso·AllyBaseX/EnemyBaseX·GroundY·StageId. 흐름: 플레이어 도착 + PlayerData 로드 → `Prepare` → 클라이언트 준비 보고(`SetPlayerReady`) 또는 `ReadyTimeout` 10초 → `StartBattle`. `UseCard(team, slot, x)`는 검증 후 실행, `PlayUnit(team, unitId, x, level)`은 검증 없이 실행(AI 경로). 스킬 피해는 `SkillHitDelay` 뒤에 적용. 종료 시 `SettleResult`(승리 = 스테이지 `RewardMeso`, 패배 = 0). `Restart()`, `UpgradeCostLevel(team)` |
| 진영 | 기지 엔티티의 @Component `BattleSide` | `Battle/BattleSide.mlua`, `Models/Bases/BaseTower.model` | `@Sync` Team·ControllerUserId("" = AI)·DeckCsv·Cost·CostMax·CostLevel·CostLevelCap, 서버 전용 쿨타임과 FreePlay. `Reset` / `Tick` / `CheckCard` / `PayCard` / `UpgradeCostLevel`. 기지 HP는 같은 엔티티의 `BattleUnit.Hp` |
| 스테이지 AI | 전투 맵 루트의 @Component `StageAI` | `Battle/StageAI.mlua` | 스테이지 시간표를 읽어 팀 2의 카드를 `PlayUnit`으로 넣는다. 시간표가 끝나면 스테이지의 `LoopPool`에서 무작위로 간격을 줄여 가며 소환 |
| 유닛(몬스터·설치물·기지) | @Component `BattleUnit` 하나 + 공용 모델 | `Battle/BattleUnit.mlua`, `Models/Units/BattleUnit.model`(id `battleunit`), `Models/Bases/BaseTower.model` | 차이는 데이터뿐(speed 0 = 고정, attack 0 = 공격 안 함). 타깃은 Director 목록에서 x 거리로 탐색, 피해는 `TakeDamage` 직접 적용(Attack/Hit 충돌 파이프라인 미사용). 클립은 서버가 `SpriteRUID` 교체(동기화). 공용 모델의 기본 `SpriteRUID`는 의도적으로 비어 있다(항상 `Setup`이 넣음). 투사체가 있는 유닛만 Multicast `NotifyAttack`. 공격 타입(`UnitTable.AttackType`: melee / ranged / melee_area / ranged_area)은 타격 시점의 `ApplyHit`에서 갈린다: 단일은 공격 시작 때 잡은 대상 하나, 범위(`IsAreaAttack`)는 그 순간 사거리 안의 적 전부(`BattleDirector:FindTargetsInRange`, 기지 포함) |
| 플레이어(지휘관) | DefaultPlayer의 @Component `Commander` | `Commander/Commander.mlua`, `Global/DefaultPlayer.model` | 아바타·이름표·말풍선·PlayerController 비활성. 클라이언트는 `GetSideOf(true/false)`로 내 진영/상대 진영을 찾는다. 입력은 숫자키 1~0(슬롯)·Esc(조준 취소)뿐, 임시 키 B·L·R은 제거됨. 서버 RPC: `RequestUseCard`, `RequestUpgradeCost`, `RequestEnterBattle`(스테이지 존재·해금 검증 후 `MatchService:EnterBattle`), `RequestLeaveBattle`, `RequestBattleReady`, `RequestRestart` |
| 연출 | 클라이언트 전용 @Logic `BattleFx` | `Battle/BattleFx.mlua`, `Models/Effects/BattleHpBar.model`, `Models/Effects/BattleProjectile.model` | HP 바·타격 이펙트·효과음은 `Hp` 동기화 감소로 구동, 투사체는 `NotifyAttack`으로 구동 |
| 전장 연출 | 클라이언트 전용 @Logic `FieldFx` | `Battle/FieldFx.mlua` | 소환 포탈 2개(타워 앞 `SpawnOffsetX` 지점), 대기 중인 카드의 미리보기: 설치물 = 반투명 고스트 + 설치 불가 영역 음영(서버와 같은 범위 규칙), 스킬 = 범위 박스. 스킬 이펙트는 피해 범위 중앙·폭에 맞춰 재생(`PlaySkillEffect`). 커서는 `_InputService:GetCursorPosition()`. 클라이언트 로컬 엔티티는 `battleprojectile`(스프라이트)·`battlehpbar`(색 사각형) 모델 재사용 |
| 플레이어 데이터 | DefaultPlayer의 @Component `PlayerData` | `Player/PlayerData.mlua` | `@TargetUserSync` Loaded·Meso·UnitsCsv("id:level,...")·DeckCsv·StagesCsv·CostLevelCap. 유저 저장소 키 `PlayerData`(JSON 한 덩어리: meso, units, deck, stages, costCap. ProfileCode 기준). 룸마다 플레이어 엔티티가 새로 생기므로 로비·전투 룸 각각 입장 시 한 번 읽는다. 로드 실패 시 `Loaded`를 켜지 않는다(기본값으로 덮어쓰기 방지). 저장 시점: 신규 지급, 구매, 레벨업, 한도 해금, 덱 변경(3초 모아서), 전투 종료, 룸 이탈·퇴장(변경이 남아 있을 때만). dirty + generation으로 중복·유실 방지. 서버 메서드 `BuyUnit` / `LevelUpUnit` / `UnlockCostLevel` / `SetDeck` / `GrantBattleResult` / `GrantMissingStarters`, 클라이언트 요청 `RequestBuyUnit` / `RequestLevelUp` / `RequestUnlockCostLevel` / `RequestSetDeck` |
| 사운드 | 클라이언트 전용 @Logic `BattleSound` | `Sound/BattleSound.mlua` | 키 → RUID 표 6종(bgm_battle, hit, card, win, lose, click). 추가는 표에 한 줄 |
| 전투 HUD | `ui/BattleHUD.ui` + @Component `BattleHUD` | `UI/BattleHUD.mlua`(`/ui/BattleHUD/Controller`에 부착) | 전부 ClientOnly. 현재 맵에 Director가 있을 때만 표시. 덱 슬롯(아이콘·등급 테두리·쿨타임), 코스트와 코스트 레벨 강화 버튼, 양쪽 기지 HP, 결과 패널(획득 메소, "로비로"·재시작·나가기 버튼) |
| 로비 UI | `ui/LobbyUI.ui` + @Component `LobbyUI` | `UI/LobbyUI.mlua`(`/ui/LobbyUI/Controller`) | 전부 ClientOnly. 현재 맵에 Director가 없을 때만 표시. 화면 4개(main / stage / deck / shop)를 하나씩 전환, 상단에 메소 표시. 동기화된 PlayerData 값의 서명이 바뀔 때만 다시 그림. 목록(스테이지 카드, 덱 슬롯, 보유 카드, 상점 행)은 숨긴 템플릿의 복제 풀(`SyncPool`). 알려진 문제: 상점·덱 화면을 처음 열 때 목록 생성에 3~4초 |
| 입장권(지갑)과 상점 | `PlayerData`의 지갑 부분 + @Logic `CurrencyShop` + 데이터셋 `CurrencyTable`·`ShopProductTable` | `Player/PlayerData.mlua`, `Player/CurrencyShop.mlua`, `Data/CurrencyTable.csv`, `Data/ShopProductTable.csv` | M3. 재화마다 `(n, at)`(수량, UTC 초 기준 시각)로 보관하고 회복분은 항상 그 쌍에서 다시 계산(회복 자체는 저장하지 않음, 접속 중 1초 타이머). `@TargetUserSync WalletCsv` = `id:수량:다음 +1 시각(ServerElapsedSeconds, 0 = 회복 안 함)`. 서버 메서드 `SpendCurrency` / `AddCurrency`(저장은 호출자가 결정) / `SaveNow`(저장 완료를 기다리고 성공 여부 반환) / `GrantPurchase`(구매 ID 최근 20개로 중복 지급 방지). 입장 비용은 `StageTable.EntryCost`, 재화는 `BattleConfig.EntryCurrencyId`. 로비 입장은 차감 → `SaveNow` → 이동 순서(전투 룸이 저장소를 다시 읽기 때문), 결과 화면 "다시 하기"도 같은 비용. 구매분은 최대치를 넘겨 쌓인다. `ShopProductTable.ProductId`가 비어 있으면 상점에 "준비 중" |
| 로딩 화면 | `ui/LoadingUI.ui` + @Component `LoadingUI`, @Logic `LoadingLogic` | `UI/LoadingUI.mlua`, `UI/LoadingLogic.mlua` | 전투 입장·퇴장 때 표시. 전투 클라이언트는 그 전투의 클립(내 덱 + 스테이지 적 유닛 + 포탈·피격 이펙트)을 미리 로드한 뒤 `Commander:RequestBattleReady`로 알린다 |
| 맵 | `map/map01.map` = 로비(스태틱, 시작 지점), `map/battle.map`·`battle2`~`battle5` = 전투(인스턴스 맵, MapleTile) | 스테이지 표의 `MapName`·`GroundY`가 스테이지와 맵을 잇는다. 맵 루트에 `BattleDirector`·`StageAI`, 자식 `AllyBase`·`EnemyBase` | 타워를 Maker에서 옮기면 소환·설치 범위·카메라가 따라감. 타일 세트마다 지면 높이가 달라 스테이지별 `GroundY`를 쓴다. 로비 맵은 지형만 있고 전투 엔티티 없음 |
| 룸 전환 | @Logic `MatchService` + @Event `BattleEnterEvent` | `RootDesk/MyDesk/Match/` | 로비: `EnterBattle(userId, stageId)`가 그 스테이지의 맵만 담은 룸 `pve_<userId>` 생성 → 입장 이벤트 전송 → 유저 이동. 전투 룸: 같은 Logic이 이벤트를 받아 보관(`GetEntryStage`), `LeaveBattle`로 로비 복귀. 입장은 스테이지 선택 화면, 퇴장은 HUD 버튼 |

## Standing issues & handoff rules   (update in place — never re-append)
| Issue / rule | Workaround / rule | Count | First → last seen |
|---|---|---|---|
| 유닛 로스터 규칙 | 공격 클립이 있는 몬스터만 사용. 클립 출처는 공식 리소스 팩과 메토체스(`/Volumes/T7 Shield APFS/MSW/ProjectWorkspaces/MSWRemake/[Remake] Maple Auto Battler/RootDesk/MyDesk/InGame/CharacterInfo/CharacterInfo.csv`). 코드로 모션을 만들지 않는다 | 1 | 10-03 → 10-03 |
| 연출은 클라이언트 | 모션·이펙트·사운드·UI는 ClientOnly 코드에서만. 서버는 게임 상태만 | 1 | 10-03 → 10-03 |
| Maker 새로고침과 사용자 편집 충돌 | AI가 refresh/play를 돌리는 동안 사용자가 Maker에서 저장하지 않은 편집은 사라질 수 있다. 맵 편집은 저장 후 알려 달라고 안내 | 1 | 10-03 → 10-03 |
| MCP로 UI 버튼 클릭 불가 | `mouse_input`은 엔진 UI 버튼을 누르지 못한다. 버튼 경로는 사용자 테스트로 확인 | 1 | 10-03 → 10-03 |
| 새 맵 파일의 인스턴스 맵 지정 | 빌더로 만든 새 `.map`은 refresh만으로는 인스턴스 맵으로 인식되지 않았다(`[LEA-3002] 인스턴스 맵으로 지정된 맵이 없습니다`). Maker에서 그 맵을 한 번 열고(`maker_move_map`) 저장(`maker_save`)한 뒤 정상 동작 | 1 | 10-03 → 10-03 |
| 룸 이동과 클라이언트 상태 | 룸을 옮기면 클라이언트의 컴포넌트·UI가 다시 초기화된다(`OnBeginPlay` 재실행, `_T` 초기화). 룸을 넘는 클라이언트 상태는 서버 데이터에서 다시 받아야 한다. 유저를 옮긴 서버 RPC는 이동 직후 중단되므로 이동 뒤에 코드를 두지 않는다 | 1 | 10-03 → 10-03 |
| 로컬 워크스페이스 | 2026-10-06부터 Windows `D:\MSW\maple_war\maple-war`(git 저장소, 원격 `origin/main`)에서 작업. 이전 Mac 경로(`/Volumes/T7 Shield APFS/MSW/...`)의 메토체스 CSV는 이 PC에 없다. MSW 스킬과 `AGENTS.md`는 2026-10-07부터 저장소 안(`.claude/skills`, 루트)에 있다 | 3 | 10-03 → 10-07 |

## Log   (entries: the ACTIVE milestone only + ONE summary per completed milestone)
### 2026-10-03 Milestone M1 complete — summary
- 코어 전투 1스테이지 완성: 고정 덱 5종(주황버섯·스톤골렘·스타픽시 / 자동경비시스템 포탑 / 범위 스킬) vs 적 3종(슬라임·머쉬맘·돌의 정령), 기지 HP, 소환 코스트, 승패, 재시작, HUD, HP 바·타격·투사체·사운드.
- 계획과 달라진 점: 유닛 간 피해는 충돌 파이프라인 대신 거리 판정 직접 적용. 유닛별 모델 대신 공용 모델 1개 + 데이터. 전장은 24유닛 스크롤에서 한 화면(스케일 0.65)으로 축소.
- M1에서 뺀 것(로드맵으로): 밸런스 패스, 모바일 점검.
- 검증: 로직은 플레이 로그, 화면·소리·이펙트·버튼은 사용자가 직접 테스트해 확인(2026-10-03).
- 다음 마일스톤 전에 정할 구조 문제: 전투가 맵당 하나라 플레이어별로 분리되지 않음, 데이터가 스크립트 하드코딩, 영구 저장 없음.
- 전체 기록: `Archive/MapleWar-M1-GDD.md`.
### 2026-10-06 Milestone M2 complete — summary
- 캠페인 뼈대 완성: 로비(스태틱 룸 `map01`) ↔ 유저별 전투 인스턴스 룸 왕복, 대칭 전투 코어(Director / BattleSide / Commander·StageAI), 정의 데이터 데이터셋 5개, 플레이어 데이터 저장(메소·보유 유닛과 레벨·덱·클리어 스테이지·코스트 레벨 한도), 로비 UI(스테이지 선택·덱 편성·상점·강화), 유닛 34종(스타터 20)·스테이지 5개와 전용 맵 5개.
- 계획에 없다가 추가된 것: 전투 중 코스트 레벨(`CostLevelTable`, 한도는 메소로 해금), 유닛 등급 5단계(표시 전용), 소환 포탈·설치 미리보기·스킬 범위 박스, 로딩 화면과 클라이언트 준비 대기, 스킬 피해 지연(`SkillHitDelay`), 스테이지별 전용 맵과 `GroundY`.
- 검증: 로직은 플레이 로그, 로비·결과 화면의 버튼 경로는 사용자가 기본 UI 테스트로 확인(2026-10-06). 같은 날 Maker 빌드 콘솔에 오류 없음(정보 수준 `LIA-1114` 5건뿐).
- 확인 없이 닫은 것(로드맵 Backlog "M2 이월 확인"): 새 유닛의 크기·공격 타이밍, 스테이지 3·4 맵 모양과 스테이지별 플레이, 마우스 추적 미리보기, 스킬 피해 시점과 이펙트 일치, 소환 직후 깜빡임 해소 여부, B·L·R 키 제거 확인, 상점·덱 첫 열기 3~4초 지연.
- 알아 둘 것: 스크립트 간 타입 참조가 새로 생기면 첫 refresh에서 `LEA-1118`이 남는다(참조하는 쪽을 한 번 더 저장 후 refresh). Maker 로컬 저장소에는 테스트 계정 데이터가 남아 있다(초기화는 `maker_reset_data_storage`, 전체 삭제·복구 불가).
- 전체 기록: `Archive/MapleWar-M2-GDD.md`.
### 2026-10-06 M3 Phase 1 complete, Phase 2·3 implemented
- 입장권(`ticket`): 최대 30, 6분에 1 회복, 시작량 30, 스테이지당 5(전부 표의 잠정값). 기존 계정은 첫 로드 때 30장을 받는다.
- 로그 확인: 입장 30 → 25(요청을 두 번 보내도 1회 차감), 저장 후 이동, 전투 룸 25장 로드, 강제로 기준 시각을 당기면 다음 틱에 회복, "다시 하기" 5 → 0, 0장에서 로비 입장 거부와 로딩 화면 해제, 같은 구매 ID 두 번 지급 시 한 번만 지급.
- 새 스크립트 파일은 `.mlua`와 함께 `.codeblock`(기존 파일 복사 + 새 GUID, Logic은 `Type` 5 / Component는 1)을, 새 데이터셋은 `.csv`와 `.userdataset`(새 GUID)을 만들면 refresh에서 인식된다.
- `.ui` 파일은 들여쓰기 2칸·CRLF JSON이라 Python `json`으로 읽고 같은 형식으로 쓰면 바이트가 그대로 보존된다. 기존 엔티티를 복제해 새 GUID·경로를 주는 방식으로 UI를 추가했다(`UITransform`의 `anchoredPosition`·`OffsetMin`·`OffsetMax`·`RectSize`를 함께 고친다).
- refresh 직후 빌드 콘솔에 정보 수준 `LIA-1114`/`1115`(다른 스크립트의 새 멤버를 아직 모름)가 남지만 오류는 아니며 플레이에 지장 없다.
- Maker 플레이 로그는 스택까지 포함해 양이 많다: 확인할 단계 직전에 `maker_clear_logs`를 하고 읽는다.
- 테스트 잔여 데이터: Maker 로컬 저장소의 테스트 계정에 가짜 구매 ID `test-purchase-1`로 지급한 입장권이 남아 있다.
- 월드 상품 3종 등록(비공개): 입장권 10장 `5JGW1T7EY` 50 / 30장 `1SBJQIC89` 130 / 100장 `XVSUGEYAW` 400 Worldcoin. `ShopProductTable.ProductId`에 기입. 판매 시작(공개)은 사용자 확인 후.
- 상품 등록 방법: `world_item_upload_thumbnail`(1차 호출로 presigned URL → `curl -X PUT --data-binary` 로 이미지 전송 → 2차 호출은 `fileUrl`에 쿼리 없는 기본 URL만 넘겨도 된다) → 응답 URL의 파일 이름(`숫자.png`)을 `itemThumbnailFileName`으로 `world_item_create`.
- Maker에서도 비공개 상품의 가격 조회(`GetProductAndWait`, 클라이언트)와 구매 창(`PromptPurchase`)이 동작한다. 구매 창의 버튼은 MCP로 누를 수 없다.
### 2026-10-07 M3 Phase 2 complete, Phase 4 (전투 기본기) 시작
- 사용자가 입장·다시 하기·구매 창까지 버튼 테스트 완료를 알려 옴 → Phase 2 완료. Phase 3은 출시 환경의 실제 결제 확인만 남았다.
- 방향 추가(사용자): 전투의 큰 골격은 '냥코 대전쟁'. PC 오픈 앞에 Phase 4 "전투의 기본기를 올린다"를 넣었다(기존 Phase 4는 Phase 5).
- 공격 타입 4종 구현(`UnitTable.AttackType`). 현재 유닛은 근거리 20 / 원거리 10이고 범위 공격 유닛은 없다. 범위 판정 = 타격 시점에 사거리 안의 적 전부(AI가 정한 잠정 규칙).
- 이 PC에도 MSW 스킬(`maple-war/.claude/skills`)과 `AGENTS.md`가 들어왔다 → `.ui`/`.model`/`.map`은 빌더로만 고친다(10-06의 `.ui` 직접 편집 방식은 더 쓰지 않는다).
- Maker에서 열어 둔 맵이 전투 맵이면 플레이가 로비를 거치지 않고 그 맵의 테스트 인스턴스(`server_instance_TestPlayInstance`)에서 바로 시작한다. 이때 스테이지는 `stage1`로 떨어지고 로비 UI는 없다. 로비부터 보려면 `map01`을 열고 플레이.
- 공격·피격 연출: 모든 공격이 `NotifyAttack`(Multicast)으로 클라이언트에 가고 `BattleFx:OnAttackFired`가 공격 이펙트(`PlayEffectAttached`)·공격음·투사체를 처리한다. 피격은 `BattleFx:PlayHit`가 머티리얼 교체로 흰색 점멸(`HitFlash` ↔ `UnitDefault`, 이름으로 조회)과 피격음을 처리한다. 유닛별 효과음은 `BattleSound:PlayRuid`(같은 소리 0.08초 간격 제한).
- `SpriteRendererComponent.Color`는 곱셈이라 1보다 큰 값을 줘도 스프라이트가 하얘지지 않는다(화면 확인). 흰색 점멸은 ColorOverride 셰이더 머티리얼이 필요하다. ColorOverride의 속성 이름은 문서 검색으로 나오지 않아 Maker에서 만든 파일이 있어야 한다.
- `_EntryService:GetMaterialIdByName`은 이 버전에서 `material://<uuid>` 형태를 돌려준다(스킬 문서의 "접두어 없는 UUID"와 다름). 없는 이름은 nil.
- 전투 맵에서 바로 시작한 테스트 플레이는 스테이지가 `stage1`로 떨어져 지면 높이가 그 맵과 다를 수 있다 → 유닛이 발판 아래로 떨어져 안 보인다. 서버에서 `director.GroundY`를 그 맵의 스테이지 값으로 바꾼 뒤 소환한다.
- 속성·효과·넉백(몬스터만): `UnitTable.Attribute` / `Effect` / `HitRuid` / `Knockback*`, 효과 정의와 속성별 확률은 `EffectTable`(`BattleConfig:GetEffect`). 흐름은 `BattleUnit:DealDamage` → `TakeDamage`(체력 구간마다 `StartKnockback`) → `TryApplyEffect`(맞은 유닛의 속성으로 확률) → `ReceiveEffect`(nullify / curse / warp / blow). 넉백 중에는 `Mode = "KNOCKBACK"`으로 공격·전진을 멈춘다. 지금은 모든 유닛의 속성·효과 칸이 비어 있어 효과가 발동하지 않는다.
- Rigidbody 유닛을 `MovementComponent`로 밀면 가속·관성 때문에 "속도 × 시간"만큼 정확히 가지 않는다(0.52 목표에 0.24, 1.30 목표에 1.86). 넉백은 목표 속도의 2배로 밀고, 시작 지점에서 잰 이동 거리가 목표를 넘으면 멈춘 뒤 목표 지점에 위치를 고정한다(고정하지 않으면 빠른 넉백은 멈춘 뒤에도 미끄러진다). 즉시 이동(워프)은 `MovementComponent:SetWorldPosition`.
- 전투 로직을 서버 스크립트로 시험할 때는 유닛을 원하는 자리에 직접 놓는다(`BattleDirector:SpawnUnit(team, id, x, cfg)`). 양 끝에서 걸어와 만나기를 기다리면 10초 넘게 걸린다.
