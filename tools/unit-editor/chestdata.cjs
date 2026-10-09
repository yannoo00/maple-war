'use strict';
// Summon stones (ChestTable.csv) — shared by the CLI and the browser editor, on top of unitdata.cjs's CSV helpers.
// One row = one summon stone (the game reads it in BattleConfig.GetChests / GetSummonStone):
// how many cards one stone gives, the rarity odds of each card, a guaranteed rarity, the shop price, the stone's own
// rarity (frame color) and an optional icon that overrides the base stone icon (BattleConfig.SummonStoneIconRuid).

const path = require('node:path');
const data = require('./unitdata.cjs');

const FILE = path.join(data.DATA_DIR, 'ChestTable.csv');
const RARITIES = ['normal', 'rare', 'epic', 'unique', 'legendary'];
const RARITY_LABELS = { normal: '노멀', rare: '레어', epic: '에픽', unique: '유니크', legendary: '레전더리' };
const CHANCE_KEYS = { normal: 'ChanceNormal', rare: 'ChanceRare', epic: 'ChanceEpic', unique: 'ChanceUnique', legendary: 'ChanceLegendary' };
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const CARD_KINDS = ['monster', 'build', 'skill'];

// type: text | int | number | enum | ruid | memo (same vocabulary as schema.cjs, so the editor's Field renders them)
const FIELDS = [
  { key: 'ChestId', group: 'id', type: 'text', label: '돌 ID', required: true,
    help: '영문 소문자·숫자·밑줄. 스테이지 보상(StageTable.RewardChest)과 플레이어 보관함이 이 id를 씁니다' },
  { key: 'Name', group: 'id', type: 'text', label: '이름', required: true, help: '예: 레어 소환의 돌' },
  { key: 'Rarity', group: 'id', type: 'enum', enum: RARITIES, label: '돌 등급 (테두리 색)', required: true },
  { key: 'IconRuid', group: 'id', type: 'ruid', label: '아이콘 (이 돌만)', help: '빈칸 = 기본 소환의 돌 아이콘 (BattleConfig.SummonStoneIconRuid)' },
  { key: 'Cards', group: 'drop', type: 'int', label: '돌 하나당 카드 수', required: true, default: '5' },
  { key: 'Guarantee', group: 'drop', type: 'enum', enum: RARITIES, label: '보장 등급', help: '첫 카드가 이 등급 미만으로 나오면 이 등급으로 올림. 빈칸 = 보장 없음' },
  { key: 'PriceMeso', group: 'drop', type: 'int', label: '상점 가격 (메소)', default: '0', help: '0 = 상점에서 팔지 않음 (보상으로만)' },
  ...RARITIES.map((r) => ({ key: CHANCE_KEYS[r], group: 'chance', type: 'number', label: `${RARITY_LABELS[r]} 확률 (%)`, rarity: r, default: '0' })),
  { key: '#Memo', group: 'memo', type: 'memo', label: '메모' },
];
const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
const GROUPS = [
  { id: 'id', label: '소환의 돌' },
  { id: 'drop', label: '카드 획득량 · 가격' },
  { id: 'chance', label: '카드 한 장의 등급 확률 — 합계 100%' },
  { id: 'memo', label: '메모' },
];

function load() {
  const all = data.loadAll();
  return { chests: data.readTable(FILE), units: all.units, stages: all.stages };
}

function cardCountsByRarity(units) {
  // Card units the summon can roll, per rarity (BattleConfig.GetUnitsByRarity).
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (const u of units.records) {
    if (!u.UnitId || !CARD_KINDS.includes(u.Kind)) continue;
    const r = RARITIES.includes(u.Rarity) ? u.Rarity : 'normal';
    counts[r] += 1;
  }
  return counts;
}

function chestStatus(chest, d) {
  const chanceSum = RARITIES.reduce((s, r) => s + (Number(chest[CHANCE_KEYS[r]]) || 0), 0);
  const cards = Number(chest.Cards) || 0;
  const expected = Object.fromEntries(RARITIES.map((r) => [r, cards * (Number(chest[CHANCE_KEYS[r]]) || 0) / 100]));
  const rewardOf = d.stages.records.filter((s) => s.RewardChest === chest.ChestId).map((s) => s.StageId);
  return { chanceSum, expected, rewardOf, cardUnits: cardCountsByRarity(d.units) };
}

function normalize(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) if (!k.startsWith('_')) out[k] = v == null ? '' : String(v).trim();
  return out;
}

function validate(chest, d, opts = {}) {
  const errors = [];
  const warnings = [];
  const id = chest.ChestId;
  if (!id) errors.push('ChestId가 비어 있습니다');
  else if (!ID_PATTERN.test(id)) errors.push(`ChestId "${id}"는 영문 소문자로 시작하고 소문자·숫자·밑줄만 쓸 수 있습니다`);
  const existing = id ? d.chests.records.find((r) => r.ChestId === id) : null;
  if (existing && opts.mode === 'add') errors.push(`ChestId "${id}"가 이미 있습니다`);
  if (!existing && opts.mode === 'update') errors.push(`ChestId "${id}"가 표에 없습니다`);
  for (const k of Object.keys(chest)) if (!FIELD_BY_KEY[k] && !d.chests.header.includes(k)) errors.push(`"${k}"는 ChestTable에 없는 열입니다`);
  for (const f of FIELDS) {
    if (!d.chests.header.includes(f.key)) continue;
    const v = chest[f.key] == null ? '' : String(chest[f.key]);
    if (f.required && v === '') { errors.push(`${f.label}(${f.key})이(가) 비어 있습니다`); continue; }
    if (v === '') continue;
    if (f.type === 'int' && !/^\d+$/.test(v)) errors.push(`${f.key}는 0 이상의 정수여야 합니다 (현재 "${v}")`);
    if (f.type === 'number' && !(Number.isFinite(Number(v)) && Number(v) >= 0)) errors.push(`${f.key}는 0 이상의 숫자여야 합니다 (현재 "${v}")`);
    if (f.type === 'enum' && !f.enum.includes(v)) errors.push(`${f.key} "${v}"는 ${f.enum.join(' / ')} 중 하나여야 합니다`);
    if (f.type === 'ruid' && !/^[0-9a-f]{32}$/.test(v)) errors.push(`${f.key}는 32자리 16진수 RUID여야 합니다 (현재 "${v}")`);
  }
  if (chest.Cards !== undefined && /^\d+$/.test(chest.Cards || '') && Number(chest.Cards) < 1) errors.push('Cards는 1 이상이어야 합니다');
  const st = chestStatus(chest, d);
  if (Math.abs(st.chanceSum - 100) > 0.001) errors.push(`등급 확률의 합이 ${st.chanceSum}%입니다. 100%가 되어야 합니다`);
  for (const r of RARITIES) {
    if ((Number(chest[CHANCE_KEYS[r]]) || 0) > 0 && st.cardUnits[r] === 0) {
      warnings.push(`${RARITY_LABELS[r]} 카드 유닛이 없습니다. 이 등급이 나오면 한 단계 낮은 등급 카드로 대신 나옵니다`);
    }
  }
  if (chest.Guarantee && st.cardUnits[chest.Guarantee] === 0) warnings.push(`보장 등급 ${RARITY_LABELS[chest.Guarantee]}의 카드 유닛이 없습니다`);
  if (chest.Rarity && id && RARITIES.includes(id) && chest.Rarity !== id) warnings.push(`ChestId "${id}"와 돌 등급 "${chest.Rarity}"가 다릅니다 (테두리 색은 돌 등급을 따릅니다)`);
  return { errors, warnings, status: st };
}

function buildRecord(header, chest, existing) {
  const rec = {};
  for (const h of header) rec[h] = existing && existing[h] != null ? existing[h] : '';
  for (const [k, v] of Object.entries(chest)) if (header.includes(k)) rec[k] = v;
  return rec;
}

function list() {
  const d = load();
  return d.chests.records.filter((r) => r.ChestId).map((r) => ({ ...r, _status: chestStatus(r, d) }));
}

function template() {
  const d = load();
  const t = Object.fromEntries(d.chests.header.map((h) => [h, '']));
  for (const f of FIELDS) if (f.default != null && t[f.key] !== undefined) t[f.key] = f.default;
  return t;
}

function previewValidate(input, opts = {}) {
  const d = load();
  const chest = normalize(input);
  const r = validate(chest, d, { mode: opts.mode || 'upsert' });
  return { ok: r.errors.length === 0, ...r, chest };
}

function save(input, opts = {}) {
  const d = load();
  const chest = normalize(input);
  const r = validate(chest, d, { mode: opts.mode || 'upsert' });
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings, chest };
  const existing = d.chests.records.find((x) => x.ChestId === chest.ChestId);
  if (!existing) for (const f of FIELDS) if (f.default != null && (chest[f.key] == null || chest[f.key] === '')) chest[f.key] = f.default;
  const rec = buildRecord(d.chests.header, chest, existing);
  if (existing) d.chests.records[d.chests.records.indexOf(existing)] = rec;
  else d.chests.records.push(rec);
  data.writeTable(d.chests);
  return { ok: true, created: !existing, errors: [], warnings: r.warnings, chest: rec, status: chestStatus(rec, load()), changed: ['ChestTable.csv'] };
}

function remove(chestId, opts = {}) {
  const d = load();
  const existing = d.chests.records.find((x) => x.ChestId === chestId);
  if (!existing) return { ok: false, errors: [`ChestId "${chestId}"가 표에 없습니다`] };
  const rewardOf = d.stages.records.filter((s) => s.RewardChest === chestId).map((s) => s.StageId);
  if (rewardOf.length && !opts.force) return { ok: false, errors: [`"${chestId}"를 보상으로 주는 스테이지가 있습니다: ${rewardOf.join(', ')}. 그 보상 칸을 비우면서 지우려면 force를 켜세요`] };
  d.chests.records = d.chests.records.filter((x) => x !== existing);
  data.writeTable(d.chests);
  const changed = ['ChestTable.csv'];
  if (rewardOf.length) {
    for (const s of d.stages.records) if (s.RewardChest === chestId) s.RewardChest = '';
    data.writeTable(d.stages);
    changed.push('StageTable.csv');
  }
  return { ok: true, errors: [], warnings: ['이미 이 돌을 보관함에 가진 플레이어는 그 돌을 쓸 수 없게 됩니다 (보관함 데이터는 남음)'], changed };
}

function baseStoneIcon() {
  // The base summon stone icon (BattleConfig.SummonStoneIconRuid), used where a row leaves IconRuid blank.
  try {
    const src = require('node:fs').readFileSync(path.join(data.ROOT, 'RootDesk', 'MyDesk', 'Battle', 'BattleConfig.mlua'), 'utf8');
    const m = src.match(/property string SummonStoneIconRuid = "([0-9a-f]{32})"/);
    return m ? m[1] : '';
  } catch { return ''; }
}

function stateFields() {
  // What the browser needs: field definitions (only columns the CSV has), header, groups and rarity labels.
  const d = load();
  return {
    chestFields: FIELDS.filter((f) => d.chests.header.includes(f.key)),
    chestHeader: d.chests.header,
    chestGroups: GROUPS,
    rarityLabels: RARITY_LABELS,
    summonStoneIconRuid: baseStoneIcon(),
  };
}

module.exports = { FILE, FIELDS, RARITIES, CHANCE_KEYS, list, template, previewValidate, save, remove, stateFields };
