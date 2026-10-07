# 메이플 워 (가칭) — 횡스크롤 라인 대전 기획서 (GDD, M2)

> 🔖 **AI note — resuming?** If you're reading this in a new session to continue/resume this game, load the `msw-planning` skill FIRST and follow its resume flow (read `MapleWar-Roadmap.md` + `Archive/As-built.md` → reconstruct state → reconcile) — don't edit or implement straight from this doc. **Before touching any `⬜/🟡/✅` state or running a completion, Read the skill's `references/build-management.md` IN FULL.**
> Last updated: 2026-10-06 / Stage: complete (M2 done 2026-10-06 — 사용자가 기본 UI 테스트를 마치고 종료 결정. Phase 6의 세부 확인 항목은 로드맵 Backlog로 이월)

## 1. One-line concept
> "로비에서 덱을 짜고 스테이지를 골라 자기만의 전투 인스턴스에 들어가 싸우고, 메소를 받아 유닛을 사고 키우는 캠페인 뼈대. 전투 코어는 양 진영 대칭이라 이후 대전 모드가 같은 구조를 쓴다."

## 2. Key decisions (immutable baseline)
| Item | Decision | Notes |
|---|---|---|
| Camera/map mode | MapleTile (`TileMapMode = 0`), Body = `RigidbodyComponent` | 로비 맵 `map01`(스태틱), 전투 맵 `battle`(인스턴스) |
| 룸 구조 | 로비 = 스태틱 룸의 맵, 전투 = 플레이어마다 만드는 인스턴스 룸의 전투 맵 | `_RoomService:GetOrCreateInstanceRoom` / `MoveUserToInstanceRoom`. 룸끼리 메모리 공유 불가, 저장소는 공유. 인스턴스 룸 → 인스턴스 룸 직접 이동 불가(로비 경유) |
| 전투 코어 | 양 진영 대칭. Director는 서버 시간으로 양 진영 코스트를 채우고 카드 요청을 검증·실행하는 진행자 | 진영 상태(덱·코스트·쿨타임)는 기지 엔티티의 `BattleSide`에 둔다. Director는 조종자가 플레이어인지 AI인지 모른다 |
| 캠페인 AI | 스테이지 시간표가 플레이어 입력을 대신 넣는다. AI는 코스트·쿨타임 검증을 받지 않는다(시간표가 정답) | 요청 경로는 플레이어와 같고 검증만 건너뛴다 |
| 데이터 | 정의 데이터는 데이터셋(CSV), 플레이어 데이터는 서버 관리 + 저장소 | 저장 시점: 유닛 구매, 레벨업, 덱 변경(모아서 한 번), 전투 종료 |
| 성장 | 유닛 레벨업 있음. 유닛 획득과 레벨업 모두 메소 | 메소는 전투 종료 시 지급되는 인게임 기본 재화 |
| 시작 유닛 | 스타터 세트 20종 지급 | 구성은 콘텐츠 Phase에서 결정 |
| 덱 | 최대 10종, 유닛 종류 3가지(몬스터·설치물·스킬) | M1과 동일 |
| Player count | 로비는 여러 명 공존(아바타 숨김, UI만), 전투는 1명(캠페인) | 대전(2명 한 룸)은 M5 |
| 원칙 | 연출은 클라이언트만. 공격 클립 있는 몬스터만 사용(메토체스 포함). 밸런스·모바일 점검은 이 마일스톤에서 하지 않음 | `Archive/As-built.md` Standing rules |

## 3. Core loop (one session)
접속 → 로비(덱 편성 · 유닛 구매/레벨업 · 스테이지 선택) → 전투 인스턴스 입장 → 전투(M1 코어) → 결과와 메소 지급 → 로비 복귀 → 메소로 유닛 구매/레벨업 → 다음 스테이지

## 4. Core systems
**룸 전환**
- 로비 서버 쪽 매칭 담당이 유저별 인스턴스 룸을 만들고 전투 맵으로 보낸다. 전투가 끝나면 로비 맵으로 돌려보내고 룸을 없앤다.
- 전투 룸에는 "어느 유저가 어느 스테이지를 어떤 덱으로" 들어왔는지가 전달되어야 한다(전달 방식은 Phase 1 실험으로 확정).

**전투 코어 (대칭)**
- `BattleDirector`: 시계와 상태(대기 → 진행 → 종료), 유닛 목록, 타깃 탐색, 승패, 결과 정산, `UseCard(진영, 슬롯, 위치)` 처리.
- `BattleSide`(기지 엔티티마다): 덱(유닛과 레벨), 코스트, 쿨타임, 기지 HP. 본인 진영 상태가 HUD로 동기화된다.
- 조종자: `Commander`(플레이어 입력) / `StageAI`(스테이지 시간표).
- `BattleUnit`: 구조 유지. 수치는 정의 × 레벨 배율.

**데이터셋**
| 표 | 내용 |
|---|---|
| 유닛 표 | 종류, 이름, 코스트, 쿨타임, 기본 수치, 클립·타이밍, 투사체, 구매 가격 |
| 유닛 레벨 표 | 레벨별 수치 배율, 레벨업 비용(메소) |
| 스테이지 표 | 이름, 기지 HP, 클리어 보상 메소, 해금 조건 |
| 스테이지 시간표 | 스테이지, 시각, 유닛, 레벨 |

**플레이어 데이터**
- 메소, 보유 유닛과 레벨, 덱(최대 10종), 클리어한 스테이지.
- 로비에서 읽어 본인 클라이언트에만 동기화. 전투 룸은 입장 시 필요한 부분을 다시 읽고, 종료 시 보상·진행도를 쓴다.
- 신규 유저는 스타터 세트 20종과 기본 덱을 받는다.

**로비 UI**
- 스테이지 선택, 덱 편성, 상점(유닛 구매)·강화(레벨업), 메소 표시. 화면 전환 관리자 하나.
- 전투 결과 화면에 획득 메소 표시 후 로비로.

## 5. System ↔ MSW mapping
| Game system | MSW implementation |
|---|---|
| 룸 전환 | 스태틱 룸의 서버 스크립트 + `_RoomService` (인스턴스 룸 생성·이동·제거). 전투 맵은 `MapComponent.IsInstanceMap` |
| 전투 진행 | 전투 맵 루트의 @Component `BattleDirector` |
| 진영 상태 | 기지 엔티티의 @Component `BattleSide` (`@Sync`) |
| 조종자 | DefaultPlayer의 `Commander`, 전투 맵의 @Component `StageAI` |
| 유닛 | `BattleUnit` + 공용 모델 |
| 정의 데이터 | UserDataSet(CSV) + 읽기 창구 `BattleConfig` (`msw-general` `dataset.md`) |
| 플레이어 데이터 | 서버 스크립트 + `_DataStorageService` (`msw-scripting` `datastorage.md`: 캐시 → 변경 표시 → 모아서 저장) |
| 로비·결과 UI | `.ui` + UIBuilder (`msw-ui-system`), 클라이언트 화면 관리자 |
| 연출 | 기존 `BattleFx`, `BattleSound` |

## 6. Roadmap (Phases)
States: ⬜ not started · 🟡 implemented (untested) · ✅ tested.

### Phase 1 — "로비에서 전투 인스턴스로 갔다가 돌아온다" (done)
- ✅ 맵 구성 조사: 맵 등록 방식(이 워크스페이스에는 `SectorConfig`가 없음), 시작 맵 지정, 인스턴스 맵 지정 방법 확인
- ✅ 로비 맵 생성과 시작 맵 지정, `map01`을 인스턴스 전투 맵으로 지정
- ✅ 룸 전환 최소 흐름: 로비에서 입력 → 유저별 인스턴스 룸 생성·입장 → 전투 → 종료 후 로비 복귀·룸 제거
- ✅ 전투 룸에 입장 정보(유저, 스테이지) 전달 방식 실험과 확정, 이동 소요 시간 측정

### Phase 2 — "양 진영이 같은 규칙으로 싸운다" (done)
- ✅ `BattleSide`: 진영별 덱·코스트·쿨타임, 기지 엔티티에 부착, 동기화
- ✅ `BattleDirector` 재구성: `UseCard(진영, 슬롯, 위치)`, 양 진영 코스트 충전, 진영 중립 승패 판정
- ✅ `StageAI`: 스테이지 시간표로 적 진영 입력(검증 없이), 기존 시간표 스포너 대체
- ✅ `Commander`·HUD를 "내 진영" 기준으로 전환

### Phase 3 — "수치가 표에서 온다" (done)
- ✅ 유닛 표·유닛 레벨 표·스테이지 표·스테이지 시간표 데이터셋 작성
- ✅ `BattleConfig`를 데이터셋 읽기 창구로 전환, 하드코딩 테이블 제거
- ✅ 유닛 수치에 레벨 배율 적용

### Phase 4 — "내 유닛과 메소가 남는다" (done)
- ✅ 플레이어 데이터: 로드·캐시·저장(정해진 시점에만), 본인 클라이언트 동기화
- ✅ 신규 유저 스타터 세트와 기본 덱 지급
- ✅ 전투 입장 시 덱·레벨 반영, 종료 시 메소 지급과 스테이지 클리어 기록
- ✅ 유닛 구매와 레벨업(메소 차감, 서버 검증)

### Phase 5 — "로비에서 준비하고 들어간다" (done)
> 사용자 기본 UI 테스트 완료(2026-10-06). 구현 완료(2026-10-04). 모든 버튼 경로는 클라이언트에서 핸들러를 직접 호출해 확인했다(MCP로는 UI 버튼 클릭·스크롤을 재현할 수 없음). 구현: `ui/LobbyUI.ui` + `UI/LobbyUI.mlua`(`/ui/LobbyUI/Controller`, 전부 ClientOnly). 현재 맵에 BattleDirector가 없을 때만 표시, 플레이어 데이터 동기화 값이 바뀔 때만 다시 그림, 목록은 템플릿 복제 풀. `BattleConfig:GetStageIds()` 추가, `Commander.RequestEnterBattle`에 서버 해금 검증 추가.
- ✅ 화면 전환 관리자와 로비 기본 화면(메소 표시 포함)
- ✅ 스테이지 선택 화면(해금 상태 표시, 입장)
- ✅ 덱 편성 화면(보유 유닛에서 최대 10종 선택)
- ✅ 상점·강화 화면(구매, 레벨업)
- ✅ 전투 결과 화면에 획득 메소 표시 후 로비 복귀

### Phase 6 — "콘텐츠가 들어간다" (closed)
> 2026-10-06 사용자 결정으로 종료. 아래 🟡 항목의 "needs user test" 세부 확인은 따로 보고받지 않았으므로 로드맵 Backlog("M2 이월 확인")로 옮겼다. 구현(2026-10-04): 유닛 34종(스타터 20 = 몬스터 14 + 설치물 3 + 스킬 3, 그 외 적 겸 구매용 14), 스테이지 5개와 전용 맵 5개. 새 유닛은 공식 리소스 팩의 stand/move/attack1/die1 클립을 쓴다. 수치는 역할별 잠정값(밸런스 미조정).
- 🟡 스타터 세트 20종 구성과 유닛 표 채우기(구매용 유닛 포함)  ⚠️ needs user test: 새 유닛들의 크기·공격 타이밍·방향이 자연스러운지 (스테이지 2에서 예티·라이오너 등 소환과 지면 위 이동은 화면 확인). 공격 시간은 프레임 수로 추정한 값
- 🟡 스테이지 3~5개와 시간표 작성 → 스테이지 5개, 직선 해금, 스테이지마다 다른 타일의 전용 맵(`battle`, `battle2`~`battle5`)  ⚠️ needs user test: 스테이지 3~5 맵의 모양(2·5번만 화면 확인), 각 스테이지 플레이
- 🟡 유닛·스킬 이미지 표시: 상점, 덱 편성, 전투 슬롯  ⚠️ needs user test: 실제 화면에서 이미지와 글자 배치, 전투 중 쿨타임 표시가 이미지 위에 그려지는지 (세 화면 모두 스크린샷으로 아이콘 표시 확인됨). 알려진 문제: 상점·덱 화면을 처음 열 때 목록 생성에 3~4초 걸리고 그동안 빈 카드가 잠깐 보임
- 🟡 샘플·잔여물 정리: `map/` 전체를 나열해 맵마다 점검(템플릿 샘플, 쓰지 않는 맵), M1의 임시 입력(R 재시작 등) 정리  ⚠️ needs user test: 메이커 연결이 끊긴 상태에서 수정해 빌드·플레이 미확인. 리프레시 후 빌드 오류가 없는지, 숫자 키 1~0과 Esc가 그대로 동작하는지, B·L·R 키가 더 이상 반응하지 않는지

## 7. Data-driven
정의 데이터는 Phase 3에서 전부 데이터셋(CSV)으로 옮긴다. 그 전의 Phase 1~2는 기존 `BattleConfig` 테이블을 그대로 쓴다.

## 8. Decisions (this milestone)
| Item | Status |
|---|---|
| 룸 구조, 대칭 전투 코어, AI 시간표(검증 없음), 데이터셋, 메소로 구매·레벨업, 스타터 20종 | Decided (2026-10-03) |
| 전투 룸에 입장 정보를 전달하는 방식 | Decided: 로비가 룸 생성 직후 `BattleEnterEvent`(유저, 스테이지)를 그 룸으로 보내고(`RequestSendEventToRoomAndWait`), 전투 룸의 `MatchService`가 받아 보관. 덱·레벨 같은 큰 데이터는 전투 룸이 저장소에서 직접 읽는다 |
| 맵 이름 | Decided: 로비 = `map01`(기본 시작 지점 `/maps/map01`을 그대로 써서 `Global/` 설정 파일을 새로 만들지 않음), 전투 = `battle`(인스턴스 맵) |
| 스타터 20종 구성, 구매용 유닛, 가격·레벨업 비용·보상 수치 | Pending → Phase 6 (수치는 잠정값, 밸런스는 로드맵) |
| 패배 시 메소 지급 여부, 스테이지 반복 보상 | Decided(잠정): 패배는 0, 승리는 매번 스테이지 표의 `RewardMeso` 지급(반복 클리어도 같은 보상). 수치·규칙 조정은 밸런스 단계에서 |
| 레벨 상한과 배율 곡선 | Decided(잠정값): 10레벨, 레벨당 HP·공격력·스킬 피해 +10%, 레벨업 비용 100 × 레벨. `UnitLevelTable.csv`에서 수정 |

## 9. Plan changes (revision log)
| When | Type | What changed | Reason | Impact |
|---|---|---|---|---|
| 2026-10-04 | Add | 전투 연출 보강: 소환 지점 포탈(유닛이 공중에서 떨어지지 않고 포탈 위치 지면에서 등장), 설치물 배치 미리보기(반투명 고스트 + 설치 불가 영역 음영), 스킬 범위 박스 | 사용자 요청 | 클라이언트 전용 `Battle/FieldFx.mlua` 추가. 소환 지점을 타워 앞 1.0유닛으로 이동, 타워 그리기 순서를 포탈 뒤로. 마우스 추적은 MCP로 재현할 수 없어 사용자 확인 필요 |
| 2026-10-04 | Modify | 스테이지를 5개로 하고 스테이지마다 다른 타일의 전용 전투 맵을 쓴다. `StageTable`에 `MapName`, `GroundY` 열 추가, 인스턴스 룸은 그 스테이지의 맵만 포함 | 사용자 요청 | 타일 세트마다 지면 높이가 달라(Maker가 저장 시 발판을 타일에 맞춰 다시 만듦) 스테이지별 `GroundY`를 Director가 동기화하고 소환·포탈·이펙트가 이를 쓴다. 맵을 추가하면 Maker에서 열고 저장해야 인스턴스 맵으로 인식 |
| 2026-10-04 | Add | 유닛·스킬 이미지를 상점·덱 편성·전투 슬롯에 표시(`BattleConfig:GetIconRuid`) | 사용자 요청 | Phase 6 항목으로 추가 |
| 2026-10-04 | Modify | 스킬 이펙트를 피해 범위 중앙·범위 폭에 맞춰 재생(`FieldFx:PlaySkillEffect`, 클립의 가장 큰 프레임 기준으로 위치·크기 계산) | 사용자 보고 — 메테오 이펙트 위치가 피해 범위와 어긋남 | 화면 확인 완료(스테이지 2). 스킬 2종(번개, 눈보라) 추가 |
| 2026-10-04 | Modify | 기존 계정에도 새로 추가된 스타터 유닛을 로드 시 지급(`PlayerData:GrantMissingStarters`) | 스타터 세트 확장 | 추가분이 있을 때만 저장 1회 |
| 2026-10-04 | Modify | 스킬 피해 시점을 이펙트에 맞춤: `UnitTable`에 `SkillHitDelay`(시전 후 피해까지 초) 열 추가, 서버가 그 시간 뒤에 피해 적용. 클라이언트는 덱의 스킬 이펙트를 전투 시작 때 미리 로드 | 사용자 보고 — 피해가 이펙트보다 먼저 들어감 | 잠정값 메테오 0.45 / 번개 0.2 / 눈보라 0.6. 로그 확인: 시전 직후 HP 변화 없음, 0.51초 뒤 피해 적용. 이펙트와 맞는지는 화면 확인 필요 |
| 2026-10-04 | Modify | 공용 유닛 모델(`BattleUnit.model`)의 기본 `SpriteRUID`를 비움, 전투 시작 시 클라이언트가 그 전투에 나올 클립(내 덱 + 스테이지 적 유닛)을 미리 로드, Director의 `StageId`를 동기화 | 사용자 보고 — 유닛이 소환 직후 잠깐 주황버섯으로 보임(모델 기본 그림이 주황버섯이었고, 서버가 넣은 실제 클립이 동기화·로드되기 전까지 보였음) | "SpriteRUID를 비우지 않는다" 규칙의 의도적 예외: 이 모델은 항상 `BattleUnit:Setup`이 클립을 넣는다. 유닛이 정상 표시되는 것은 화면 확인, 깜빡임이 사라졌는지는 사용자 확인 필요 |
| 2026-10-04 | Add | 로딩 화면과 준비 대기: 전투 입장·퇴장 때 로딩 화면(`LoadingUI`, `LoadingLogic`)을 띄우고, 클라이언트가 그 전투의 클립(내 덱 + 스테이지 적 유닛 + 포탈·피격 이펙트) 로드를 마쳤다고 알릴 때까지(`Commander:RequestBattleReady` → `BattleDirector:SetPlayerReady`) 전투를 `WAITING`으로 둔다. 응답이 없으면 `ReadyTimeout`(10초) 뒤에 시작 | 사용자 결정 — 리소스 로드를 기다렸다가 시작하고 그동안 로딩 화면 표시 | 로그 확인: 입장 시 로딩 표시 → 클립 47개 로드 → 준비 보고 → 전투 시작(대기 0.65초) → 로딩 숨김. 퇴장 시에도 표시 후 로비에서 숨김. 화면 모양과 클릭 경로(스테이지 버튼, 나가기 버튼)는 사용자 확인 필요 |
| 2026-10-04 | Add | 유닛 등급(rarity) 5단계: `UnitTable`에 `Rarity` 열(normal / rare / epic / unique / legendary), 몬스터·설치물·스킬 모두 적용. 상점 행, 덱 편성 슬롯·보유 카드, 전투 슬롯에 등급 색 테두리(회색·파랑·보라·노랑·연두) 표시(`BattleConfig:GetRarityColor`, `PaintRarityFrame`) | 사용자 요청 | 등급은 현재 표시 전용이며 능력치·가격에 영향 없음. 34종 배정은 임의값(밸런스 패스 때 재조정). 세 화면 모두 화면 확인 완료 |
| 2026-10-04 | Add | 전투 중 코스트 레벨(인게임 레벨): 매 전투 Lv 1에서 시작, 전투 화면 좌측 하단 버튼으로 코스트를 지불해 올린다. 레벨마다 코스트 최대 보유량이 커지고 회복 속도가 1.25배씩 곱해진다(Lv1 200 → Lv2 400 → Lv3 800). 기본 한도는 Lv 3, 로비 상점에서 메소로 한도를 Lv 10까지 연다. 데이터는 `CostLevelTable`(CostMax, RegenRate, UpgradeCost, UnlockMeso), 한도는 `PlayerData.CostLevelCap`(저장), 전투 중 상태는 `BattleSide.CostLevel`·`CostLevelCap`, 요청은 `Commander:RequestUpgradeCost` → `BattleDirector:UpgradeCostLevel` | 사용자 요청 — 게임의 핵심 규칙으로 추가 | `BattleConfig.CostMax` 속성 삭제(표로 대체). Lv 4 이상 최대 보유량, 강화 비용, 한도 해금 메소는 잠정값. 로그 확인: Lv1→2→3 강화, 한도에서 거부, 메소 부족 시 한도 해금 거부. 버튼 실제 클릭은 사용자 확인 필요 |
| 2026-10-04 | Modify | 정리: 임시 키 B(스테이지 1 입장)·L(퇴장)·R(재시작) 제거 — 입장은 스테이지 선택 화면, 퇴장과 재시작은 HUD 버튼으로만. 맵 6개(`map01`, `battle`, `battle2`~`battle5`) 점검 결과 템플릿 샘플·쓰지 않는 엔티티 없음, `RootDesk/MyDesk`에 템플릿 스크립트 없음, `BattleConfig`의 속성은 모두 사용 중 | M2 Phase 6 정리 항목 | 메이커가 꺼진 상태라 리프레시·플레이 확인은 아직 못 함 |
