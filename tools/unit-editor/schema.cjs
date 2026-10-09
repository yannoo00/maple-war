'use strict';
// Unit schema — the single source of truth for UnitTable columns, per-kind rules and enums.
// Mirrors what the game code actually reads: BattleConfig.GetUnits / BattleUnit.Setup / BattleFx.
// Columns are listed in CSV order; the tool reads the real header from the file and keeps unknown
// columns untouched, so adding a column to the CSV never breaks the tool.

const KINDS = ['monster', 'build', 'skill'];

const KIND_LABELS = { monster: '몬스터', build: '설치물', skill: '스킬' };

const ENUMS = {
  Rarity: ['normal', 'rare', 'epic', 'unique', 'legendary'],
  AttackType: ['melee', 'ranged', 'melee_area', 'ranged_area'],
  Attribute: ['earth', 'water', 'fire', 'wind', 'light', 'dark'],
};

const ENUM_LABELS = {
  Rarity: { normal: '노멀', rare: '레어', epic: '에픽', unique: '유니크', legendary: '레전더리' },
  AttackType: { melee: '근거리', ranged: '원거리', melee_area: '근거리 범위', ranged_area: '원거리 범위' },
  Attribute: { earth: '땅', water: '물', fire: '화염', wind: '바람', light: '빛', dark: '어둠' },
};

const GROUPS = [
  { id: 'id', label: '식별', kinds: KINDS },
  { id: 'card', label: '카드', kinds: KINDS },
  { id: 'combat', label: '전투 수치', kinds: ['monster', 'build'] },
  { id: 'timing', label: '공격 타이밍 (화면 보고 맞추는 값)', kinds: ['monster', 'build'] },
  { id: 'clip', label: '애니메이션 RUID', kinds: ['monster', 'build'] },
  { id: 'fx', label: '공격 연출 (클라이언트 전용)', kinds: ['monster', 'build'] },
  { id: 'monster', label: '속성 · 넉백 (몬스터 전용)', kinds: ['monster'] },
  { id: 'skill', label: '스킬', kinds: ['skill'] },
  { id: 'memo', label: '메모', kinds: KINDS },
];

// type: text | number | int | bool | enum | ruid | memo
// required: list of kinds for which the field must be filled
// kinds: list of kinds for which the field may be filled (others must stay blank)
const FIELDS = [
  { key: 'UnitId', group: 'id', type: 'text', label: '유닛 ID', required: KINDS, kinds: KINDS,
    help: '영문 소문자·숫자·밑줄. 코드·시간표·플레이어 저장 데이터가 이 값을 키로 씀' },
  { key: 'Kind', group: 'id', type: 'enum', enum: KINDS, label: '종류', required: KINDS, kinds: KINDS },
  { key: 'Name', group: 'id', type: 'text', label: '표시 이름', required: KINDS, kinds: KINDS },
  { key: 'Rarity', group: 'id', type: 'enum', enum: ENUMS.Rarity, label: '등급', kinds: KINDS, default: 'normal',
    help: '카드 테두리 색만 결정' },

  { key: 'Cost', group: 'card', type: 'number', label: '소환 코스트', required: KINDS, kinds: KINDS },
  { key: 'IconRuid', group: 'card', type: 'ruid', label: '스킬 카드 아이콘', kinds: ['skill'],
    help: '카드·상점·덱에 보이는 그림. 빈칸 = 범위 이펙트의 썸네일' },
  { key: 'SpawnCount', group: 'card', type: 'int', label: '한 번에 소환하는 수', kinds: ['monster'],
    help: '빈칸 = 1마리. 2 이상이면 카드 한 장으로 여러 마리(군단): 첫 마리는 바로, 나머지는 0.25초 간격(전투 설정 MultiSpawnInterval). 마리당 능력치는 이 행의 값' },
  { key: 'Starter', group: 'card', type: 'bool', label: '스타터 지급', kinds: KINDS, default: '0',
    help: '1 = 신규 유저가 처음부터 가짐. 0이어도 상자에서 나옴(상자는 같은 등급의 모든 카드 유닛을 뽑음)' },

  { key: 'MaxHp', group: 'combat', type: 'number', label: '최대 HP', required: ['monster', 'build'], kinds: ['monster', 'build'],
    help: '레벨 StatRate 배율 적용' },
  { key: 'Attack', group: 'combat', type: 'number', label: '공격력', required: ['monster', 'build'], kinds: ['monster', 'build'],
    help: '0이면 공격하지 않음' },
  { key: 'Range', group: 'combat', type: 'number', label: '사거리', required: ['monster', 'build'], kinds: ['monster', 'build'],
    help: '저작 단위. 실제 = 값 × BattleConfig.RangeScale(0.65). 근접 0.7~1.2, 원거리 3~4' },
  { key: 'AttackType', group: 'combat', type: 'enum', enum: ENUMS.AttackType, label: '공격 타입', kinds: ['monster', 'build'],
    help: '빈칸이면 투사체가 있으면 ranged, 없으면 melee. *_area = 사거리 안 적 전부 타격' },
  { key: 'AttackInterval', group: 'combat', type: 'number', label: '공격 간격(초)', required: ['monster', 'build'], kinds: ['monster', 'build'] },
  { key: 'Speed', group: 'combat', type: 'number', label: '이동 속도', required: ['monster', 'build'], kinds: ['monster', 'build'],
    help: '설치물은 0. 실제 = 값 × SpeedScale(0.5)' },
  { key: 'Scale', group: 'combat', type: 'number', label: '크기 배율', kinds: ['monster', 'build'], default: '1',
    help: '실제 = 값 × UnitScale(0.65)' },

  { key: 'AttackPlayRate', group: 'timing', type: 'number', label: '공격 클립 재생 속도', kinds: ['monster', 'build'], default: '1' },
  { key: 'AttackPose', group: 'timing', type: 'number', label: '공격 자세 유지(초)', kinds: ['monster', 'build'], default: '0',
    help: '이 시간이 지나면 stand 클립으로 복귀' },
  { key: 'AttackHitDelay', group: 'timing', type: 'number', label: '타격 시점(초)', kinds: ['monster', 'build'], default: '0',
    help: '공격 시작부터 피해까지. 투사체 비행 시간도 이 값' },

  { key: 'StandRuid', group: 'clip', type: 'ruid', label: 'stand', required: ['monster', 'build'], kinds: ['monster', 'build'],
    help: '비면 화면에 안 보임. 상점 아이콘 썸네일에도 사용' },
  { key: 'MoveRuid', group: 'clip', type: 'ruid', label: 'move', required: ['monster'], kinds: ['monster', 'build'],
    help: '설치물은 비우면 stand와 같은 값으로 저장' },
  { key: 'AttackRuid', group: 'clip', type: 'ruid', label: 'attack1', required: ['monster', 'build'], kinds: ['monster', 'build'] },
  { key: 'DieRuid', group: 'clip', type: 'ruid', label: 'die1', required: ['monster', 'build'], kinds: ['monster', 'build'],
    help: '사망 후 0.6초 재생 뒤 파괴' },
  { key: 'HitRuid', group: 'clip', type: 'ruid', label: 'hit1 (피격)', kinds: ['monster'],
    help: '넉백·날려버리기 때 재생. 없으면 서 있는 모습으로 밀림' },

  { key: 'ProjectileRuid', group: 'fx', type: 'ruid', label: '투사체 (attack1/info/ball)', kinds: ['monster', 'build'],
    help: '있으면 공격 때 대상까지 날아감' },
  { key: 'ProjectileScale', group: 'fx', type: 'number', label: '투사체 크기', kinds: ['monster', 'build'], default: '1' },
  { key: 'AttackEffectRuid', group: 'fx', type: 'ruid', label: '공격 이펙트 (attack1/info/effect)', kinds: ['monster', 'build'],
    help: '공격 시 자기 몸에 붙여 재생' },
  { key: 'AttackEffectOffsetX', group: 'fx', type: 'number', label: '공격 이펙트 위치 X', kinds: ['monster', 'build'],
    help: '앞(유닛이 바라보는 쪽)이 +. 월드 유닛, 화면에서 보이는 크기 기준(1 = 100px). 빈칸 = 0' },
  { key: 'AttackEffectOffsetY', group: 'fx', type: 'number', label: '공격 이펙트 위치 Y', kinds: ['monster', 'build'],
    help: '발 기준 위가 +. 빈칸 = 0 (이펙트가 발 위치에 놓임). 미리보기의 맞춤 버튼으로 몸 중앙에 맞출 수 있음' },
  { key: 'AttackEffectScale', group: 'fx', type: 'number', label: '공격 이펙트 크기 배율', kinds: ['monster', 'build'],
    help: '이펙트는 유닛 크기를 따라가며, 그 위에 곱하는 값. 빈칸 = 1' },
  { key: 'HitEffectRuid', group: 'fx', type: 'ruid', label: '타격 이펙트 (attack1/info/hit)', kinds: ['monster', 'build'],
    help: '이 유닛의 공격이 피해를 준 순간, 맞은 대상의 몸에 재생. 빈칸 = 없음. 범위 공격은 맞은 대상마다 재생' },
  { key: 'AttackSoundRuid', group: 'fx', type: 'ruid', label: '공격음 (audio/Attack1)', kinds: ['monster', 'build'] },
  { key: 'DamageSoundRuid', group: 'fx', type: 'ruid', label: '피격음 (audio/Damage)', kinds: ['monster', 'build'], help: '빈칸 = 공용 타격음' },
  { key: 'DieSoundRuid', group: 'fx', type: 'ruid', label: '사망음 (audio/Die)', kinds: ['monster', 'build'] },
  // Monsters and builds have no HP bar any more (BattleFx.ShowUnitBars = false); BarY now only sets how high the effect
  // icons (knockback, curse ...) float above the unit. BarWidth only sizes the base towers' bar, so no card kind fills it
  // (kinds: [] keeps it out of the form; the base row keeps its value).
  { key: 'BarY', group: 'fx', type: 'number', label: '효과 아이콘 높이', kinds: ['monster', 'build'], help: '머리 위 효과 아이콘이 뜨는 높이. 빈칸 = BattleFx 기본값(0.8). 보통 0.5~1.15' },
  { key: 'BarWidth', group: 'fx', type: 'number', label: 'HP 바 너비 (기지 전용)', kinds: [] },

  { key: 'Attribute', group: 'monster', type: 'enum', enum: ENUMS.Attribute, label: '속성', kinds: ['monster'],
    help: '지금은 어떤 규칙에도 쓰이지 않음(상성·효과 확률 없음). 나중을 위해 남겨 둔 칸' },
  { key: 'KnockbackHpPercent', group: 'monster', type: 'number', label: '넉백 체력 구간(%)', kinds: ['monster'],
    help: '빈칸 = 공용 34. 0 = 넉백 없음' },
  { key: 'KnockbackDistance', group: 'monster', type: 'number', label: '넉백 거리', kinds: ['monster'], help: '빈칸 = 공용 0.8' },
  { key: 'KnockbackSeconds', group: 'monster', type: 'number', label: '넉백 시간(초)', kinds: ['monster'], help: '빈칸 = 공용 0.35' },

  { key: 'SkillDamage', group: 'skill', type: 'number', label: '스킬 피해', required: ['skill'], kinds: ['skill'], help: '레벨 배율 적용' },
  { key: 'SkillRadius', group: 'skill', type: 'number', label: '범위', required: ['skill'], kinds: ['skill'], help: '미리보기 박스 크기에도 사용' },
  { key: 'SkillHitDelay', group: 'skill', type: 'number', label: '피해 시점(초)', required: ['skill'], kinds: ['skill'], help: '이펙트 시작부터 피해까지' },
  { key: 'EffectRuid', group: 'skill', type: 'ruid', label: '범위 이펙트', required: ['skill'], kinds: ['skill'], help: '상점 아이콘 썸네일에도 사용' },
  { key: 'EffectScale', group: 'skill', type: 'number', label: '이펙트 크기', kinds: ['skill'], default: '1' },
  { key: 'EffectOffsetX', group: 'skill', type: 'number', label: '이펙트 위치 X', kinds: ['skill'],
    help: '범위 중심 기준 오른쪽이 +. 월드 유닛(1 = 100px). 빈칸 = 0' },
  { key: 'EffectOffsetY', group: 'skill', type: 'number', label: '이펙트 위치 Y', kinds: ['skill'],
    help: '지면 기준 위가 +. 기본 위치(이펙트 프레임의 맨 아래가 지면)에 더해짐. 빈칸 = 0. 미리보기의 맞춤 버튼으로 내용물을 맞출 수 있음' },

  { key: '#Memo', group: 'memo', type: 'memo', label: '메모', kinds: KINDS, help: '코드가 읽지 않음. 적은 메모가 아니라 스테이지 등장(시간표·반복 풀)으로 정해짐' },
];

const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

const UNIT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

// ---------- EffectTable ----------
// One row = one effect: WHAT it does (Type is the behavior key BattleUnit:ReceiveEffect branches on, plus Duration / Power).
// Who gets it, when and with what chance is NOT here: each monster / build owns that as rules in UnitEffectTable, and a
// rule may override Duration / Power. Applies says which targets the effect makes sense for (target = an enemy it hits,
// self = the unit itself as a trait, both).
// A row whose Type is not implemented in code is allowed: it is a design note (the memo is the spec) until Claude
// implements it. The editor shows which types the code actually handles (see unitdata.implementedEffectTypes).

const EFFECT_APPLIES = ['target', 'self', 'both'];
ENUM_LABELS.Applies = { target: '적에게 (공격으로 거는 효과)', self: '자신에게 (특성)', both: '둘 다' };

// 유닛이 효과를 쓰는 규칙(UnitEffectTable): 시점 -> 대상은 정해져 있다.
//   on_hit  : 이 유닛의 공격이 적에게 피해를 줄 때, 규칙마다 정한 확률(%)로 맞은 적(target)에게 건다.
//   always  : 생성될 때 자신(self)에게 건다(확률 없음, 사는 동안 지속). 지속 시간 칸은 무시된다.
const RULE_TRIGGERS = [
  { id: 'on_hit', label: '공격 시', target: 'target' },
  { id: 'always', label: '항상 (특성)', target: 'self' },
];

const EFFECT_FIELDS = [
  { key: 'EffectId', type: 'text', label: '효과 ID', required: true,
    help: '영문 소문자·숫자·밑줄. 유닛의 효과 규칙(UnitEffectTable)이 이 값을 가리킴' },
  { key: 'Type', type: 'text', label: '동작 타입', required: true,
    help: '코드가 분기하는 키. 기존: nullify / curse / warp / blow. 새 타입을 적으면 "미구현"으로 표시되고, 메모의 설명을 보고 Claude가 구현함' },
  { key: 'Name', type: 'text', label: '표시 이름', required: true },
  { key: 'Duration', type: 'number', label: '지속 시간(초) · 기본값', required: true, help: '유닛의 규칙이 덮어쓸 수 있음. nullify·curse: 효과 유지 / warp: 정지 시간 / blow: 밀리는 시간. 특성(always)으로 쓸 때는 무시됨(사는 동안 지속)' },
  { key: 'Power', type: 'number', label: '세기 · 기본값', default: '0', help: '유닛의 규칙이 덮어쓸 수 있음. warp·blow: 거리(사거리와 같은 단위) / curse: 공격력 감소 % (50 = 절반). 다른 타입은 의미를 메모에 적을 것' },
  { key: 'Applies', type: 'enum', enum: EFFECT_APPLIES, label: '쓸 수 있는 대상', default: 'target',
    help: '적에게 거는 효과면 target, 자신의 특성이면 self, 둘 다 되면 both. 유닛의 규칙이 이 값과 맞지 않으면 저장이 막힘' },
  { key: 'IconRuid', type: 'ruid', label: '아이콘', help: '효과에 걸린 유닛 머리 위에 뜨는 그림. 빈칸 = 코드의 기본 픽셀 아이콘' },
  { key: '#Memo', type: 'memo', label: '효과 설명 (구현 스펙)',
    help: '코드는 읽지 않음. 미구현 타입이면 이 설명이 Claude에게 넘길 구현 스펙이 됨: 누구에게, 얼마 동안, 무엇이 일어나는지' },
];

const EFFECT_FIELD_BY_KEY = Object.fromEntries(EFFECT_FIELDS.map((f) => [f.key, f]));

// ---------- StageTable + StageWaveTable ----------
// One stage = one StageTable row + its StageWaveTable rows (the timetable) + the loop pool in StageTable.LoopPool.
// StageAI plays the timetable in time order, then (after the last row) draws from the loop pool every
// LoopStartInterval seconds, shortening by 0.3s per spawn down to LoopMinInterval. The same unit repeated in the
// pool is drawn more often (weight).

const STAGE_FIELDS = [
  { key: 'StageId', type: 'text', label: '스테이지 ID', required: true, help: '영문 소문자·숫자·밑줄. 저장 데이터의 진행도·해금이 이 값을 키로 씀' },
  { key: 'Name', type: 'text', label: '표시 이름', required: true },
  { key: 'MapName', type: 'map', label: '전투 맵', required: true, help: 'map/ 폴더의 .map 이름 (확장자 없이)' },
  { key: 'GroundY', type: 'number', label: '바닥 높이(GroundY)', required: true, help: '이 맵의 바닥 y. 유닛·포탈이 이 높이에 선다' },
  { key: 'BaseHp', type: 'number', label: '기지 HP', required: true, help: '양쪽 기지 HP. UnitTable의 base 행 값을 덮어씀' },
  { key: 'RewardMeso', type: 'number', label: '클리어 보상 메소', default: '0' },
  { key: 'RewardCards', type: 'number', label: '클리어 보상 카드 수', default: '0', help: '전투 결과에서 주는 카드 수 (BattleDirector가 읽음)' },
  { key: 'EntryCost', type: 'number', label: '입장 비용(입장권)', default: '0' },
  { key: 'UnlockStage', type: 'stage', label: '선행 스테이지', help: '이 스테이지를 클리어해야 열림. 비면 처음부터 열려 있음' },
  { key: 'LoopStartInterval', type: 'number', label: '반복 시작 간격(초)', default: '6', help: '시간표가 끝난 뒤 반복 풀에서 처음 뽑는 간격' },
  { key: 'LoopMinInterval', type: 'number', label: '반복 최소 간격(초)', default: '3', help: '뽑을 때마다 0.3초씩 줄어들어 이 값까지' },
  { key: '#Memo', type: 'memo', label: '메모', help: '코드가 읽지 않음' },
];
// LoopPool is edited as a list, not a text cell.
const STAGE_FIELD_BY_KEY = Object.fromEntries(STAGE_FIELDS.map((f) => [f.key, f]));
const STAGE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

const EFFECT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const EFFECT_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;

// The kinds this tool edits. Other kinds (base) are preserved in the CSV but never touched.
function isEditableKind(kind) {
  return KINDS.includes(kind);
}

function fieldsForKind(kind) {
  return FIELDS.filter((f) => f.kinds.includes(kind));
}

module.exports = {
  KINDS,
  KIND_LABELS,
  ENUMS,
  ENUM_LABELS,
  GROUPS,
  FIELDS,
  FIELD_BY_KEY,
  UNIT_ID_PATTERN,
  isEditableKind,
  fieldsForKind,
  EFFECT_APPLIES,
  RULE_TRIGGERS,
  EFFECT_FIELDS,
  EFFECT_FIELD_BY_KEY,
  EFFECT_ID_PATTERN,
  EFFECT_TYPE_PATTERN,
  STAGE_FIELDS,
  STAGE_FIELD_BY_KEY,
  STAGE_ID_PATTERN,
};
