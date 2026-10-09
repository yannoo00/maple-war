# 메이플 워 (가칭) — 횡스크롤 라인 대전 기획서 (GDD, M3)

> 🔖 **AI note — resuming?** If you're reading this in a new session to continue/resume this game, load the `msw-planning` skill FIRST and follow its resume flow (read `MapleWar-Roadmap.md` + `Archive/As-built.md` → reconstruct state → reconcile) — don't edit or implement straight from this doc. **Before touching any `⬜/🟡/✅` state or running a completion, Read the skill's `references/build-management.md` IN FULL.** (스킬이 없는 PC에서는 `Archive/As-built.md`의 "로컬 워크스페이스" 규칙을 따른다.)
> Last updated: 2026-10-09 / Stage: Phase 4 (전투 기본기) 진행 중 — Phase 1·2 done, Phase 3은 출시 환경의 실제 결제 확인만 남음, Phase 5 (기지 시스템) 구현함·테스트 대기(전부 🟡, Maker 미연결로 실행 확인 못 함), Phase 6 (PC로 연다) not started

## 1. One-line concept
> "캠페인에 들어갈 때 입장권을 쓴다. 입장권은 시간이 지나면 차오르고, 모자라면 Worldcoin으로 산다. 이 재화 틀은 이후 대전의 메이플 코인이 그대로 쓴다. PC로 열기 전에 전투의 기본기를 '냥코 대전쟁' 골격에 맞춰 올린다(첫 단계: 공격 타입 4종). 또 기지(베이스캠프)를 고정값이 아닌 고르고 키우는 것으로 바꾼다: 노말~레전더리 기지를 Worldcoin으로 사고, 기지마다 HP·마나·전용 스킬이 다르며, 메소로 영구 강화한다. 여기까지 되면 PC로 연다."

## 2. Key decisions (immutable baseline)
| Item | Decision | Notes |
|---|---|---|
| 재화 이름 | **입장권** (id `ticket`) | 사용자 결정 2026-10-06. 대전의 메이플 코인과 별개 |
| 충전 | 시간 경과 자동 충전 + Worldcoin 구매 | 사용자 결정 2026-10-06. 잠정값: 최대 30, 6분에 1 회복, 신규 유저 시작량 30 |
| 소모 | 스테이지 입장 시 소모, 환불 없음 | 사용자 결정 2026-10-06. 잠정값: 스테이지당 5. 패배·중도 이탈에도 돌려주지 않는다. 결과 화면의 "다시 하기"도 입장이므로 같은 비용을 낸다 |
| 구매분 | 구매로 받은 입장권은 최대치를 넘겨 쌓인다 | 최대치 이상이면 자동 충전만 멈춘다 |
| 상품 등록 | 상품 구성·가격을 사용자에게 확인받은 뒤 AI가 MCP로 월드 상품을 등록. 판매 시작(공개)은 따로 확인 | 사용자 결정 2026-10-06. 미출시 월드에서는 실제 판매가 되지 않는다 |
| 서버 권한 | 잔량·소모·충전·지급은 전부 서버가 계산하고 저장. 클라이언트는 표시만 | M2 플레이어 데이터 원칙과 동일 |
| 시간 기준 | 자동 충전은 서버의 UTC 시각으로 계산(접속하지 않은 동안에도 차오름) | 클라이언트 시계는 쓰지 않는다 |
| 전투 골격 | 큰 골격은 **'냥코 대전쟁'**을 따른다 | 사용자 결정 2026-10-07. 기본 구조가 갖춰졌으므로 PC 오픈 전에 전투 기본기를 올린다 |
| 공격 타입 | 몬스터·설치물마다 **근거리 / 원거리 / 근거리 범위 / 원거리 범위** 4종 중 하나 (`UnitTable.AttackType` = `melee` / `ranged` / `melee_area` / `ranged_area`) | 사용자 결정 2026-10-07. "범위 공격" = 겹쳐 있는 적 모두에게 피해. 현재 유닛은 전부 근거리 또는 원거리(범위 공격 유닛 없음) |
| 피격 연출 | 유닛별 피격 이펙트는 쓰지 않는다. **모든 유닛 공용으로 아주 짧은 흰색 점멸** | 사용자 결정 2026-10-07. 기존 공용 피격 이펙트 클립은 제거 |
| 공격 연출 | 유닛마다 공격 이펙트(공격할 때 자기 몸에 재생)와 효과음(공격 / 피격 / 사망)을 표에 둔다 | 사용자 결정 2026-10-07. 리소스 팩 목록(`action` → `ruid`)을 받아 반영 |
| 속성 | 몬스터마다 속성 하나: **땅 / 물 / 화염 / 바람 / 빛 / 어둠** 6가지뿐 | 사용자 결정 2026-10-07 |
| 효과 | 냥코 대전쟁의 메즈처럼, 몬스터의 공격으로 피해를 받은 유닛에게 그 몬스터의 '효과'가 확률로 걸린다. 확률은 **속성별 확률표**에서 온다 | 사용자 결정 2026-10-07. **몬스터에만 해당** — 설치물·스킬용 기획은 사용자가 따로 전달 |
| 넉백 | 몬스터는 체력이 **일정 % 이하**로 줄면 뒤로 조금 밀리면서 피격 모션을 재생한다. 그 %는 몬스터마다 다르다 | 사용자 결정 2026-10-07. 피격 모션 열 추가 |
| 레벨업 | 유닛 **카드를 모아서** 레벨업(클래시 로얄식). 레벨마다 필요한 카드 수는 표(`UnitLevelTable.CardsNeeded`: 2 / 4 / 10 / 20 / 50 / 100 / 200 / 400 / 800), 메소 비용은 기존 표 값을 함께 받는다(0으로 두면 카드만) | 사용자 결정 2026-10-07. 카드는 스테이지 승리 보상(`StageTable.RewardCards`: 3~8장, 보유 유닛에 무작위)으로 얻는다 — 보상 방식은 AI 잠정안 |
| 몬스터 화면 | 로비에 '몬스터' 화면: 보유 유닛을 타일로(초상화, 코스트, 레벨, 등급 테두리, 다음 레벨까지 카드 `n/필요`) | 사용자 결정 2026-10-07 |
| 기지(베이스캠프) | 기지는 **종류가 있는 것**이다(노말 / 레어 / 에픽 / 유니크 / 레전더리). 플레이어는 보유한 기지 중 하나를 덱의 기지 칸에 넣어 전투에 들어간다. 기지마다 **최대 HP, 마나(코스트) 시작·최대·회복, 전용 스킬**이 다르다 | 사용자 결정 2026-10-09. 기획서 "베이스 캠프" 절. 몬스터 소환과 마나 생산은 기지의 역할 |
| 표시 용어 | 게임 화면과 운영툴에 보이는 이름은 **'마나'**다(소환 마나, 마나 최대치, 마나 적응 강화). 코드 식별자(`Cost`, `CostMax`, `CostLevel*` 등)와 CSV 열 이름은 그대로 둔다 | 사용자 결정 2026-10-09. 문서 본문의 "코스트"는 같은 것을 가리킨다 |
| 기지 카드 | **기지는 카드 목록에 카드처럼 나오고, 덱에서 고른다.** 덱 = 몬스터·설치물·스킬 최대 10장 + **기지 1칸(별도)**. 기지 칸은 10장 한도에 포함되지 않고 손패에도 들어오지 않는다. 기지가 없으면 전투를 시작할 수 없다(기본 기지는 항상 보유) | 사용자 결정 2026-10-09. 선택한 기지 = 덱의 기지 칸 |
| 기지 획득 | 기지는 **Worldcoin으로만** 산다(월드 상품). 기본 기지는 처음부터 지급. 기본 기지도 업그레이드를 끝까지 하면 가장 좋은 성능이 나오게 한다 | 사용자 결정 2026-10-09. 메소로는 살 수 없음 |
| 기지 영구 강화 | 아웃게임에서 기지를 영구 강화한다: 최대 HP 증가, 인게임 '마나 적응 강화' 비용 감소, **마나 적응(마나 레벨)을 올릴 수 있는 한도 증가** | 사용자 결정 2026-10-09. 강화 재화·레벨 수는 잠정(§8) |
| 마나 레벨 한도 | 전투 중 올릴 수 있는 마나 적응 레벨의 한도는 **플레이어가 아니라 기지마다** 다르다: 기지의 시작 한도(`ManaLevelStart`) + 기지 강화 레벨이 더해 주는 증가분(`BaseLevelTable.ManaLevelBonus`). **상점에서 메소로 한도를 사던 기능은 없앴다** | 사용자 결정 2026-10-09 (중요 수정) |
| 기지 스킬 | **능동 스킬** = 마나 0짜리 기존 스킬 카드 한 장과 같다: 모델·데이터는 기존 스킬(`UnitTable` 스킬 행)을 그대로 쓰고, 기지가 쿨타임을 들고 있다가 쿨타임이 끝나면 쓸 수 있다. **패시브 스킬** = 지속 시간이 무제한인 스킬을 계속 발동하고 있는 것과 같다 | 사용자 결정 2026-10-09 |
| 적 기지 | 적 기지의 종류는 **스테이지가 지정**한다(`StageTable.EnemyBase`). cave 맵의 적 기지(발록 기지)는 스킬을 쓴다 | 사용자 결정 2026-10-09 |
| 기지 종류 수(이번 범위) | 기본 기지 1 + 샘플 2~3종. 나머지는 운영툴로 데이터만 추가 | 사용자 결정 2026-10-09 |
| 원칙 | 밸런스·모바일 점검은 이 마일스톤에서 하지 않음. 연출은 클라이언트만 | `Archive/As-built.md` Standing rules |

## 3. Core loop (one session)
접속 → 로비(입장권 잔량과 다음 충전까지 남은 시간 표시) → 스테이지 선택(카드에 입장 비용 표시, 모자라면 입장 불가와 구매 안내) → 입장 시 입장권 차감 → 전투 → 결과 → 로비. 입장권이 모자라면: 기다리거나 입장권 상점에서 Worldcoin으로 구매.

## 4. Core systems
**재화 공통 틀 (지갑)**
- 재화 정의는 표(`CurrencyTable`): 재화 id, 이름, 최대치, 1 회복에 걸리는 초, 신규 시작량. 메이플 코인은 M5에서 이 표에 한 줄을 더해 쓴다.
- 플레이어 데이터에 지갑을 둔다: 재화마다 `(수량, 기준 시각)`. 기준 시각부터 지난 시간만큼 회복분을 계산해 더하고 기준 시각을 그만큼 앞으로 옮긴다(접속 중에는 1초마다, 로드할 때 한 번).
- 자동 충전은 저장을 일으키지 않는다(저장된 `(수량, 기준 시각)`에서 언제든 다시 계산되므로). 저장은 소모·구매 때만.
- 본인 클라이언트에는 수량과 "다음 1 회복 시각"을 동기화한다.

**입장 소모**
- 스테이지 표에 `EntryCost` 열. 로비 서버가 입장 요청을 받으면 해금 → 잔량 순으로 검증하고, 차감 → **저장 완료를 기다린 뒤** → 전투 룸으로 이동시킨다(전투 룸이 저장소에서 데이터를 다시 읽기 때문).
- 저장이나 룸 생성이 실패하면 차감을 되돌리고 입장을 취소한다.
- 전투 결과 화면의 "다시 하기"는 전투 룸에서 같은 비용을 차감한다. 모자라면 버튼이 비활성.

**Worldcoin 구매**
- 상품 표(`ShopProductTable`): 월드 상품 ID, 지급 재화, 지급 수량, 표시 이름.
- 클라이언트는 `_WorldShopService:PromptPurchase(상품 ID)`로 구매 창을 띄운다. 결제가 끝나면 서버의 지급 콜백(`SetProcessPurchaseCallback`)이 상품 표를 보고 지갑에 지급·저장한다.
- 같은 구매가 두 번 지급되지 않도록 최근 처리한 구매 ID를 플레이어 데이터에 남긴다. 지급 기록은 `_LogStorageService:LogPurchaseInfo`.
- 지급할 수 없는 상태(플레이어 데이터 미로드 등)면 콜백이 false를 돌려주고, 플랫폼이 다음 접속 때 다시 지급을 시도한다.

**공격 타입 (전투 기본기)**
- 단일 공격(`melee`, `ranged`): 공격을 시작할 때 잡은 대상 하나에게, 타격 시점에 피해를 준다(기존 동작).
- 범위 공격(`melee_area`, `ranged_area`): 타격 시점에 사거리 안에 있는 적 전부(몬스터·설치물·기지)에게 같은 피해를 준다. 전선에 겹쳐 선 적이 한 번에 맞는다.
- 근거리와 원거리의 차이는 사거리와 투사체 연출이다(표의 `Range`, `ProjectileRuid`). 타입 칸이 비어 있으면 투사체가 있으면 원거리, 없으면 근거리로 본다.

**공격·피격 연출 (전투 기본기)**
- 공격 시작: 공격자 몸에 공격 이펙트(`AttackEffectRuid`)를 붙여 재생하고 공격음(`AttackSoundRuid`)을 낸다. 투사체가 있으면 함께 날아간다. 모든 유닛의 공격을 클라이언트에 알린다(`NotifyAttack`).
- 피격: HP가 줄어든 유닛은 0.08초 동안 흰색으로 점멸한다(모든 유닛 공용). 피격음(`DamageSoundRuid`)이 있으면 그것을, 없으면 공용 타격음을 낸다.
- 사망: 사망음(`DieSoundRuid`)이 있으면 낸다.
- 같은 효과음은 0.08초 안에 다시 시작하지 않는다(여럿이 동시에 움직여도 겹쳐 쌓이지 않게).

**속성·효과·넉백 (기획 — 아직 구현 전)**
- 속성: 몬스터마다 6속성 중 하나(`UnitTable.Attribute` = `earth` / `water` / `fire` / `wind` / `light` / `dark`). 설치물·스킬·기지는 빈칸.
- 효과: 몬스터마다 '효과'를 가진다(`UnitTable.Effect`, 없으면 빈칸). 그 몬스터의 공격으로 **피해를 받은 유닛마다** 확률 판정을 해서 걸리면 효과가 적용된다. 범위 공격이면 맞은 유닛 각각 판정한다. 확률은 **효과 × 맞은 유닛의 속성** 확률표(`EffectChanceTable`)에서 읽는다(AI의 해석 — 아래 미정 사항 1).
- 넉백: 몬스터의 HP가 `KnockbackHpPercent`(몬스터마다 다름) 이하로 떨어지는 순간, 뒤로 조금 밀리면서 피격 모션(`HitRuid`)을 재생하고 그동안 행동을 멈춘다.
- 넉백은 몬스터끼리만 해당한다. 효과는 **몬스터와 설치물이 걸 수 있고**(2026-10-07 사용자 결정), 받는 쪽은 속성이 있는 몬스터뿐이다. 스킬은 효과를 걸지도 받지도 않는다.
- **효과 표는 기본값, 유닛이 덮어쓴다**(2026-10-07 사용자 결정): `EffectTable`의 지속 시간·세기·속성별 확률은 기본값이고, 효과를 쓰는 유닛이 `UnitTable`의 `EffectDuration` / `EffectPower` / `EffectChance{Earth,Water,Fire,Wind,Light,Dark}` 칸에 값을 적으면 그 유닛에게만 그 값을 쓴다. 빈칸 = 효과 표의 값. 확률 칸에 0을 적으면 그 속성에는 걸리지 않는다.
- 사용자 결정(2026-10-07):
  1. 확률표의 축은 **효과 × 맞은 유닛의 속성**. 효과 표(`EffectTable`) 한 줄이 효과 하나이고, 그 줄에 지속 시간·세기와 속성 6개의 확률(%)이 있다.
  2. 몬스터는 효과를 **하나만** 가진다. 지속 시간은 효과마다 다르다. 사용자가 든 예: 공격 무효(대상 적의 피해를 일정 시간 받지 않음), 저주(대상 적의 효과를 일정 시간 무효화), 워프(적을 워프시킴), 날려버린다(적을 멀리 날림) — 예시이며 목록은 늘어난다.
  3. 넉백은 **체력 구간마다** 일어난다(잃은 체력이 `KnockbackHpPercent`의 배수를 넘을 때마다 1회, 한 번의 피해로 여러 구간을 넘어도 1회). 밀리는 거리·시간은 유닛마다 설정할 수 있게 하되 지금은 전부 같은 값(`BattleConfig`의 기본값 0.8 / 0.35초, 구간 34%).
  4. 속성 상성: 기본 공격(평타)만 유리한 상대에게 +20%(`BattleConfig.AttributeBonus`). 빛 ↔ 어둠은 서로, 바람 → 물 → 화염 → 땅 → 바람은 화살표 방향. 반대 방향 감소 없음, 스킬·독 피해에는 없음.
- 효과 동작(`EffectTable.Type`, AI가 정한 잠정 해석 — 사용자 확인 필요):
  - `nullify` 공격 무효: 효과에 걸린 유닛의 공격은 지속 시간 동안 **효과를 건 몬스터에게** 피해를 주지 못한다.
  - `curse` 저주: 걸린 유닛은 지속 시간 동안 자기 효과를 걸지 못한다.
  - `reflect` 가시(특성, 자신에게 `always`): 자신에게 피해를 입힌 적 **몬스터**에게 자신이 입은 피해(보정 후)의 `Power`%를 돌려준다. 스킬·독 피해에는 반응하지 않고, 돌려주는 피해는 공격자 효과·속성 보너스가 없어 가시끼리 주고받지 않는다.
  - `warp` 워프: 걸린 유닛이 자기 기지 쪽으로 `Power`만큼 즉시 옮겨지고 지속 시간 동안 멈춘다.
  - `blow` 날려버린다: 걸린 유닛이 지속 시간에 걸쳐 `Power`만큼 뒤로 밀린다(피격 모션).
  - `ignore` 무시(특성, 자신에게 `always`): 다른 유닛·스킬이 거는 효과를 하나도 받지 않는다(버프·디버프·워프·날려버린다 모두). 자신의 다른 특성은 그대로 적용되고, 피해·회복·체력 구간 넉백은 효과가 아니라서 그대로 받는다.
- 배정(AI 임의, 2026-10-07 — 전부 잠정): 땅 = 주황버섯·스톤골렘·머쉬맘·돌의 정령·초록버섯·타우로마시스 / 물 = 슬라임·예티·다크예티·월묘 / 화염 = 셀리온·주니어 발록·타우로스피어·불독 / 바람 = 스타픽시·하프·그루핀·헥터·화이트팽 / 빛 = 라이오너·삼미호·원공·루팡 / 어둠 = 스켈레톤·좀비루팡·라이칸·주니어 부기. 효과: 날려버린다 = 스톤골렘·머쉬맘·주니어 발록·타우로마시스, 저주 = 스켈레톤·좀비루팡·삼미호, 워프 = 스타픽시·원공·하프, 공격 무효 = 월묘·라이칸·화이트팽. 나머지는 효과 없음. 확률은 효과마다 속성별 5~30%.
- 아이콘: 걸린 유닛의 HP 바 위에 효과별 픽셀 글리프를 띄운다(여러 개면 가로로 나란히). 표시 시간은 효과 지속 시간, 최소 1초.
- 남은 미정 사항: 기지는 효과·넉백 대상이 아님(잠정).

**기지 (기획 — 아직 구현 전, Phase 5)**
- 기지 정의는 `UnitTable`의 `Kind = base` 행이다(카드 목록·등급 테두리·정렬·운영툴을 그대로 쓰기 위해 별도 표를 만들지 않았다): 이름, 등급, 최대 HP(`MaxHp`), 카드 그림(`IconRuid`), 시작 마나(`ManaStart`)·마나 최대 배율(`ManaMaxRate`)·마나 회복 배율(`ManaRegenRate`), 기지 스킬(`BaseSkill` = 스킬 행의 id, `BaseSkillType` = active / passive, `BaseSkillCooldown`), 월드 상품(`ProductId`), 적 전용(`EnemyOnly`). 마나 최대·회복은 마나 레벨 표(`CostLevelTable`) 값에 배율을 곱한다. 영구 강화는 `BaseLevelTable`: 레벨, `HpRate`(최대 HP 배율), `ManaUpgradeDiscount`(마나 적응 강화 비용 감소 비율), `ManaLevelBonus`(그 레벨까지 쌓인 마나 레벨 한도 증가분), `UpgradeCost`(메소). 마나 레벨 한도 = `ManaLevelStart`(기지 행) + `ManaLevelBonus`(기지 강화 레벨 행), 마나 레벨 표 길이까지.
- 플레이어 데이터: 보유 기지는 보유 유닛 목록(`UnitsCsv`)에 다른 유닛과 같이 `id:강화 레벨`로 들어가고(카드 레벨업과 달리 메소만 쓰는 `UpgradeBase`), 덱의 기지 칸은 `SelectedBase`로 저장한다. 기본 기지는 기존 계정을 포함해 첫 로드에서 지급한다. 기지 교체는 **로비에서만** 한다(전투 중 교체 없음, 잠정).
- 전투 시작: 플레이어 팀은 선택한 기지의 능력(강화 반영)으로, 적 팀은 스테이지가 지정한 기지로 시작한다. 마나 레벨 한도도 그 기지에서 온다(플레이어 데이터에는 한도가 없다). 지금의 "전역 `CostStart`·`CostPerSecond`, 스테이지 `BaseHp`"는 기지 값으로 대체된다. 마나 적응 강화의 비용은 기지의 강화 레벨만큼 줄어든다.
- 능동 스킬: 진영(`BattleSide`)이 쿨타임을 보유하고, 끝나면 사용 가능. 사용 효과는 기존 스킬 카드 실행 경로(`PlayUnit`)를 그대로 쓴다(마나 비용 0). 플레이어는 전투 HUD 우측 하단의 기지 스킬 버튼을 눌러 조준하고(스킬 카드와 같은 방식, 미리보기 박스 포함), 적 기지는 쿨타임이 끝나면 자동으로 가장 가까운 아군(플레이어 쪽) 유닛에게 쓴다.
- 패시브 스킬(잠정 구현): 현재 스킬은 범위 피해뿐이라, 쿨타임이 끝날 때마다 자동으로 가장 가까운 적에게 발동하는 것으로 구현했다. '지속 시간 무제한 효과'가 필요한 패시브는 §8의 미정 사항.
- 구매: 기지마다 월드 상품을 등록(상품 구성·가격은 사용자 확인 후, 입장권과 같은 절차)하고 `UnitTable.ProductId`에 적는다. `CurrencyShop`의 지급 콜백은 구매 상품 id가 `ShopProductTable`에 없으면 기지의 `ProductId`에서 찾아 기지를 지급한다(`GrantBasePurchase`). 같은 구매의 중복 지급 방지는 입장권과 같다. 카드 정보 창의 [구매] 버튼이 구매 창을 연다.
- 덱 화면의 카드 목록: 기지도 몬스터·설치물·스킬과 같은 타일로 나온다(등급 테두리, HP·마나·스킬 요약, 보유/미보유 음영, 종류 표시 '기지'). 타일의 메뉴에서 [사용(덱의 기지 칸에 넣기) / 정보 / 강화 / 구매]를 고르고, 덱 목록 맨 위에 기지 칸이 따로 보인다. 카드 목록의 정렬(등급순·마나순)과 운영툴의 표·사이드바 목록에도 기지가 같이 나온다.
- 대전(M5)에서는 상대 플레이어가 선택한 기지가 적 팀 기지가 된다(같은 구조를 재사용).

**UI**
- 로비 상단: 메소 옆에 입장권 잔량(`입장권 25 / 30 · 다음 +1 04:32`)과 구매 버튼.
- 스테이지 카드: 입장 비용 표시. 입장 버튼은 입장권이 모자라면 비활성 + 안내 문구.
- 입장권 상점 화면: 상품 목록(이름, 수량, 구매 버튼).
- 전투 결과 화면: "다시 하기" 버튼에 비용 표시.

## 5. System ↔ MSW mapping
| Game system | MSW implementation |
|---|---|
| 재화 정의 | UserDataSet `CurrencyTable`, `BattleConfig:GetCurrency(id)` |
| 지갑 | `PlayerData`의 지갑 부분(`WalletCsv` `@TargetUserSync`, 저장 JSON의 `wallet`) — `SpendCurrency` / `AddCurrency` / `TickWallet` |
| 시각 | 서버 `DateTime.UtcNow.Elapsed`(ms) → 초. 클라이언트 남은 시간 표시는 `_UtilLogic.ServerElapsedSeconds` 기준 시각을 동기화 |
| 입장 소모 | `Commander.RequestEnterBattle`(로비), `Commander.RequestRestart`(전투 룸), `StageTable.EntryCost` |
| 상품 정의 | UserDataSet `ShopProductTable`, `BattleConfig:GetShopProducts()` |
| 구매 처리 | @Logic `CurrencyShop`(서버 `OnBeginPlay`에서 `_WorldShopService:SetProcessPurchaseCallback`), 월드 상품은 `msw-mcp` `world_item_*`로 등록 |
| UI | `ui/LobbyUI.ui` + `UI/LobbyUI.mlua`(잔량, 스테이지 비용, 입장권 상점 화면), `ui/BattleHUD.ui` + `UI/BattleHUD.mlua`(다시 하기 비용) |
| 공격 타입 | `UnitTable.AttackType` → `BattleConfig`(unit.attackType) → `BattleUnit`(타격 시점에 단일/범위 분기), 범위 대상 탐색은 `BattleDirector:FindTargetsInRange` |
| 기지 정의·강화 | `UnitTable`의 `Kind = base` 행, UserDataSet `BaseLevelTable`, `BattleConfig:GetBaseAtLevel(id, level)` · `GetBaseLevel(level)` · `GetStarterBaseIds` · `GetBaseByProduct` |
| 기지 보유·덱의 기지 칸 | `PlayerData`의 `UnitsCsv`(보유 기지 = `id:강화 레벨`)·`SelectedBase`(덱의 기지 칸, 저장 JSON `base`), 서버 메서드 `GrantBase` / `SelectBase` / `UpgradeBase` / `GrantBasePurchase`, 클라이언트 요청 `RequestSelectBase` / `RequestUpgradeBase` |
| 전투 적용 | `BattleDirector:StartBattle`(팀별 기지 설정), `BattleSide:Reset`·`UpgradeCostLevel`(기지의 마나 값·강화 비용 할인, 동기화 `UpgradeCost`), `StageTable.EnemyBase` |
| 기지 스킬 | `BattleSide`(`BaseSkillId` / `BaseSkillType` / `BaseSkillReadyAt` 동기화), `BattleDirector:UseBaseSkill`·`TickBaseSkill`·`CastBaseSkill`(스킬 카드 실행 경로 `PlayUnit` 공유)·`NotifySkillCast`(Multicast 효과), `Commander:SelectBaseSkill`·`RequestUseBaseSkill`, `FieldFx` 미리보기, `BattleHUD:UpdateBaseSkillButton` |
| 기지 구매 | `UnitTable.ProductId` + `CurrencyShop` 지급 콜백 확장(표 변경 없음) |
| 기지 UI | `LobbyUI`(`GetOwnableUnits`에 기지 포함, 타일·정보 창·덱의 첫 줄 기지 칸), `BattleHUD`(`BaseSkill` 버튼) — UIBuilder로 작업 |
| 출시 설정 | 사용자 작업: 월드 출시 설정에서 최대 인원, 플레이 가능 기기 = PC |

## 6. Roadmap (Phases)
States: ⬜ not started · 🟡 implemented (untested) · ✅ tested.

### Phase 1 — "입장권이 있고 시간이 지나면 찬다" (done)
> 2026-10-06 플레이 로그와 화면으로 확인. 기존 테스트 계정은 첫 로드에서 30장을 받고 저장했다. 수량을 3으로, 기준 시각을 725초 전으로 강제하자 다음 틱에 +2(5장)가 되었고 클라이언트 남은 시간은 346.7초로 계산되었다. 클라이언트의 `_UtilLogic.ServerElapsedSeconds`는 서버 값과 0.6초 차이로 동기화된다.
- ✅ `CurrencyTable` 데이터셋과 `BattleConfig` 읽기(`GetCurrencies`, `GetCurrency`)
- ✅ 지갑: 로드·회복 계산·저장, 신규 유저 시작량 지급, 기존 계정에는 첫 로드 때 시작량 지급
- ✅ 접속 중 1초 단위 회복과 본인 클라이언트 동기화(`WalletCsv`)
- ✅ 로비 상단에 잔량과 다음 충전까지 남은 시간 표시(`입장권 0 / 30 · +1 04:37`, 가득 차면 시간 없음, 구매분은 `40 / 30`)

### Phase 2 — "입장할 때 입장권을 쓴다" (done)
> 2026-10-06 구현, 로직은 로그·화면으로 확인. 2026-10-07 사용자가 버튼 클릭 테스트 완료를 알려 옴("상품 구매 테스트까지 완료").
- ✅ `StageTable.EntryCost`, 로비 입장 시 서버 검증·차감·저장 후 이동, 실패 시 되돌림 (입장 버튼 클릭은 사용자 테스트 완료 2026-10-07. 로그 확인: 입장 요청 2번을 연달아 보내도 1회만 차감 30 → 25, 저장 후 이동, 전투 룸이 25장으로 로드. 룸 이동 실패 시 되돌림은 2026-10-07 확인 — 전투 맵에서 바로 시작한 테스트 플레이에서 입장을 요청하자 `enter refused: battle room failed, entry cost returned`. 저장 실패 분기만은 재현할 방법이 없어 실행해 보지 못했다)
- ✅ 서버가 입장을 거부하면 로딩 화면을 바로 내림 (입장권 0장에서 서버에 직접 요청: 서버 `enter refused: not enough ticket (needs 5, has 0)` → 클라이언트 로딩 표시 후 같은 초에 숨김)
- ✅ 스테이지 카드에 비용 표시, 모자라면 입장 버튼 비활성과 안내 (사용자 테스트 2026-10-07. 화면 확인: 카드마다 `입장권 5`, 충분하면 `입장 (입장권 5)`, 0장이면 `입장권 부족` 비활성)
- ✅ 결과 화면 "다시 하기"에 비용 적용과 표시 (사용자 테스트 2026-10-07. 로그 확인: 3장이면 비활성, 5장이면 활성, 다시 하기로 5 → 0 차감 후 전투 재시작. 화면 확인: 버튼에 `다시 하기 / 입장권 5` 두 줄이 들어온다)

### Phase 3 — "Worldcoin으로 입장권을 산다"
> 2026-10-06 코드와 화면 구현, 월드 상품 3종을 비공개(`REGISTER`)로 등록. Maker에서는 구매 창이 뜨고 "테스트 구매 시에는 월드코인을 차감하지 않습니다"라고 표시된다.
- 🟡 `ShopProductTable` 데이터셋, 지급 콜백(`CurrencyShop`): 지급·중복 방지·기록  ⚠️ needs user test: 출시 환경의 실제 결제에서 지급되는지, 접속 시 재지급("데이터 로드 대기") 경로 (Maker 테스트 구매는 사용자 테스트 완료 2026-10-07. 로그·화면 확인: 콜백 등록, `GrantPurchase`를 같은 구매 ID로 두 번 호출하면 한 번만 지급 0 → 40)
- ✅ 입장권 상점 화면과 구매 창 호출 (사용자 테스트 2026-10-07. 화면 확인: 상품 3줄에 `월드 코인 50 / 130 / 400`이 월드 상점에서 조회되어 표시되고 "아이템 구입 — 입장권 10장 — 50" 구매 창이 뜬다)
- ✅ 상품 구성·가격 확정(사용자 확인) → 월드 상품 등록 → 상품 ID를 표에 기입 (입장권 10장 `5JGW1T7EY` 50 / 30장 `1SBJQIC89` 130 / 100장 `XVSUGEYAW` 400, 전부 비공개 등록. 썸네일은 코드로 그린 입장권 그림)
- 🟡 구매 흐름 확인(Maker에서 가능한 범위)과 실제 결제 확인(사용자, 출시 환경)  ⚠️ needs user test: 출시 후 실제 결제 (Maker의 테스트 구매는 사용자 테스트 완료 2026-10-07)

### Phase 4 — "전투의 기본기를 올린다 (냥코 대전쟁 골격)"
> 2026-10-07 공격 타입 구현·로그 확인. 빌드 콘솔 오류 없음(정보 수준 9건).
- ✅ 공격 타입 4종: `UnitTable.AttackType` 열과 기존 유닛 분류(근거리 20 / 원거리 10, 스킬·기지는 빈칸), `BattleConfig` 읽기, 타격 시점의 단일/범위 분기(`BattleUnit:ApplyHit`, `BattleDirector:FindTargetsInRange`), 상점 행에 타입 표시 (로그 확인: 소환 로그에 `attackType=melee/ranged`, 상점 행 `몬스터 · 원거리 · 코스트 150`·스킬은 타입 없음. 골렘 1마리를 서버에서 `melee_area`로 바꾸고 슬라임 3마리를 한 지점에 겹쳐 두자 타격 4번 모두 `targets=3`, 슬라임 3마리 HP가 똑같이 70 → 38. 같은 시간 단일 공격인 슬라임 3마리는 골렘에게 150 피해(10 × 15회). 범위 공격 유닛은 아직 표에 없어 화면 연출은 볼 것이 없다)
- 🟡 공격·피격 연출 틀: 유닛별 공격 이펙트·효과음 열(`AttackEffectRuid`, `AttackSoundRuid`, `DamageSoundRuid`, `DieSoundRuid`)과 재생, 공용 피격 이펙트 클립 제거, 흰색 점멸(머티리얼 교체), 첫 적용 = 스타픽시(사용자가 준 "여신 탑의 스타픽시" 팩으로 stand / move / attack1 / die1 / 투사체 / 공격 이펙트 / 효과음 3종 교체)  ⚠️ needs user test: ① **흰색 점멸은 아직 보이지 않는다** — Maker에서 머티리얼 `HitFlash`(셰이더 ColorEffect → ColorOverride, 색 흰색)를 `RootDesk/MyDesk/Materials`에 만들어야 켜진다(속성 이름을 문서에서 얻을 수 없어 AI가 파일로 만들지 못함. `UnitDefault`는 만들어 둠). 만든 뒤 점멸이 0.08초로 적당한지 ② 스타픽시 공격 이펙트의 위치·크기, 바뀐 모습과 공격 타이밍(기존 값 그대로 둠) ③ 효과음 크기 (로그 확인: 스타픽시 공격 시 `attack effect pixie_5 ruid=b93c… serial=1`, 공격음 재생, 투사체 발사·도착, 머쉬맘 HP 260 → 242. 머티리얼 조회 `UnitDefault=material://437e…`, `HitFlash=nil ready=false`)
- ⬜ 나머지 유닛의 리소스 팩 반영: 팩 목록(JSON: `action` → `ruid`)을 받는 대로 표에 넣는다. `hit1`은 넉백 항목의 피격 모션 열로 들어가고, `attack1/info/hit`·`audio/CharDam1`·`jump`는 쓰지 않는다. 공격 타이밍은 목록에 없어 화면을 보고 맞춘다
- 🟡 속성: `UnitTable.Attribute`(6속성) 열, `BattleConfig` 읽기, 상점 행 표시  ⚠️ needs user test: 유닛에 속성을 넣은 뒤 상점 행의 표시(`몬스터 · 근거리 · 화염 · 코스트 …`) — 지금은 모든 유닛의 속성이 빈칸이라 화면에 나오는 곳이 없다 (로그 확인: 서버에서 속성을 넣은 유닛에만 효과 판정이 돌았다)
- 🟡 효과: `UnitTable.Effect` 열, 효과 표 `EffectTable`(종류·시간·세기·속성별 확률), 피해를 받은 몬스터마다 확률 판정과 적용(공격 무효 / 저주 / 워프 / 날려버린다)  ⚠️ needs user test: 네 효과의 동작 해석(§4)이 의도와 맞는지, 워프·날려버리기가 화면에서 어떻게 보이는지 (로그 확인, 서버에서 직접 걸어 봄: 날려버린다 목표 1.30 → 1.30 이동, 워프 즉시 이동 + 자기 기지 앞에서 멈춤 + 1초 정지, 공격 무효 중 공격 → 대상 HP 220 그대로·3초 뒤 해제, 저주 중 40회 판정 → 발동 0, 속성 없는 대상 40회 → 0, 확률 20% 200회 → 37회)
- 🟡 넉백: `UnitTable.HitRuid`(피격 모션)·`KnockbackHpPercent`·`KnockbackDistance`·`KnockbackSeconds` 열, 체력 구간마다 뒤로 밀리며 피격 모션 재생, 그동안 행동 정지  ⚠️ needs user test: 밀리는 모습과 거리·시간이 적당한지, 밀릴 때 방향이 뒤집히지 않는지, 스타픽시의 피격 모션(다른 유닛은 피격 모션이 없어 서 있는 모습으로 밀린다) (로그 확인: 머쉬맘 HP 260, 구간 88.4 — 50 피해에는 넉백 없음, 누적 100에서 1회, 목표 0.52 → 0.52 이동 후 행동 재개)
- 🟡 전투 HUD 쿨타임 표시 교체: 숫자 대신 카드 위 회색 음영이 아래로 빠지며(수직 Filled 스프라이트 `Slot*/Cool`, UIBuilder로 추가) 쿨타임이 끝나면 카드가 한 번 커졌다 돌아오는 강조(0.3초, 18%)  ⚠️ needs user test: 음영 색·진하기, 강조의 크기·속도 (로그 확인: 카드 사용 시 음영 켜짐 → 끝날 때 FillAmount 0 → 음영 꺼짐 → 펄스 타이머가 끝까지 돌고 배율 1.000 복귀. 화면 확인: 사용 직후 카드에 음영, 숫자 없음)
- 🟡 몬스터·설치물 HP 바 제거 (사용자 요청 2026-10-07. 기지 바는 유지. 로그·화면 확인)
- 🟡 뽑기 상자: 유닛 구매 폐지, 모든 유닛은 상자에서(`ChestTable`: 노말/레어/에픽/유니크/레전더리, 상자별 카드 수·등급 확률·보장 등급·메소 가격 — 전부 AI 잠정값). 승리 보상 = 스테이지의 상자(`StageTable.RewardChest`), 상점 = 상자 목록(메소), 상자 결과 화면(카드별 수량·등급·NEW), 몬스터 화면에 미보유 유닛은 회색 음영  ⚠️ needs user test: 상자 결과 화면 닫기 버튼, 미보유 음영의 모습, 승리 후 결과 패널의 상자 카드 줄, 확률·가격·카드 수 (로그·화면 확인: 에픽 상자 2000메소 → 카드 8장, 미보유 2종 해금에 NEW 표시. 결과 화면이 뒤 화면과 겹치던 것과 상점 확률 글 줄바꿈은 고쳤으나 고친 뒤 화면은 미확인. Worldcoin 상자 상품은 아직 없음)
- 🟡 카드 수집형 레벨업과 로비 '몬스터' 화면: 유닛 카드(`PlayerData.CardsCsv`)를 모아 레벨업(`UnitLevelTable.CardsNeeded` + 기존 메소 비용), 승리 보상으로 카드 지급(`StageTable.RewardCards`, 보유 유닛에 무작위 분배), 로비 메인에 '몬스터' 버튼과 클래시 로얄식 타일 화면(초상화·코스트 배지·레벨 띠·등급 테두리·카드 진행도 `n/필요`, 조건이 되면 초록 막대, 타일 클릭 = 레벨업). 상점의 메소 레벨업은 뺐다  ⚠️ needs user test: 타일의 모양·크기·간격, 버튼 클릭, 카드가 모였을 때의 강화 흐름 (화면 확인: 타일 그리드 6열·등급 테두리·초록/파랑 막대. 로그 확인: 주황버섯 카드 3/2로 레벨업 → 카드 1, 메소 450 → 350, 레벨 2 저장. 카드 1/2인 골렘은 거부. 보상 5장이 보유 유닛에 무작위 분배되어 저장)
- 🟡 유닛별 속성·효과 배정(AI 임의 배정, 2026-10-07)과 효과가 걸렸을 때 머리 위 아이콘  ⚠️ needs user test: 배정이 마음에 드는지, 아이콘(8×8 픽셀 글리프: 공격 무효 빨간 X / 저주 보라 마름모 / 워프 하늘색 고리 / 날려버린다 주황 화살표)의 모양·크기·위치, 효과 확률·시간·거리가 적당한지 (화면 확인: 골렘 HP 바 위에 보라 마름모. 로그 확인: 효과가 걸리면 아이콘 생성, 지속 시간이 끝나면 제거, 서버의 `StatusCsv`도 같이 비워짐) — 아이콘 그림은 나중에 리소스 RUID로 바꿀 수 있다

### Phase 5 — "기지를 고르고 키운다"
> 2026-10-09 사용자 기획 전달, 같은 날 구현. **Maker MCP(msw-maker-mcp)가 연결되지 않아 refresh·플레이·로그 확인을 하지 못했다.** 확인한 것: 스크립트 블록 균형(대략), 운영툴 검증(`previewValidate`가 기지 5행·스테이지 통과). 아래 🟡는 전부 "Maker refresh 후 실행 확인 필요".
- 🟡 기지 데이터: `UnitTable`에 `Kind = base` 행 5개(기본 기지 `base`, 샘플 `base_forest` 레어 / `base_mage` 에픽 능동 스킬 번개 / `base_golem` 유니크 패시브 눈보라, 적 전용 `base_balrog` 레전더리 메테오)와 기지 열 8개, 새 데이터셋 `BaseLevelTable`(10레벨), `BattleConfig` 읽기(`GetBaseAtLevel` 등). 전역 `CostStart`·`CostPerSecond`는 기지가 비워 둔 값의 기본값으로 남김  ⚠️ needs user test: Maker refresh에서 새 데이터셋 `BaseLevelTable` 인식(`[BattleConfig] BaseLevelTable loaded rows=10` 로그), `UnitTable` 로드 오류 없음
- 🟡 플레이어 데이터: 보유 기지는 `UnitsCsv`에 `id:강화 레벨`, 덱의 기지 칸 `SelectedBase`(저장 `base`), 기존 계정과 신규 계정에 스타터 기지 지급, 기지 칸 보정(`NormalizeBase`), 기지는 덱 카드·카드 레벨업에서 제외  ⚠️ needs user test: 기존 테스트 계정 로드 후 `[VRF] PlayerData base slot set to base` 와 보유 목록에 `base:1`
- 🟡 전투 적용: 플레이어 기지 = 선택한 기지(HP × 강화 배율), 적 기지 = 스테이지 `EnemyBase`(HP는 스테이지 `BaseHp`), 진영이 기지의 시작 마나·마나 최대/회복 배율·강화 비용 할인·마나 레벨 한도를 사용(전에 있던 플레이어 공통 한도 `PlayerData.CostLevelCap`과 로비 상점의 한도 구매 버튼은 삭제)(`BattleSide.UpgradeCost` 동기화, HUD 가격 표시)  ⚠️ needs user test: 전투 시작 로그 `[VRF] BattleDirector bases player=… enemy=…`, 기지별 마나 차이, HUD 마나 레벨 버튼의 할인된 가격
- 🟡 기지 스킬: 능동(쿨타임 후 HUD 버튼으로 조준, 마나 0, 스킬 카드 실행 경로), 패시브(쿨타임마다 자동 — 잠정 해석), 적 기지(자동), 효과는 `NotifySkillCast`로 모든 클라이언트에 재생  ⚠️ needs user test: 번개·메테오 이펙트 위치, 능동 스킬 조준 미리보기, 쿨타임 시작 시점(전투 시작부터 1회 쿨타임), 적 기지(cave 스테이지) 스킬 발동
- 🟡 기지 구매 지급: `CurrencyShop`이 기지의 `ProductId`로 기지를 지급(`GrantBasePurchase`), 카드 정보 창의 [구매] 버튼이 구매 창을 엶(상품이 있을 때만)  ⚠️ needs user test: 상품 등록 후 Maker 테스트 구매로 지급
- ⬜ 기지 월드 상품 등록: 어떤 기지를 얼마에 팔지 사용자 확인 → AI가 월드 상품 등록(비공개) → `UnitTable.ProductId` 기입 (지금은 모든 기지의 `ProductId`가 빈칸이라 카드에 "준비 중")
- 🟡 덱 화면의 기지 카드: 카드 목록에 기지 타일(기지 Lv·강화 비용·미보유 음영·종류 '기지'), 메뉴 [사용 / 정보], 정보 창(HP·마나·스킬·강화/구매 버튼), 덱 목록 맨 위의 별도 기지 칸(덱 목록 영역·줄 간격 조정으로 11줄이 들어가게 함), 등급순·마나순 정렬에 포함  ⚠️ needs user test: 덱 목록 11줄이 영역에 맞는지, 기지 칸의 메뉴(제거 버튼 비활성), 타일 표시, 정렬
- 🟡 기지 영구 강화: 메소로 강화(`BaseLevelTable`: 최대 HP↑·마나 적응 강화 비용↓·마나 레벨 한도↑), 정보 창의 [강화] 버튼과 한도 표시(`마나 적응 한도 Lv N (강화 시 Lv M)`)  ⚠️ needs user test: 강화 후 전투에서 HP·할인·마나 레벨 한도 적용, 기지마다 한도가 다른지
- 🟡 전투 HUD 기지 스킬 버튼: 우하단 `BaseSkill` 버튼(스킬 이름·남은 초·사용 가능, 패시브는 이름만, 스킬 없는 기지는 숨김)  ⚠️ needs user test: 위치·크기·글자, 쿨타임 표시
- 🟡 기지 콘텐츠: 위 샘플 기지 4종 + `cave_1`~`cave_5` 스테이지의 적 기지 = 발록 기지(메테오)  ⚠️ needs user test: 능력치·스킬·쿨타임 수치는 전부 AI 잠정값. 샘플 기지는 모두 같은 타워 그림을 쓴다(기지별 외형은 `StandRuid`·모델 작업이 따로 필요)
- 🟡 운영툴: 유닛 편집에 '기지' 종류(기지 칸 그룹)·탭·목록 표시, 스테이지 편집에 '적 기지' 선택, 시간표에 기지가 들어가지 않게 검사  ⚠️ needs user test: 브라우저에서 기지 행 편집·저장, 스테이지의 적 기지 선택

### Phase 6 — "PC로 연다"
- ⬜ 출시 설정: 최대 인원, 플레이 가능 기기 PC (사용자 작업)
- ⬜ 로드맵 Backlog의 "M2 이월 확인" 항목 훑기 (사용자 테스트)
- ⬜ 출시 기준 점검: 신규 유저가 설명 없이 첫 판을 이길 수 있는가 — 스테이지 1 수치 조정이 필요한지 사용자와 결정
- ⬜ 테스트 데이터 정리와 판매 시작(상품 공개) 확인

## 7. Data-driven
| 표 | 열 |
|---|---|
| `CurrencyTable` | `CurrencyId, Name, Max, RegenSeconds, StartAmount, #Memo` |
| `ShopProductTable` | `ProductId, CurrencyId, Amount, Label, #Memo` |
| `StageTable` (추가) | `EntryCost` |
| `UnitTable` (추가) | `AttackType` (`melee` / `ranged` / `melee_area` / `ranged_area`, 스킬·기지는 빈칸), `AttackEffectRuid`, `HitEffectRuid`, `AttackSoundRuid`, `DamageSoundRuid`, `DieSoundRuid` |
| `UnitTable` (추가) | `Attribute`(earth / water / fire / wind / light / dark), `Effect`(EffectTable의 id), `HitRuid`, `KnockbackHpPercent`·`KnockbackDistance`·`KnockbackSeconds`(빈칸 = 공용 기본값) |
| `EffectTable` (기본값) | `EffectId, Type, Name, Duration, Power, ChanceEarth, ChanceWater, ChanceFire, ChanceWind, ChanceLight, ChanceDark, #Memo` |
| `UnitTable` (추가, 기지 행 `Kind = base`) | `ManaStart, ManaMaxRate, ManaRegenRate, ManaLevelStart, BaseSkill, BaseSkillType(active / passive), BaseSkillCooldown, ProductId, EnemyOnly` — 기지 행이 쓰는 칸: `UnitId, Kind, Name, Rarity, Starter, MaxHp, IconRuid, BarY, BarWidth` + 위 9열 + `#Memo` (나머지 전투 칸은 비움) |
| `BaseLevelTable` (신규) | `Level, HpRate, ManaUpgradeDiscount, ManaLevelBonus, UpgradeCost, #Memo` |
| `StageTable` (추가) | `EnemyBase`(`UnitTable`의 기지 id, 빈칸 = 기본 기지 `base`) |
| `UnitTable` (추가) | `EffectDuration`, `EffectPower`, `EffectChanceEarth`~`EffectChanceDark` (효과 표 기본값의 유닛별 덮어쓰기, 빈칸 = 기본값. 몬스터·설치물) |

**몬스터 한 종을 추가할 때 필요한 정보**
| 묶음 | 항목 | 비고 |
|---|---|---|
| 기본 | id(영문), 이름, 등급(normal / rare / epic / unique / legendary), 스타터 지급 여부, 구매 가격(메소) | 적 전용이면 가격 0 |
| 카드 | 소환 코스트, 쿨타임(초) | |
| 전투 수치 | 최대 HP, 공격력, 사거리, 공격 간격(초), 이동 속도, 크기 배율 | 레벨 배율은 공용 표 |
| 공격 타입 | 근거리 / 원거리 / 근거리 범위 / 원거리 범위 | |
| 속성 (예정) | 땅 / 물 / 화염 / 바람 / 빛 / 어둠 중 하나 | |
| 효과 (예정) | 가진 효과(없으면 없음) | 확률·시간·세기는 효과 표 기본값, 유닛이 덮어쓴 값이 있으면 그 값 |
| 넉백 (예정) | 넉백이 일어나는 체력 % | |
| 리소스 팩 | `stand`, `move`, `attack1`, `die1` (필수) / `attack1/info/ball`(원거리의 투사체) / `attack1/info/effect`(공격 이펙트) / `hit1`(피격 모션, 넉백용) / `audio/Attack1`·`Damage`·`Die` | 팩 목록 JSON 그대로 전달하면 된다 |
| 화면을 보고 맞추는 값 | 공격 클립 재생 속도, 공격 자세 유지 시간, 타격 시점(초), 투사체 크기, HP 바 높이·너비 | 팩에 없는 값. AI가 추정값을 넣고 사용자가 화면으로 확인 |
| 등장 | 어느 스테이지의 적으로 나오는지(시간표·반복 풀) | 적으로 쓸 때만 |

## 8. Decisions (this milestone)
| Item | Status |
|---|---|
| 재화 이름 = 입장권, 자동 충전 + 구매, 입장 시 소모·환불 없음, 상품 등록은 AI(확인 후) | Decided (2026-10-06) |
| 수치: 최대 30, 6분에 1, 시작량 30, 스테이지당 5 | Decided(잠정값) — 표에서 수정 |
| "다시 하기"의 비용 | Decided(잠정): 입장과 같은 비용. 사용자가 다르게 정하면 수정 |
| 상품 구성과 Worldcoin 가격 | Decided (2026-10-06, 사용자): 10장 50 / 30장 130 / 100장 400. 비공개로 등록했고 판매 시작(공개)은 Phase 4에서 사용자 확인 후 |
| 스테이지 1 난이도(출시 기준) 조정 여부 | Pending → Phase 5 |
| 전투 골격 = 냥코 대전쟁, 공격 타입 4종 | Decided (2026-10-07, 사용자) |
| 기지 = 종류 있음(노말~레전더리), Worldcoin으로만 구매, 기본 기지 지급, 영구 강화(HP↑·마나 적응 강화 비용↓), 스킬(능동·패시브) = 기존 스킬 데이터 재사용, 적 기지는 스테이지 지정, 이번 범위 기본 1 + 샘플 2~3종, M3 Phase 5로 추가 | Decided (2026-10-09, 사용자) |
| 기지 카드 = 카드 목록에 같은 타일로 나오고 덱의 별도 1칸(10장 한도 밖·손패 밖)에서 선택, 표시 용어 코스트 → 마나(식별자 유지) | Decided (2026-10-09, 사용자) |
| 기지 강화 재화와 레벨 수·곡선 | Pending(잠정, AI 제안): 재화 = 메소, 최대 10레벨. 사용자가 다르게 정하면 수정 |
| 적 기지의 HP | Pending(잠정, AI 제안): 스테이지 `BaseHp` 유지(스테이지 난이도 조절 수단), 기지 종류의 HP는 플레이어 기지에만 적용. 적 기지도 종류별 HP를 쓰고 싶으면 알려 줄 것 |
| 기지 교체 시점 | Decided(잠정): 로비에서만. 전투 중에는 바꾸지 않음 |
| 패시브 스킬이 쓰는 효과 | Pending: 지금은 "쿨타임마다 자동으로 가까운 적에게 스킬 발동"으로 구현(잠정). 지속 시간 무제한 효과가 필요하면 효과 목록과 함께 정함 |
| 범위 공격의 판정 범위 | Decided(잠정, AI 제안): 타격 시점에 공격자 사거리 안의 적 전부(기지 포함). 범위 공격 유닛을 실제로 넣을 때 사용자가 다르게 정하면 수정 |

## 9. Plan changes (revision log)
| When | Type | What changed | Reason | Impact |
|---|---|---|---|---|
| 2026-10-06 | Add | 입장권 상점 행에 월드 상점에 등록된 가격을 조회해 표시(`LobbyUI:LoadTicketPrices`, `_WorldShopService:GetProductAndWait`) | 가격을 표에 중복해서 적지 않기 위해 | 화면을 연 뒤 한 번 조회하고 다시 그린다. 조회 전에는 가격 없이 표시 |
| 2026-10-07 | Add | 새 Phase 4 "전투의 기본기를 올린다(냥코 대전쟁 골격)"를 PC 오픈 앞에 넣고, 기존 Phase 4 "PC로 연다"는 Phase 5로 번호만 바꿈. 첫 항목: 공격 타입 4종 | 사용자 요청 — 기본 구조가 갖춰졌으니 퀄리티업, 큰 골격은 냥코 대전쟁 | 옮긴 Phase의 항목은 전부 ⬜라 상태 변화 없음. §1·§2·§4·§5·§7·§8과 로드맵의 M3 줄에 반영. 퀄리티업 항목이 더 나오면 Phase 4에 추가한다 |
| 2026-10-07 | Modify | 피격 연출을 공용 피격 이펙트 클립에서 흰색 점멸로 교체. 유닛별 공격 이펙트·효과음 열 추가, 모든 유닛의 공격을 클라이언트에 알림(전에는 투사체 유닛만) | 사용자 요청 | `BattleConfig.HitEffectRuid`·`HitEffectScale` 삭제. 흰색 점멸은 머티리얼 `HitFlash`가 있어야 보인다(사용자가 Maker에서 생성) |
| 2026-10-07 | Add | Phase 4에 속성 / 효과 / 넉백 / 나머지 유닛 리소스 반영 항목 추가(전부 ⬜) | 사용자 기획 전달 | 효과·넉백은 §4의 미정 사항이 정해진 뒤 시작. 설치물·스킬용 기획은 사용자가 따로 전달 예정 |
| 2026-10-07 | Modify | 레벨업을 메소 구매에서 카드 수집으로 교체(메소 비용은 함께 유지), 승리 보상에 카드 추가, 로비에 '몬스터' 타일 화면 추가, 상점의 레벨업 버튼 제거. 전투 HUD 쿨타임을 음영 방식으로 교체 | 사용자 요청(클래시 로얄 카드 화면 참고) | `PlayerData.CardsCsv`(저장 JSON `cards`), `UnitLevelTable.CardsNeeded`, `StageTable.RewardCards`. 기존 계정은 카드 0장에서 시작. 카드 획득 방식(승리 시 무작위 분배)은 잠정 |
| 2026-10-07 | Remove | 몬스터·설치물 머리 위 HP 바 제거(`BattleFx.ShowUnitBars = false`). 기지 타워의 바는 유지. 피격 점멸·효과음·효과 아이콘은 바 없이도 동작 | 사용자 요청 | 로그·화면 확인: 바는 기지 2개에만 생기고, 바 없는 슬라임도 `first hit … sound=hit`. 되돌리려면 속성 하나만 true로 |
| 2026-10-07 | Modify | 넉백을 `MovementComponent` 밀기에서 물리 충격(`RigidbodyComponent:SetForce`, 뒤쪽 힘 + 위로 약간)으로 교체. 공용 기본값 0.45초, 날려버린다 0.8초 | 사용자 보고 — 넉백이 순간이동처럼 보임(2배 속도로 밀고 목표 지점에 위치를 고정하던 방식 때문) | 엔진이 감속시켜 0.3~0.4초에 걸쳐 밀리고 살짝 뜬다. 로그 확인: 구간 넉백 0.52 목표 → 0.24 / 0.42 / 0.49 / 0.52(0.1초 간격), 날려버린다 1.30 목표 → 1.67(큰 힘은 거리가 비례보다 길어짐, 잠정 허용). 힘 상수 `KnockbackForcePerUnit` 12.5는 측정으로 맞춘 값 |
| 2026-10-07 | Modify | 미정 사항에 대한 사용자 답을 반영해 속성·효과·넉백을 구현(🟡). 확률표는 따로 두지 않고 효과 표 한 줄에 속성별 확률을 둔다. "유닛별 속성·효과 배정과 화면 표시" 항목을 새로 추가(⬜) | 사용자 답: 축 = 효과 × 맞은 유닛 속성, 효과는 하나, 넉백은 구간마다, 상성 없음 | 효과 4종의 동작은 AI의 잠정 해석. 표의 확률·시간·거리는 전부 잠정값. 유닛의 속성·효과 칸이 비어 있어 실제 전투에서는 넉백만 일어난다(모든 몬스터 34% 구간) |
| 2026-10-07 | Modify | 효과 표의 지속 시간·세기·속성별 확률을 '기본값'으로 바꾸고, `UnitTable`에 `EffectDuration` / `EffectPower` / `EffectChance*` 8열을 추가해 유닛이 덮어쓰게 함. 설치물도 효과를 걸 수 있게 함(받는 쪽은 속성 있는 몬스터만). 편집기에 "효과" 그룹 추가 | 사용자 요청 | 변경: `BattleConfig.GetUnits`(`effectOverride`), `BattleUnit.Setup`·`TryApplyEffect`, `schema.cjs`·`unitdata.cjs`. 기존 데이터는 덮어쓰기 칸이 전부 빈칸이라 동작이 그대로다. ⚠️ needs user test: Maker refresh 후 설치물에 효과를 넣고 플레이해 로그 `[BattleUnit] effect ...`로 걸리는지, 덮어쓴 확률·지속 시간이 적용되는지 확인 |
| 2026-10-09 | Add | 새 Phase 5 "기지를 고르고 키운다"를 PC 오픈 앞에 넣고, 기존 Phase 5 "PC로 연다"는 Phase 6으로 번호만 바꿈. 기지 종류·Worldcoin 구매·영구 강화·기지 스킬·스테이지 지정 적 기지 | 사용자 기획서(베이스 캠프) 전달 — 기지를 고정이 아닌 고르고 키우는 것으로 변경 | 옮긴 Phase의 항목은 전부 ⬜라 상태 변화 없음. §1·§2·§4·§5·§7·§8과 로드맵 M3 줄에 반영. 기존 `base` 유닛 행·스테이지 `BaseHp`·전역 `CostStart`·`CostPerSecond`는 Phase 5에서 기지 값으로 대체되므로 그때 정리. 기획서와 다른 부분 4건(속성 상성, 효과 목록, 카드 레벨 능력치, 용어)은 결정이 필요해 로드맵 Backlog에 올림 |
| 2026-10-09 | Modify | 화면·운영툴에 보이는 용어 "코스트"를 "마나"로 교체(로비·전투 HUD 글자, UI 템플릿 글자, 운영툴 표시). 코드 식별자와 CSV 열 이름은 그대로 | 사용자 요청 | 구현 완료(표시만). `UnitTable.csv`·`CostLevelTable.csv`의 `#Memo` 글과 과거 문서 본문의 "코스트"는 그대로 둠(같은 것을 가리킴). 확인 필요: Maker refresh 후 글자 표시 |
| 2026-10-09 | Modify | 기지 선택 방식을 별도 '기지' 화면에서 "카드 목록의 카드 + 덱의 별도 기지 1칸"으로 변경(Phase 5의 '기지' 화면 항목을 '덱 화면의 기지 카드'로 교체, 플레이어 데이터·운영툴 항목에 반영) | 사용자 요청 | 모두 ⬜인 항목의 문구 수정이라 상태 변화 없음. 기지 칸은 10장 한도·손패와 무관. §2·§4·§5·§6·§8에 반영 |
| 2026-10-09 | Modify | Phase 5 구현 중 설계 두 가지를 바꿈: ① 기지 정의를 별도 `BaseTable` 대신 `UnitTable`의 `Kind = base` 행으로(카드 목록·등급 테두리·정렬·운영툴 재사용), 보유 기지도 `UnitsCsv`에 같이 저장 ② 구매 지급은 `ShopProductTable` 확장 대신 기지의 `ProductId`를 `CurrencyShop`이 찾는 방식. Phase 5의 '기지 구매' 항목을 '구매 지급'(🟡)과 '월드 상품 등록'(⬜, 사용자 확인 필요)으로 나눔 | 구현 단순화(새 표·새 저장 필드 최소화) | 항목 전부 🟡(⚠️ Maker 미연결로 실행 확인 못 함). `BattleConfig`·`PlayerData`·`BattleSide`·`BattleDirector`·`Commander`·`CurrencyShop`·`BattleHUD`·`LobbyUI`·`FieldFx`와 데이터 3종(`UnitTable`·`StageTable`·`BaseLevelTable`), 운영툴 스키마·화면 수정. 기존 `base` 행은 사용하지 않는 칸을 비움 |
| 2026-10-09 | Modify | 마나 레벨 한도를 플레이어 공통(상점에서 메소로 구매, `PlayerData.CostLevelCap`)에서 **기지별**로 변경: `UnitTable.ManaLevelStart`(기지 행, 샘플은 기본 3 / 숲 3 / 마법사 4 / 석상 2 / 발록 5) + `BaseLevelTable.ManaLevelBonus`(강화 레벨별 누적 0,0,1,2,3,4,5,6,7,7). 상점의 한도 구매 버튼·`RequestUnlockCostLevel`·저장 필드 `costCap` 삭제, 기지 정보 창에 한도 표시, 운영툴 칸 추가 | 사용자 요청(중요 수정) | 이전 M2에서 만든 "한도 해금(메소)" 기능이 사라진다(`CostLevelTable.UnlockMeso` 열은 쓰이지 않게 됨, 값은 그대로). 기존 계정의 저장된 `costCap`은 무시된다. ⚠️ needs user test: Maker refresh 후 상점 화면(버튼이 없어졌는지, 빌드 오류 없음), 기지별 한도 |
