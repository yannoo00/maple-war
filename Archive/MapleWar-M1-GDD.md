# 메이플 워 (가칭) — 횡스크롤 라인 대전 기획서 (GDD, M1)

> 🔖 **AI note — resuming?** If you're reading this in a new session to continue/resume this game, load the `msw-planning` skill FIRST and follow its resume flow (read `MapleWar-Roadmap.md` + `Archive/As-built.md` → reconstruct state → reconcile) — don't edit or implement straight from this doc. **Before touching any `⬜/🟡/✅` state or running a completion, Read the skill's `references/build-management.md` IN FULL.**
> Last updated: 2026-10-03 / Stage: complete (M1 done 2026-10-03 — 화면·소리·이펙트 항목은 사용자가 직접 테스트해 확인)

## 1. One-line concept
> "덱에 담은 유닛(몬스터·설치물·스킬)을 써서 한 줄 전장에서 밀고 밀리며 적 기지를 부수는 싱글 횡스크롤 라인 대전. M1은 고정 덱으로 한 스테이지에서 한 판이 처음부터 끝까지 성립하는 것까지."

## 2. Key decisions (immutable baseline)
| Item | Decision | Notes |
|---|---|---|
| Camera/map mode | MapleTile (`TileMapMode = 0`) | Body = `RigidbodyComponent`. `map01`에서 제작. Phase 1 첫 작업으로 `map01`의 모드를 확인하고, 0이 아니면 사용자가 Maker에서 전환(AI는 전환하지 않음) |
| Player | DefaultPlayer는 지휘관 역할 | 전장에 등장하지 않음(숨김·이동 잠금). 조작은 카메라 좌우 스크롤과 소환 버튼 |
| Session length | 한 판 3~5분 | |
| Player count | 솔로 | 전투 판정은 서버, UI는 클라이언트. 출시 시 최대 인원 1명 설정은 사용자 작업 → 로드맵 M3 |
| Platform | PC 우선 | PC 버전 개발 중에는 모바일 점검을 하지 않는다. 대신 UI는 처음부터 터치 가능한 크기(버튼 80×80px 이상)와 마우스 오버에 의존하지 않는 조작으로 만든다. 모바일 검수 전체 → 로드맵 M4 |
| Deck | 덱을 들고 입장, 한 덱 최대 10종 | 유닛 종류는 몬스터·설치물·스킬 세 가지. M1은 고정 덱 5종(편성 화면 → 로드맵 M2), HUD 슬롯은 10칸 기준으로 설계 |
| Unit concept | 메이플 몬스터, 공격 클립이 있는 몬스터만 사용 | 아군·적 모두 몬스터 리소스. 공격은 항상 클립 재생으로 표현하고 코드로 모션을 만들지 않는다. 클립 출처는 공식 리소스 팩과 메토체스(`ProjectWorkspaces/MSWRemake/[Remake] Maple Auto Battler`의 `CharacterInfo.csv`). 클립이 없는 몬스터는 보류 |
| Priority | 재미 검증 우선 | 콘텐츠 양보다 "한 판이 재미있는가" |

## 3. Core loop (one session)
전투 시작 → 소환 코스트가 시간에 따라 차오름 → 덱의 유닛 사용(코스트 지불, 쿨타임): 몬스터 소환 / 설치물 설치 / 스킬 발동 → 몬스터가 자동으로 전진·교전 → 전선이 밀고 밀림 → 적 기지 HP 0이면 승리 / 아군 기지 HP 0이면 패배 → 결과 화면 → 다시 하기

## 4. Core systems
수치는 모두 잠정값이다. 밸런스는 이 마일스톤에서 잡지 않는다(로드맵 참조).

**전장**
- 평평한 발판 하나. 양쪽 타워가 PC 한 화면(가로 12.8유닛)에 들어오도록 배치한다(타워 간 거리 약 10.8유닛). 전체 스케일 0.65.
- 카메라는 높이 고정. 전장이 한 화면에 들어오면 가운데 고정이고, 전장이 화면보다 길 때만 A/D·방향키로 좌우 스크롤.

**덱과 유닛 종류**
- 덱은 최대 10종. M1은 고정 덱 5종: 몬스터 3 + 설치물 1 + 스킬 1.
- 모든 유닛은 공통으로 종류(kind)·코스트·쿨타임을 가진다. 종류별 동작(잠정 정의, Phase 2 구현 전 사용자 확인):
  - **몬스터**: 아군 기지에서 소환되어 전진·교전.
  - **설치물**: 전장의 아군 쪽 지점을 골라 설치. 움직이지 않고 HP가 있으며 적의 공격 대상이 된다. M1은 사거리 안의 적을 쏘는 포탑 1종.
  - **스킬**: 전장의 지점을 골라 즉시 발동하는 효과. M1은 범위 피해 1종.
- 적 진영은 M1에서 몬스터만 사용한다.

**몬스터 (아군 3종, 적 3종)**
| 역할 | 코스트 | HP | 공격력 | 사거리 | 이동 속도 | 소환 쿨타임 |
|---|---|---|---|---|---|---|
| 근접 돌격 | 50 | 낮음 | 낮음 | 근접 | 빠름 | 2초 |
| 탱커 | 100 | 높음 | 낮음 | 근접 | 느림 | 5초 |
| 원거리 | 150 | 낮음 | 높음 | 김 | 보통 | 8초 |

- 행동: 적 기지 방향으로 전진 → 사거리 안에 적 유닛이나 기지가 있으면 멈추고 일정 간격으로 공격 → HP 0이면 사망 연출 후 제거.
- 유닛끼리 물리 충돌은 없다(겹쳐 지나가지 않도록 사거리 정지로만 전선 형성).
- 적 3종은 같은 역할 구성에 다른 몬스터 외형.

**기지**
- 양쪽 기지 HP 1000. 유닛 소환 지점이자 공격 대상.

**소환 코스트 (판 내 자원)**
- 0에서 시작, 초당 일정량 증가, 상한 있음. 메이플 코인·캠페인 입장 재화와 무관.

**적 스포너**
- 스테이지 스크립트(시간표)에 따라 적 유닛을 소환. 시간이 갈수록 간격이 짧아짐.

**UI**
- HUD: 소환 코스트, 덱 슬롯(10칸 기준 배치, M1은 5칸 사용, 코스트·쿨타임 표시, 숫자키 1~0), 양쪽 기지 HP.
- 설치물·스킬은 슬롯 선택 후 전장을 클릭해 위치를 지정한다.
- 결과 팝업: 승리/패배, 다시 하기.

## 5. System ↔ MSW mapping
| Game system | MSW implementation |
|---|---|
| 전투 흐름(시작·승패·재시작) | `map01` 맵 엔티티의 `@Component` (BattleDirector). 맵 범위 콘텐츠이므로 `@Logic`이 아님 |
| 소환 코스트·쿨타임 | BattleDirector가 서버에서 관리, `@Sync`로 HUD에 전달 |
| 유닛 행동(전진·사거리 정지·공격·사망) | 유닛 `.model` + 유닛 `@Component` (자체 AI, `monster.md` Pattern A 방식). Body = `RigidbodyComponent` |
| 유닛 애니메이션 | 스크립트가 `SpriteRendererComponent.SpriteRUID`를 직접 교체 (`monster.md` Pattern A) |
| 공격·피격·데미지 | BattleDirector의 유닛 목록에서 x 거리로 타깃을 찾아 `BattleUnit:TakeDamage`로 직접 적용(서버). 원거리 투사체는 `msw-combat-system` `projectile.md` 참고 |
| 덱·유닛 정의 | 유닛 정의 테이블(종류·코스트·쿨타임·모델 ID), BattleDirector가 덱 슬롯 사용 요청을 종류별로 분기 |
| 설치물 | 설치물 `.model` + 포탑 `@Component`(HP·사거리 공격), 위치 지정은 클라이언트 입력 → 서버 요청 |
| 스킬 | 스킬 실행 `@Component`/함수(범위 판정 + 이펙트), `.model` 없음 |
| 기지 | 기지 `.model` 2개(아군/적) + HP `@Component` |
| 적 스포너 | `map01` 맵 엔티티의 `@Component`, `_SpawnService:SpawnByModelId(..., self.Entity.CurrentMap)` |
| 지휘관(플레이어) | DefaultPlayer 숨김·이동 잠금 (`msw-defaultplayer`), 카메라 스크롤은 `CameraComponent` 제어 |
| HUD·결과 팝업 | `.ui` + UIBuilder (`msw-ui-system`) |
| HP 바 | `msw-combat-system` `hp-gauge.md` |
| 스프라이트·이펙트·사운드 | `msw-search`로 RUID 검색 → `msw-sprite-ruid`로 적용 |
| 수치(유닛·스테이지) | M1은 설정 스크립트 한 곳에 모아 하드코딩 (§7) |

권장 폴더: `RootDesk/MyDesk/Battle/`, `Units/`, `UI/`, `Models/Units/`, `Models/Bases/`.

## 6. Roadmap (Phases)
States: ⬜ not started · 🟡 implemented (untested) · ✅ tested.

### Phase 1 — "유닛이 걸어가서 싸운다" (done)
- ✅ `map01`의 `TileMapMode` 확인(0이어야 함)과 워크스페이스 점검(CoreVersion, `ui/`·`Environment/` 동기화 여부)
- ✅ 전장 구성: 평평한 발판, 배경, 양쪽 기지 자리
- ✅ 지휘관 설정: DefaultPlayer 숨김·이동 잠금, 카메라 좌우 스크롤
- ✅ 아군 근접 유닛 1종: 모델, 전진·사거리 정지·공격·사망
- ✅ 적 근접 유닛 1종: 같은 구조, 반대 방향
- ✅ 디버그 소환 키로 양쪽 유닛을 소환해 교전 확인

### Phase 2 — "한 판이 성립한다" (done)
- ✅ 기지 2개: HP, 유닛의 기지 공격, 파괴 시 승리/패배 판정
- ✅ 소환 코스트: 시간에 따른 증가와 상한
- ✅ 덱 HUD: 덱 슬롯(10칸 기준, 고정 덱 5종), 코스트 차감, 쿨타임, 숫자키 단축키
- ✅ 몬스터 3종 완성: 탱커, 원거리(투사체) 추가 — 아군·적 각각
- ✅ 설치물 1종: 위치 지정 설치, HP, 사거리 공격 포탑
- ✅ 스킬 1종: 위치 지정 범위 피해
- ✅ 적 스포너: 스테이지 시간표에 따른 소환
- ✅ 결과 팝업과 다시 하기(전장 초기화)

### Phase 3 — "한 판이 볼만하다" (done)
- ✅ 유닛·기지 HP 바
- ✅ 타격 이펙트, 효과음(HUD 버튼 포함), BGM, HUD 패널 가독성 보정
- ✅ 원거리 유닛 투사체 연출(Phase 2는 사거리 판정만 구현)
- ✅ 샘플 엔티티 정리: `map/` 전체를 나열해 맵마다 점검하고, 템플릿 샘플이 있으면 제거

## 7. Data-driven
M1은 유닛 8종(몬스터 6·설치물 1·스킬 1)·스테이지 1개뿐이라 수치를 설정 스크립트 한 곳에 하드코딩한다. 유닛·스테이지가 늘어나는 시점의 UserDataSet/CSV 이전은 로드맵 M2에 배치했다.

## 8. Decisions (this milestone)
| Item | Status |
|---|---|
| 맵 타입 | Decided: MapleTile(0) + `RigidbodyComponent`, `map01` |
| 유닛 컨셉 | Decided: 메이플 몬스터 |
| M1 범위 | Decided: 코어 전투 1스테이지 |
| 입장 재화 | M1 제외. 캠페인 재화와 메이플 코인(대전)은 별개 재화, 둘 다 Worldcoin 판매 → 로드맵 M3 / M5 |
| 덱 | Decided: 최대 10종, 유닛 종류 3가지(몬스터·설치물·스킬). M1은 고정 덱 5종, 편성 화면 → 로드맵 M2 |
| 설치물·스킬의 구체적 동작 | Pending → Phase 2 구현 전 사용자 확인 (현재 잠정: 포탑 / 범위 피해) |
| 구체적 몬스터 6종 | Pending → Phase 1~2에서 리소스 검색 후 결정 |
| 유닛·기지 수치 | 이 마일스톤에서는 잠정값 유지. 밸런스 패스 → 로드맵 |
| 전장 크기 | Decided: 한 화면 전장, 전체 스케일 0.65 (`BattleConfig`의 `UnitScale`·`RangeScale`·`SpeedScale`) |
| 게임 정식 명칭 | Pending → M1 종료 전 |

## 9. Plan changes (revision log)
| When | Type | What changed | Reason | Impact |
|---|---|---|---|---|
| 2026-10-03 | Add | 덱 구조(최대 10종)와 유닛 종류 3가지(몬스터·설치물·스킬). Phase 2에 설치물 1종·스킬 1종 추가, 소환 HUD를 덱 HUD(10칸 기준)로 변경 | 사용자가 코어 규칙으로 제시 | 착수 전이라 상태 영향 없음. 덱 편성 화면은 로드맵 M2 |
| 2026-10-03 | Modify | 유닛 간 피해를 Attack/Hit 충돌 파이프라인 대신 Director 유닛 목록 기반 직접 적용으로, 애니메이션을 Pattern A(SpriteRUID 직접 교체)로 변경 | 플레이어가 전투에 없고 한 줄 전장이라 거리 판정만으로 충분, 구현·검증이 단순 | Phase 1 구현에 이미 반영. 데미지 숫자 표시가 필요해지면 Phase 3 이펙트 작업에서 별도 처리 |
| 2026-10-03 | Modify | 유닛 로스터 규칙: 공격 클립이 있는 몬스터만 사용(메토체스 클립 포함). 적 근접 유닛을 좀비버섯 → 슬라임(메토체스 클립)으로 교체, 코드 모션 제거 | 사용자 결정 — 몬스터마다 코드가 갈라지는 구조와 서버에서 연출을 돌리는 방식을 피함 | Phase 1의 적 유닛 항목 재구현·로그 재검증 완료(🟡 유지, 화면 확인 대기) |
| 2026-10-03 | Remove | Phase 3의 "HUD 터치 크기 점검" 항목을 로드맵 M4(모바일 오픈)로 이동 | 사용자 결정 — PC 개발 중에는 모바일 점검을 병행하지 않음. 터치 크기 기준만 설계 규칙으로 유지 | 미착수 항목이라 코드 영향 없음 |
| 2026-10-03 | Modify | 전장을 한 화면 크기로 축소하고 전체 스케일 0.65 적용. 타워 위치는 맵 엔티티에서 읽고 카메라는 가운데 고정 | 사용자 요청 — 사물이 커 보이고 맵 전체가 한 화면에 들어와야 함 | Phase 1의 전장·지휘관(카메라 스크롤) 항목이 이 구성으로 대체됨(🟡 유지, 화면 확인 대기) |
| 2026-10-03 | Remove | Phase 3의 "밸런스 패스" 항목을 로드맵으로 이동 | 사용자 결정 — 콘텐츠와 시스템이 자리 잡은 뒤에 밸런스를 잡는다 | 미착수 항목이라 코드 영향 없음. 현재 수치는 테스트용 잠정값 |
