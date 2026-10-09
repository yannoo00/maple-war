'use strict';
// Data layer shared by the CLI and the browser editor.
// Reads and writes the real dataset CSVs under RootDesk/MyDesk/Data (UTF-8 BOM + CRLF, as Maker writes them),
// validates a unit against schema.cjs and derives the ally / enemy status that the game code actually uses.

const fs = require('node:fs');
const path = require('node:path');
const schema = require('./schema.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
// UNIT_EDITOR_DATA_DIR overrides the data folder (used to test against a copy without touching the real tables).
const DATA_DIR = process.env.UNIT_EDITOR_DATA_DIR
  ? path.resolve(process.env.UNIT_EDITOR_DATA_DIR)
  : path.join(ROOT, 'RootDesk', 'MyDesk', 'Data');
const FILES = {
  units: path.join(DATA_DIR, 'UnitTable.csv'),
  waves: path.join(DATA_DIR, 'StageWaveTable.csv'),
  stages: path.join(DATA_DIR, 'StageTable.csv'),
  effects: path.join(DATA_DIR, 'EffectTable.csv'),
  unitEffects: path.join(DATA_DIR, 'UnitEffectTable.csv'),   // 유닛별 효과 규칙 (한 유닛에 여러 줄)
};

// ---------- CSV ----------

function parseCsv(text) {
  // Quote-aware parser: returns { header: string[], rows: string[][] }. Trailing empty line is dropped.
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      cell += ch; i += 1; continue;
    }
    if (ch === '"') { quoted = true; i += 1; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; continue; }
    cell += ch; i += 1;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const header = rows.shift() || [];
  return { header, rows: rows.filter((r) => !(r.length === 1 && r[0] === '')) };
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function serializeCsv(header, rows, eol) {
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) lines.push(header.map((_, i) => csvCell(r[i])).join(','));
  return lines.join(eol) + eol;
}

function readTable(file) {
  const buf = fs.readFileSync(file);
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = buf.toString('utf8').replace(/^﻿/, '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const { header, rows } = parseCsv(text);
  const records = rows.map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] == null ? '' : r[i]; });
    return o;
  });
  return { file, header, records, bom, eol };
}

function writeTable(table) {
  const rows = table.records.map((rec) => table.header.map((h) => rec[h] == null ? '' : rec[h]));
  const text = (table.bom ? '﻿' : '') + serializeCsv(table.header, rows, table.eol);
  fs.writeFileSync(table.file, text, 'utf8');
}

// ---------- Loading ----------

function loadAll() {
  const units = readTable(FILES.units);
  const waves = readTable(FILES.waves);
  const stages = readTable(FILES.stages);
  const effects = readTable(FILES.effects);
  const unitEffects = readTable(FILES.unitEffects);
  return { units, waves, stages, effects, unitEffects };
}

function unitById(units, id) {
  return units.records.find((r) => r.UnitId === id) || null;
}

function stageIds(stages) {
  return stages.records.map((r) => r.StageId).filter(Boolean);
}

function effectIds(effects) {
  return effects.records.map((r) => r.EffectId).filter(Boolean);
}

function loopPool(stageRec) {
  return (stageRec.LoopPool || '').split(';').map((s) => s.trim()).filter(Boolean);
}

// ---------- Derived status (what the game code actually reads) ----------

function unitStatus(unit, data) {
  const starter = Number(unit.Starter || 0) > 0;
  const playable = schema.isEditableKind(unit.Kind);
  const waves = data.waves.records
    .filter((w) => w.UnitId === unit.UnitId)
    .map((w) => ({ stage: w.StageId, time: Number(w.Time), level: Number(w.Level || 1) }));
  const pools = data.stages.records.filter((s) => loopPool(s).includes(unit.UnitId)).map((s) => s.StageId);
  const enemyStages = [...new Set([...waves.map((w) => w.stage), ...pools])];
  const effects = data.unitEffects.records
    .filter((r) => r.UnitId === unit.UnitId)
    .map((r) => ({ effectId: r.EffectId, trigger: r.Trigger, target: r.Target, chance: r.Chance, duration: r.Duration, power: r.Power }));
  return {
    ally: playable,   // 카드 유닛은 스타터로 받거나 상자에서 나온다
    starter,
    enemy: enemyStages.length > 0,
    enemyStages,
    waves,
    pools,
    effects,
  };
}

// ---------- Validation ----------

function isNumeric(s) {
  return s !== '' && Number.isFinite(Number(s));
}

function normalizeUnit(input) {
  // Accepts a JSON object keyed by CSV column names; booleans / numbers become strings as the CSV stores them.
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'waves' || k === 'loopPool' || k === 'effects') continue;
    if (v == null) { out[k] = ''; continue; }
    if (typeof v === 'boolean') { out[k] = v ? '1' : '0'; continue; }
    out[k] = String(v).trim();
  }
  if (out.Kind === 'build') {
    if (out.Speed === '' || out.Speed == null) out.Speed = '0';
    if ((out.MoveRuid === '' || out.MoveRuid == null) && out.StandRuid) out.MoveRuid = out.StandRuid;
  }
  return out;
}

function validateUnit(unit, data, opts = {}) {
  // Returns { errors: string[], warnings: string[] }. Errors block saving.
  const errors = [];
  const warnings = [];
  const kind = unit.Kind || '';
  if (!schema.isEditableKind(kind)) {
    errors.push(`Kind는 ${schema.KINDS.join(' / ')} 중 하나여야 합니다 (현재 "${kind}")`);
    return { errors, warnings };
  }
  if (!unit.UnitId) errors.push('UnitId가 비어 있습니다');
  else if (!schema.UNIT_ID_PATTERN.test(unit.UnitId)) errors.push(`UnitId "${unit.UnitId}"는 영문 소문자로 시작하고 소문자·숫자·밑줄만 쓸 수 있습니다`);

  const existing = unit.UnitId ? unitById(data.units, unit.UnitId) : null;
  if (existing && opts.mode === 'add') errors.push(`UnitId "${unit.UnitId}"가 이미 있습니다 (덮어쓰려면 update / upsert)`);
  if (!existing && opts.mode === 'update') errors.push(`UnitId "${unit.UnitId}"가 표에 없습니다`);
  if (existing && !schema.isEditableKind(existing.Kind)) errors.push(`"${unit.UnitId}"는 ${existing.Kind} 행이라 이 툴로 수정할 수 없습니다`);

  for (const f of schema.FIELDS) {
    // A schema field whose column no longer exists in the CSV is ignored (the game code dropped it).
    if (!data.units.header.includes(f.key)) continue;
    const v = unit[f.key] == null ? '' : String(unit[f.key]);
    const applicable = f.kinds.includes(kind);
    const required = (f.required || []).includes(kind);
    if (!applicable) {
      if (v !== '') errors.push(`${f.key}는 ${schema.KIND_LABELS[kind]}에서 쓰지 않는 칸입니다. 비워 두세요 (현재 "${v}")`);
      continue;
    }
    if (required && v === '') { errors.push(`${f.key}(${f.label})는 필수입니다`); continue; }
    if (v === '') continue;
    if ((f.type === 'number' || f.type === 'int') && !isNumeric(v)) errors.push(`${f.key}는 숫자여야 합니다 (현재 "${v}")`);
    if (f.type === 'bool' && !['0', '1'].includes(v)) errors.push(`${f.key}는 0 또는 1이어야 합니다 (현재 "${v}")`);
    if (f.type === 'enum' && !f.enum.includes(v)) errors.push(`${f.key}는 ${f.enum.join(' / ')} 중 하나여야 합니다 (현재 "${v}")`);
    if (f.type === 'effect' && !effectIds(data.effects).includes(v)) errors.push(`Effect "${v}"가 EffectTable에 없습니다 (있는 것: ${effectIds(data.effects).join(', ') || '없음'})`);
    if (f.type === 'ruid' && !/^[0-9a-f]{32}$/.test(v)) warnings.push(`${f.key} "${v}"가 RUID 형식(32자리 16진수)이 아닙니다`);
  }
  for (const k of Object.keys(unit)) {
    if (!schema.FIELD_BY_KEY[k] && !data.units.header.includes(k)) errors.push(`"${k}"는 UnitTable에 없는 열입니다`);
  }

  if (kind === 'skill' && unit.SkillSoundDelay != null && String(unit.SkillSoundDelay) !== '' && isNumeric(String(unit.SkillSoundDelay)) && Number(unit.SkillSoundDelay) < 0) errors.push('SkillSoundDelay는 0 이상이어야 합니다');
  if (kind === 'skill' && !unit.SkillSoundRuid && unit.SkillSoundDelay != null && String(unit.SkillSoundDelay) !== '') warnings.push('스킬 효과음(SkillSoundRuid)이 없어 재생 시점 칸이 쓰이지 않습니다');
  if (kind === 'skill' && !unit.EffectRuid && ['EffectOffsetX', 'EffectOffsetY'].some((k) => unit[k] != null && String(unit[k]) !== '')) warnings.push('범위 이펙트(EffectRuid)가 없어 위치 칸이 쓰이지 않습니다');

  if (kind === 'monster' && unit.SpawnCount != null && String(unit.SpawnCount) !== '') {
    const n = Number(unit.SpawnCount);
    if (isNumeric(String(unit.SpawnCount)) && (!Number.isInteger(n) || n < 1)) errors.push(`SpawnCount는 1 이상의 정수여야 합니다 (현재 "${unit.SpawnCount}")`);
  }

  if (kind === 'monster' || kind === 'build') {
    const type = unit.AttackType || (unit.ProjectileRuid ? 'ranged' : 'melee');
    if (type.startsWith('ranged') && !unit.ProjectileRuid) warnings.push('원거리인데 ProjectileRuid가 없어 투사체 없이 피해만 들어갑니다');
    if (type.startsWith('melee') && unit.ProjectileRuid) warnings.push('근거리인데 ProjectileRuid가 있어 공격 때 투사체가 날아갑니다');
    if (unit.AttackEffectScale !== '' && unit.AttackEffectScale != null && isNumeric(String(unit.AttackEffectScale)) && Number(unit.AttackEffectScale) <= 0) errors.push('AttackEffectScale은 0보다 커야 합니다 (빈칸 = 1)');
    const hasOffset = ['AttackEffectOffsetX', 'AttackEffectOffsetY', 'AttackEffectScale'].some((k) => unit[k] != null && String(unit[k]) !== '');
    if (hasOffset && !unit.AttackEffectRuid) warnings.push('공격 이펙트(AttackEffectRuid)가 없어 위치·크기 칸이 쓰이지 않습니다');
    if (kind === 'build' && Number(unit.Speed) !== 0) errors.push('설치물(build)은 Speed가 0이어야 합니다');
    if (Number(unit.Attack) <= 0) warnings.push('Attack이 0이라 공격하지 않습니다');
    if (unit.KnockbackHpPercent !== '' && unit.KnockbackHpPercent != null && Number(unit.KnockbackHpPercent) === 0) warnings.push('KnockbackHpPercent=0: 넉백 없음');
  }

  return { errors, warnings };
}

function validateWaves(waves, data) {
  const errors = [];
  const ids = stageIds(data.stages);
  for (const w of waves || []) {
    if (!ids.includes(w.stage)) errors.push(`스테이지 "${w.stage}"가 StageTable에 없습니다 (${ids.join(', ')})`);
    if (!isNumeric(String(w.time)) || Number(w.time) < 0) errors.push(`등장 시각 "${w.time}"이 올바르지 않습니다`);
    if (w.level != null && w.level !== '' && (!isNumeric(String(w.level)) || Number(w.level) < 1)) errors.push(`레벨 "${w.level}"이 올바르지 않습니다`);
  }
  return errors;
}

// ---------- Effect rules (UnitEffectTable) ----------
// A unit's rules say WHEN an effect is used and on WHOM: on_hit (this unit's attack damages an enemy, with a chance per
// rule) -> target, always (applied to itself when it is set up) -> self. The effect itself (EffectTable) only says what it does.

function normalizeRules(rules) {
  return (Array.isArray(rules) ? rules : []).map((r) => {
    const o = {};
    for (const k of ['effectId', 'trigger', 'target', 'chance', 'duration', 'power']) o[k] = r && r[k] != null ? String(r[k]).trim() : '';
    return o;
  });
}

function validateEffectRules(unit, rules, data) {
  const errors = [];
  const warnings = [];
  if (!rules.length) return { errors, warnings };
  if (unit.Kind !== 'monster' && unit.Kind !== 'build') errors.push('효과 규칙은 몬스터·설치물만 가질 수 있습니다');
  const implemented = implementedEffectTypes();
  const seen = new Set();
  rules.forEach((r, i) => {
    const at = `효과 규칙 ${i + 1}`;
    const trig = schema.RULE_TRIGGERS.find((t) => t.id === r.trigger);
    const effect = data.effects.records.find((e) => e.EffectId === r.effectId);
    if (!r.effectId) errors.push(`${at}: 효과를 고르세요`);
    else if (!effect) errors.push(`${at}: 효과 "${r.effectId}"가 EffectTable에 없습니다`);
    if (!trig) { errors.push(`${at}: 시점은 ${schema.RULE_TRIGGERS.map((t) => t.id).join(' / ')} 중 하나여야 합니다 (현재 "${r.trigger}")`); return; }
    if (r.target !== trig.target) errors.push(`${at}: ${trig.id}의 대상은 ${trig.target}이어야 합니다 (현재 "${r.target}")`);
    if (trig.id === 'on_hit') {
      if (!isNumeric(r.chance) || Number(r.chance) < 0 || Number(r.chance) > 100) errors.push(`${at}: 확률은 0~100 사이 숫자여야 합니다 (현재 "${r.chance}")`);
      else if (Number(r.chance) === 0) warnings.push(`${at}: 확률이 0이라 한 번도 걸리지 않습니다`);
    } else if (r.chance !== '' && Number(r.chance) !== 100) {
      warnings.push(`${at}: 항상(특성) 규칙은 확률을 쓰지 않습니다 (항상 100)`);
    }
    for (const [k, label] of [['duration', '지속 시간'], ['power', '세기']]) {
      if (r[k] !== '' && (!isNumeric(r[k]) || Number(r[k]) < 0)) errors.push(`${at}: ${label} 덮어쓰기는 0 이상의 숫자여야 합니다 (현재 "${r[k]}")`);
    }
    if (trig.id === 'always' && r.duration !== '') warnings.push(`${at}: 항상(특성) 규칙은 사는 동안 지속되어 지속 시간 칸이 무시됩니다`);
    if (effect) {
      const applies = effect.Applies || 'target';
      if (applies === 'target' && r.target === 'self') errors.push(`${at}: "${effect.EffectId}"는 적에게 거는 효과(Applies=target)라 자신에게 쓸 수 없습니다`);
      if (applies === 'self' && r.target === 'target') errors.push(`${at}: "${effect.EffectId}"는 자신에게 쓰는 특성(Applies=self)이라 적에게 걸 수 없습니다`);
      if (!implemented.includes(effect.Type)) warnings.push(`${at}: 효과 타입 "${effect.Type}"가 아직 코드에 구현되지 않아 전투에서 아무 일도 일어나지 않습니다`);
    }
    const key = `${r.effectId}|${r.trigger}`;
    if (seen.has(key)) warnings.push(`${at}: 같은 효과·시점의 규칙이 두 번 있습니다 (각각 따로 판정됩니다)`);
    seen.add(key);
  });
  return { errors, warnings };
}

function setUnitEffects(data, unitId, rules) {
  // Replaces every UnitEffectTable row of unitId with the given rules, at the place of its first old row (or at the end).
  // The first row carries the column explanation in #Memo; it moves along if that row is replaced.
  const table = data.unitEffects;
  const old = table.records;
  const memo = old.length ? old[0]['#Memo'] : '';
  const fresh = rules.map((r) => {
    const rec = {};
    for (const h of table.header) rec[h] = '';
    rec.UnitId = unitId; rec.EffectId = r.effectId; rec.Trigger = r.trigger; rec.Target = r.target;
    rec.Chance = r.trigger === 'always' ? '100' : r.chance;
    rec.Duration = r.trigger === 'always' ? '' : r.duration;
    rec.Power = r.power;
    return rec;
  });
  const next = [];
  let placed = false;
  for (const rec of old) {
    if (rec.UnitId !== unitId) { next.push(rec); continue; }
    if (!placed) { next.push(...fresh); placed = true; }
  }
  if (!placed) next.push(...fresh);
  if (memo && next.length && !next[0]['#Memo']) next[0]['#Memo'] = memo;
  const changed = JSON.stringify(old) !== JSON.stringify(next);
  if (changed) { table.records = next; writeTable(table); }
  return changed;
}

// ---------- Mutations ----------

function buildRecord(header, unit, existing) {
  const rec = {};
  for (const h of header) rec[h] = existing && existing[h] != null ? existing[h] : '';
  for (const [k, v] of Object.entries(unit)) if (header.includes(k)) rec[k] = v;
  return rec;
}

function saveUnit(input, opts = {}) {
  // opts.mode: 'add' | 'update' | 'upsert' (default). opts.waves: [{stage,time,level}] replaces this unit's wave rows
  // when given. opts.loopPool: [stageId] replaces this unit's loop-pool membership when given.
  const data = loadAll();
  const unit = normalizeUnit(input);
  const mode = opts.mode || 'upsert';
  const waves = opts.waves != null ? opts.waves : (Array.isArray(input.waves) ? input.waves : null);
  const loopPoolStages = opts.loopPool != null ? opts.loopPool : (Array.isArray(input.loopPool) ? input.loopPool : null);
  const rules = Array.isArray(input.effects) ? normalizeRules(input.effects) : null;

  const result = validateUnit(unit, data, { mode, waves: waves || [], loopPool: loopPoolStages || [] });
  const waveErrors = validateWaves(waves || [], data);
  const poolIds = stageIds(data.stages);
  for (const s of loopPoolStages || []) if (!poolIds.includes(s)) waveErrors.push(`스테이지 "${s}"가 StageTable에 없습니다`);
  result.errors.push(...waveErrors);
  if (rules) {
    const ruleResult = validateEffectRules(unit, rules, data);
    result.errors.push(...ruleResult.errors);
    result.warnings.push(...ruleResult.warnings);
  }
  if (result.errors.length) return { ok: false, ...result, unit };

  const existing = unitById(data.units, unit.UnitId);
  if (!existing) {
    // New row: blank optional columns take the schema default, as the hand-written rows do (Starter 0, Scale 1, ...).
    for (const f of schema.fieldsForKind(unit.Kind)) {
      if (f.default != null && (unit[f.key] == null || unit[f.key] === '')) unit[f.key] = f.default;
    }
  }
  const rec = buildRecord(data.units.header, unit, existing);
  if (existing) {
    const idx = data.units.records.indexOf(existing);
    data.units.records[idx] = rec;
  } else {
    // Keep the base row last if it is last, so the table stays readable.
    const baseIdx = data.units.records.findIndex((r) => r.Kind === 'base');
    if (baseIdx === data.units.records.length - 1 && baseIdx >= 0) data.units.records.splice(baseIdx, 0, rec);
    else data.units.records.push(rec);
  }
  writeTable(data.units);

  const changed = ['UnitTable.csv'];
  if (waves) { setWaves(data, unit.UnitId, waves); changed.push('StageWaveTable.csv'); }
  if (loopPoolStages) { setLoopPool(data, unit.UnitId, loopPoolStages); changed.push('StageTable.csv'); }
  if (rules && setUnitEffects(data, unit.UnitId, rules)) changed.push('UnitEffectTable.csv');

  const fresh = loadAll();
  return { ok: true, created: !existing, errors: [], warnings: result.warnings, unit: rec, status: unitStatus(rec, fresh), changed };
}

function setWaves(data, unitId, waves) {
  // Replaces every StageWaveTable row of unitId with the given list, inserted after the last row of each stage.
  const header = data.waves.header;
  let records = data.waves.records.filter((r) => r.UnitId !== unitId);
  for (const w of waves) {
    const rec = {};
    for (const h of header) rec[h] = '';
    rec.StageId = w.stage; rec.Time = String(w.time); rec.UnitId = unitId; rec.Level = String(w.level == null || w.level === '' ? 1 : w.level);
    let at = -1;
    for (let i = records.length - 1; i >= 0; i--) if (records[i].StageId === w.stage) { at = i; break; }
    if (at < 0) records.push(rec); else records.splice(at + 1, 0, rec);
  }
  // Keep each stage's rows in time order (the game sorts anyway, but the file stays readable).
  const grouped = [];
  const seen = [];
  for (const r of records) {
    if (!seen.includes(r.StageId)) { seen.push(r.StageId); grouped.push([]); }
    grouped[seen.indexOf(r.StageId)].push(r);
  }
  records = grouped.flatMap((g) => g.sort((a, b) => Number(a.Time) - Number(b.Time)));
  data.waves.records = records;
  writeTable(data.waves);
}

function setLoopPool(data, unitId, stages) {
  for (const s of data.stages.records) {
    const pool = loopPool(s).filter((id) => id !== unitId);
    if (stages.includes(s.StageId)) pool.push(unitId);
    const next = pool.join(';');
    if (next !== (s.LoopPool || '')) s.LoopPool = next;
  }
  writeTable(data.stages);
}

function removeUnit(unitId, opts = {}) {
  const data = loadAll();
  const existing = unitById(data.units, unitId);
  if (!existing) return { ok: false, errors: [`UnitId "${unitId}"가 표에 없습니다`] };
  if (!schema.isEditableKind(existing.Kind)) return { ok: false, errors: [`"${unitId}"는 ${existing.Kind} 행이라 지울 수 없습니다`] };
  const status = unitStatus(existing, data);
  if (status.enemy && !opts.force) {
    return { ok: false, errors: [`"${unitId}"는 스테이지 ${status.enemyStages.join(', ')}에 등장합니다. 시간표·루프 풀에서도 지우려면 force를 켜세요`] };
  }
  data.units.records = data.units.records.filter((r) => r !== existing);
  writeTable(data.units);
  const changed = ['UnitTable.csv'];
  if (status.waves.length) { setWaves(data, unitId, []); changed.push('StageWaveTable.csv'); }
  if (status.pools.length) { setLoopPool(data, unitId, []); changed.push('StageTable.csv'); }
  if (status.effects.length && setUnitEffects(data, unitId, [])) changed.push('UnitEffectTable.csv');
  return { ok: true, removed: existing, changed, note: '플레이어 저장 데이터에 이 유닛이 남아 있을 수 있습니다' };
}

// ---------- Effects ----------

const BATTLE_UNIT_MLUA = path.join(ROOT, 'RootDesk', 'MyDesk', 'Battle', 'BattleUnit.mlua');
const KNOWN_EFFECT_TYPES = ['nullify', 'curse', 'warp', 'blow'];

// 게임 코드의 `property number <name> = <value>`를 읽는다 (툴 미리보기가 게임과 같은 배율을 쓰도록). 못 읽으면 fallback.
function readBattleNumber(file, name, fallback) {
  try {
    const m = fs.readFileSync(file, 'utf8').match(new RegExp(`property number ${name}\\s*=\\s*([0-9.]+)`));
    return m ? Number(m[1]) : fallback;
  } catch { return fallback; }
}
const BATTLE_DIR = path.join(ROOT, 'RootDesk', 'MyDesk', 'Battle');

function implementedEffectTypes() {
  // Effect types the game code actually handles: every `effect.type == "<type>"` branch in BattleUnit:ReceiveEffect.
  // Falls back to the known list when the script cannot be read.
  try {
    const src = fs.readFileSync(BATTLE_UNIT_MLUA, 'utf8');
    const found = new Set();
    for (const m of src.matchAll(/effect\.type\s*==\s*"([a-z0-9_]+)"/g)) found.add(m[1]);
    return found.size ? [...found] : KNOWN_EFFECT_TYPES;
  } catch {
    return KNOWN_EFFECT_TYPES;
  }
}

function effectStatus(effect, data, implemented) {
  const usedBy = [...new Set(data.unitEffects.records.filter((r) => r.EffectId === effect.EffectId).map((r) => r.UnitId))];
  return { implemented: implemented.includes(effect.Type), usedBy };
}

function normalizeEffect(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) out[k] = v == null ? '' : String(v).trim();
  return out;
}

function validateEffect(effect, data, opts = {}) {
  const errors = [];
  const warnings = [];
  const implemented = implementedEffectTypes();
  if (!effect.EffectId) errors.push('EffectId가 비어 있습니다');
  else if (!schema.EFFECT_ID_PATTERN.test(effect.EffectId)) errors.push(`EffectId "${effect.EffectId}"는 영문 소문자로 시작하고 소문자·숫자·밑줄만 쓸 수 있습니다`);
  const existing = effect.EffectId ? data.effects.records.find((r) => r.EffectId === effect.EffectId) : null;
  if (existing && opts.mode === 'add') errors.push(`EffectId "${effect.EffectId}"가 이미 있습니다 (덮어쓰려면 update / upsert)`);
  if (!existing && opts.mode === 'update') errors.push(`EffectId "${effect.EffectId}"가 표에 없습니다`);

  for (const f of schema.EFFECT_FIELDS) {
    if (!data.effects.header.includes(f.key)) continue;
    const v = effect[f.key] == null ? '' : String(effect[f.key]);
    if (f.required && v === '') { errors.push(`${f.key}(${f.label})는 필수입니다`); continue; }
    if (v === '') continue;
    if (f.type === 'number' && !isNumeric(v)) errors.push(`${f.key}는 숫자여야 합니다 (현재 "${v}")`);
    if (f.type === 'enum' && !f.enum.includes(v)) errors.push(`${f.key}는 ${f.enum.join(' / ')} 중 하나여야 합니다 (현재 "${v}")`);
  }
  for (const k of Object.keys(effect)) {
    if (!schema.EFFECT_FIELD_BY_KEY[k] && !data.effects.header.includes(k)) errors.push(`"${k}"는 EffectTable에 없는 열입니다`);
  }
  if (effect.Type && !schema.EFFECT_TYPE_PATTERN.test(effect.Type)) errors.push(`Type "${effect.Type}"는 영문 소문자·숫자·밑줄만 쓸 수 있습니다`);
  if (effect.Type && !implemented.includes(effect.Type)) {
    if (!effect['#Memo']) errors.push(`Type "${effect.Type}"는 아직 코드에 없는 타입입니다. 구현 스펙이 되도록 #Memo(효과 설명)를 꼭 적어 주세요`);
    else warnings.push(`Type "${effect.Type}"는 아직 코드에 없습니다 (구현된 타입: ${implemented.join(', ')}). 저장은 되지만 전투에서는 아무 일도 일어나지 않습니다. 메모의 설명으로 Claude에게 구현을 요청하세요`);
  }
  return { errors, warnings, implemented };
}

function saveEffect(input, opts = {}) {
  const data = loadAll();
  const effect = normalizeEffect(input);
  const mode = opts.mode || 'upsert';
  const r = validateEffect(effect, data, { mode });
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings, effect };
  const existing = data.effects.records.find((x) => x.EffectId === effect.EffectId);
  if (!existing) {
    for (const f of schema.EFFECT_FIELDS) if (f.default != null && (effect[f.key] == null || effect[f.key] === '')) effect[f.key] = f.default;
  }
  const rec = buildRecord(data.effects.header, effect, existing);
  if (existing) data.effects.records[data.effects.records.indexOf(existing)] = rec;
  else data.effects.records.push(rec);
  writeTable(data.effects);
  const fresh = loadAll();
  return {
    ok: true, created: !existing, errors: [], warnings: r.warnings, effect: rec,
    status: effectStatus(rec, fresh, r.implemented), changed: ['EffectTable.csv'],
  };
}

function removeEffect(effectId, opts = {}) {
  const data = loadAll();
  const existing = data.effects.records.find((x) => x.EffectId === effectId);
  if (!existing) return { ok: false, errors: [`EffectId "${effectId}"가 표에 없습니다`] };
  const usedBy = [...new Set(data.unitEffects.records.filter((r) => r.EffectId === effectId).map((r) => r.UnitId))];
  if (usedBy.length && !opts.force) return { ok: false, errors: [`"${effectId}"를 쓰는 유닛이 있습니다: ${usedBy.join(', ')}. 그 유닛들의 효과 규칙에서도 지우려면 force를 켜세요`] };
  data.effects.records = data.effects.records.filter((x) => x !== existing);
  writeTable(data.effects);
  const changed = ['EffectTable.csv'];
  if (usedBy.length) {
    data.unitEffects.records = data.unitEffects.records.filter((r) => r.EffectId !== effectId);
    writeTable(data.unitEffects);
    changed.push('UnitEffectTable.csv');
  }
  const note = implementedEffectTypes().includes(existing.Type) ? `코드의 "${existing.Type}" 분기는 그대로 남아 있습니다` : '';
  return { ok: true, removed: existing, clearedUnits: usedBy, changed, note };
}

function listEffects() {
  const data = loadAll();
  const implemented = implementedEffectTypes();
  return data.effects.records.filter((r) => r.EffectId).map((r) => ({ ...r, _status: effectStatus(r, data, implemented) }));
}

function effectTemplate() {
  const t = {};
  for (const f of schema.EFFECT_FIELDS) t[f.key] = f.default != null ? f.default : '';
  return t;
}

function previewValidateEffect(input, opts = {}) {
  const data = loadAll();
  const effect = normalizeEffect(input);
  const r = validateEffect(effect, data, { mode: opts.mode || 'upsert' });
  return { ok: r.errors.length === 0, errors: r.errors, warnings: r.warnings, effect };
}

// ---------- Stages ----------

const MAP_DIR = path.join(ROOT, 'map');

function mapNames() {
  try {
    return fs.readdirSync(MAP_DIR).filter((f) => f.endsWith('.map')).map((f) => f.slice(0, -4)).sort();
  } catch {
    return [];
  }
}

function stageWaves(data, stageId) {
  return data.waves.records
    .filter((w) => w.StageId === stageId)
    .map((w) => ({ time: w.Time, unitId: w.UnitId, level: w.Level === '' ? '1' : w.Level }))
    .sort((a, b) => Number(a.time) - Number(b.time));
}

function stageStatus(stageRec, data) {
  const waves = stageWaves(data, stageRec.StageId);
  const pool = loopPool(stageRec);
  const unitIds = [...new Set([...waves.map((w) => w.unitId), ...pool])];
  const unlockedBy = data.stages.records.filter((s) => s.UnlockStage === stageRec.StageId).map((s) => s.StageId);
  return {
    waves, pool, unitIds,
    waveCount: waves.length,
    lastWaveTime: waves.length ? Number(waves[waves.length - 1].time) : 0,
    mapExists: mapNames().includes(stageRec.MapName || ''),
    unlockedBy,
  };
}

function normalizeStage(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'waves' || k === 'loopPool') continue;
    out[k] = v == null ? '' : String(v).trim();
  }
  return out;
}

function normalizeWaves(waves) {
  return (Array.isArray(waves) ? waves : []).map((w) => ({
    time: w.time == null ? '' : String(w.time).trim(),
    unitId: String(w.unitId || w.unit || w.UnitId || '').trim(),
    level: w.level == null || w.level === '' ? '1' : String(w.level).trim(),
  }));
}

function validateStage(stage, waves, pool, data, opts = {}) {
  const errors = [];
  const warnings = [];
  if (!stage.StageId) errors.push('StageId가 비어 있습니다');
  else if (!schema.STAGE_ID_PATTERN.test(stage.StageId)) errors.push(`StageId "${stage.StageId}"는 영문 소문자로 시작하고 소문자·숫자·밑줄만 쓸 수 있습니다`);
  const existing = stage.StageId ? data.stages.records.find((s) => s.StageId === stage.StageId) : null;
  if (existing && opts.mode === 'add') errors.push(`StageId "${stage.StageId}"가 이미 있습니다 (덮어쓰려면 update / upsert)`);
  if (!existing && opts.mode === 'update') errors.push(`StageId "${stage.StageId}"가 표에 없습니다`);

  for (const f of schema.STAGE_FIELDS) {
    if (!data.stages.header.includes(f.key)) continue;
    const v = stage[f.key] == null ? '' : String(stage[f.key]);
    if (f.required && v === '') { errors.push(`${f.key}(${f.label})는 필수입니다`); continue; }
    if (v === '') continue;
    if (f.type === 'number' && !isNumeric(v)) errors.push(`${f.key}는 숫자여야 합니다 (현재 "${v}")`);
  }
  for (const k of Object.keys(stage)) {
    if (k === 'LoopPool') continue;
    if (!schema.STAGE_FIELD_BY_KEY[k] && !data.stages.header.includes(k)) errors.push(`"${k}"는 StageTable에 없는 열입니다`);
  }
  const maps = mapNames();
  if (stage.MapName && maps.length && !maps.includes(stage.MapName)) errors.push(`맵 "${stage.MapName}"이 map/ 폴더에 없습니다 (있는 맵: ${maps.join(', ')})`);
  if (stage.UnlockStage) {
    if (stage.UnlockStage === stage.StageId) errors.push('UnlockStage가 자기 자신입니다');
    else if (!stageIds(data.stages).includes(stage.UnlockStage)) errors.push(`UnlockStage "${stage.UnlockStage}"가 StageTable에 없습니다`);
  }
  const startI = Number(stage.LoopStartInterval || 6);
  const minI = Number(stage.LoopMinInterval || 3);
  if (minI <= 0) errors.push('LoopMinInterval은 0보다 커야 합니다');
  if (startI < minI) errors.push('LoopStartInterval은 LoopMinInterval 이상이어야 합니다');

  const units = data.units.records;
  const unitOf = (id) => units.find((u) => u.UnitId === id);
  waves.forEach((w, i) => {
    const n = i + 1;
    if (!w.unitId) errors.push(`시간표 ${n}행: 유닛이 비어 있습니다`);
    else {
      const u = unitOf(w.unitId);
      if (!u) errors.push(`시간표 ${n}행: 유닛 "${w.unitId}"가 UnitTable에 없습니다`);
      else if (!schema.isEditableKind(u.Kind)) errors.push(`시간표 ${n}행: "${w.unitId}"(${u.Kind})는 소환할 수 없습니다`);
      else if (u.Kind === 'skill') warnings.push(`시간표 ${n}행: 스킬 "${w.unitId}"은 x=0 지점에 떨어집니다. 전장 위치에 따라 빗나갈 수 있습니다`);
    }
    if (!isNumeric(w.time) || Number(w.time) < 0) errors.push(`시간표 ${n}행: 등장 시각 "${w.time}"이 올바르지 않습니다`);
    if (!isNumeric(w.level) || Number(w.level) < 1 || Number(w.level) % 1 !== 0) errors.push(`시간표 ${n}행: 레벨 "${w.level}"은 1 이상의 정수여야 합니다`);
  });
  pool.forEach((id) => {
    const u = unitOf(id);
    if (!u) errors.push(`반복 풀: 유닛 "${id}"가 UnitTable에 없습니다`);
    else if (u.Kind !== 'monster') warnings.push(`반복 풀: "${id}"(${u.Kind})는 몬스터가 아닙니다. 반복 소환은 몬스터에 맞게 만들어져 있습니다`);
  });
  if (!waves.length && !pool.length) warnings.push('시간표와 반복 풀이 모두 비어 있어 적이 한 마리도 나오지 않습니다');
  if (waves.length && !pool.length) warnings.push('반복 풀이 비어 있어 시간표가 끝나면 적이 더 나오지 않습니다');
  return { errors, warnings };
}

function saveStage(input, opts = {}) {
  // input: StageTable columns + waves: [{time, unitId, level}] + loopPool: [unitId]. waves / loopPool replace the
  // stage's timetable and pool entirely when given; omitted keys keep what is in the files.
  const data = loadAll();
  const stage = normalizeStage(input);
  const mode = opts.mode || 'upsert';
  const existing = data.stages.records.find((s) => s.StageId === stage.StageId);
  const waves = input.waves != null ? normalizeWaves(input.waves) : (existing ? stageWaves(data, stage.StageId) : []);
  const pool = input.loopPool != null ? (Array.isArray(input.loopPool) ? input.loopPool.map((s) => String(s).trim()).filter(Boolean) : []) : (existing ? loopPool(existing) : []);
  const r = validateStage(stage, waves, pool, data, { mode });
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings, stage, waves, loopPool: pool };

  if (!existing) {
    for (const f of schema.STAGE_FIELDS) if (f.default != null && (stage[f.key] == null || stage[f.key] === '')) stage[f.key] = f.default;
  }
  const rec = buildRecord(data.stages.header, stage, existing);
  rec.LoopPool = pool.join(';');
  if (existing) data.stages.records[data.stages.records.indexOf(existing)] = rec;
  else data.stages.records.push(rec);
  writeTable(data.stages);

  // Timetable: replace this stage's rows, keep other stages' rows and their order.
  const header = data.waves.header;
  const others = data.waves.records.filter((w) => w.StageId !== stage.StageId);
  const mine = waves.slice().sort((a, b) => Number(a.time) - Number(b.time)).map((w) => {
    const row = {};
    for (const h of header) row[h] = '';
    row.StageId = stage.StageId; row.Time = w.time; row.UnitId = w.unitId; row.Level = w.level;
    return row;
  });
  let at = -1;
  for (let i = data.waves.records.length - 1; i >= 0; i--) if (data.waves.records[i].StageId === stage.StageId) { at = i; break; }
  if (at < 0) data.waves.records = [...others, ...mine];
  else {
    const before = data.waves.records.slice(0, at + 1).filter((w) => w.StageId !== stage.StageId);
    const after = data.waves.records.slice(at + 1).filter((w) => w.StageId !== stage.StageId);
    data.waves.records = [...before, ...mine, ...after];
  }
  writeTable(data.waves);

  const fresh = loadAll();
  const saved = fresh.stages.records.find((s) => s.StageId === stage.StageId);
  return { ok: true, created: !existing, errors: [], warnings: r.warnings, stage: saved, status: stageStatus(saved, fresh), changed: ['StageTable.csv', 'StageWaveTable.csv'] };
}

function removeStage(stageId, opts = {}) {
  const data = loadAll();
  const existing = data.stages.records.find((s) => s.StageId === stageId);
  if (!existing) return { ok: false, errors: [`StageId "${stageId}"가 표에 없습니다`] };
  const unlockedBy = data.stages.records.filter((s) => s.UnlockStage === stageId).map((s) => s.StageId);
  if (unlockedBy.length && !opts.force) return { ok: false, errors: [`"${stageId}"를 선행 스테이지로 쓰는 스테이지가 있습니다: ${unlockedBy.join(', ')}. 그 칸을 비우면서 지우려면 force를 켜세요`] };
  data.stages.records = data.stages.records.filter((s) => s !== existing);
  for (const s of data.stages.records) if (s.UnlockStage === stageId) s.UnlockStage = '';
  writeTable(data.stages);
  const hadWaves = data.waves.records.some((w) => w.StageId === stageId);
  data.waves.records = data.waves.records.filter((w) => w.StageId !== stageId);
  if (hadWaves) writeTable(data.waves);
  return { ok: true, removed: existing, clearedUnlock: unlockedBy, changed: hadWaves ? ['StageTable.csv', 'StageWaveTable.csv'] : ['StageTable.csv'], note: '플레이어 저장 데이터의 진행도에 이 스테이지가 남아 있을 수 있습니다' };
}

function listStages() {
  const data = loadAll();
  return data.stages.records.filter((s) => s.StageId).map((s) => ({ ...s, _status: stageStatus(s, data) }));
}

function stageTemplate() {
  const t = {};
  for (const f of schema.STAGE_FIELDS) t[f.key] = f.default != null ? f.default : '';
  t.waves = [{ time: 4, unitId: '', level: 1 }];
  t.loopPool = [];
  return t;
}

function previewValidateStage(input, opts = {}) {
  const data = loadAll();
  const stage = normalizeStage(input);
  const existing = data.stages.records.find((s) => s.StageId === stage.StageId);
  const waves = input.waves != null ? normalizeWaves(input.waves) : (existing ? stageWaves(data, stage.StageId) : []);
  const pool = input.loopPool != null ? input.loopPool.map((s) => String(s).trim()).filter(Boolean) : (existing ? loopPool(existing) : []);
  const r = validateStage(stage, waves, pool, data, { mode: opts.mode || 'upsert' });
  return { ok: r.errors.length === 0, errors: r.errors, warnings: r.warnings, stage, waves, loopPool: pool };
}

// ---------- Resource lookup (RUID preview) ----------

const RESOURCE_API = 'https://maplestoryworlds-resourcesearch-new.nexon.com/api/v3/resources/';
const resourceCache = new Map();

async function lookupResource(ruid) {
  // Returns { ok, ruid, type, name, thumbnail, width, height, frameCount } from the public MSW resource API.
  // Results are cached for the process lifetime; failures are cached briefly so a bad RUID does not hammer the API.
  if (!/^[0-9a-f]{32}$/.test(ruid)) return { ok: false, ruid, error: 'RUID 형식이 아닙니다' };
  const hit = resourceCache.get(ruid);
  if (hit && (hit.ok || Date.now() - hit.at < 30000)) return hit;
  let out;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(RESOURCE_API + ruid, { signal: controller.signal, headers: { accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) out = { ok: false, ruid, error: `리소스 API ${res.status}` };
    else {
      const r = await res.json();
      const p = r.payload || {};
      const names = r.names || {};
      const name = (names.ko && names.ko[0]) || (names.en && names.en[0]) || r.dname || '';
      out = { ok: true, ruid, type: r.type || '', category: r.category || '', name, thumbnail: p.thumbnail || '', width: p.width, height: p.height, frameCount: Array.isArray(p.frames) ? p.frames.length : 0,
        // 프레임별 크기와 피벗(px, 왼쪽 아래 기준). 이펙트가 실제로 어디에 놓이는지 미리보기가 계산하는 데 쓴다.
        audio: p.format ? { length: p.length, format: p.format, description: p.description || '' } : null,
        frames: Array.isArray(p.frames) ? p.frames.map((f) => ({ spriteRuid: f.spriteRuid, width: f.width, height: f.height, px: f.pivot ? f.pivot.x : 0, py: f.pivot ? f.pivot.y : 0 })) : [] };
    }
  } catch (e) {
    out = { ok: false, ruid, error: e.name === 'AbortError' ? '리소스 API 응답 없음' : e.message };
  }
  out.at = Date.now();
  resourceCache.set(ruid, out);
  return out;
}

// 프레임 한 장의 PNG(투명 배경). 브라우저가 투명도를 읽으려면 같은 출처에서 줘야 해서 서버가 대신 받아 전달한다.
const SPRITE_CDN = 'https://mod-resource-search-images.dn.nexoncdn.co.kr/maplestory_world/';
const spriteCache = new Map();

async function fetchSprite(ruid) {
  if (!/^[0-9a-f]{32}$/.test(ruid)) return null;
  if (spriteCache.has(ruid)) return spriteCache.get(ruid);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${SPRITE_CDN}${ruid}.png`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (spriteCache.size >= 600) spriteCache.delete(spriteCache.keys().next().value);
    spriteCache.set(ruid, buf);
    return buf;
  } catch {
    return null;
  }
}

// 소리 파일(ogg). 같은 출처로 줘야 브라우저 <audio>가 바로 재생한다.
const audioCache = new Map();

async function fetchAudio(ruid) {
  if (!/^[0-9a-f]{32}$/.test(ruid)) return null;
  if (audioCache.has(ruid)) return audioCache.get(ruid);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${SPRITE_CDN}${ruid}.ogg`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (audioCache.size >= 100) audioCache.delete(audioCache.keys().next().value);
    audioCache.set(ruid, buf);
    return buf;
  } catch {
    return null;
  }
}

// ---------- Views ----------

function listUnits() {
  const data = loadAll();
  return data.units.records.filter((r) => r.UnitId).map((r) => ({ ...r, _status: unitStatus(r, data) }));
}

function getUnit(unitId) {
  const data = loadAll();
  const u = unitById(data.units, unitId);
  return u ? { ...u, _status: unitStatus(u, data) } : null;
}

function templateFor(kind) {
  // Empty JSON a person or Claude can fill: every applicable column, defaults pre-filled.
  const t = {};
  for (const f of schema.fieldsForKind(kind)) t[f.key] = f.key === 'Kind' ? kind : (f.default != null ? f.default : '');
  t.waves = [];
  t.loopPool = [];
  if (kind === 'monster' || kind === 'build') t.effects = [];   // [{ effectId, trigger: on_hit|always, target: target|self, chance, duration, power }]
  return t;
}

function stateForEditor() {
  const data = loadAll();
  const implemented = implementedEffectTypes();
  // Only schema fields whose column exists in the CSV are sent to the page; a column the game code removed
  // disappears from the form by itself, and a column it added shows up as an "extra" field.
  const present = (fields, header) => fields.filter((f) => header.includes(f.key));
  return {
    schema: {
      kinds: schema.KINDS, kindLabels: schema.KIND_LABELS, groups: schema.GROUPS, fields: present(schema.FIELDS, data.units.header),
      enumLabels: schema.ENUM_LABELS, header: data.units.header, ruleTriggers: schema.RULE_TRIGGERS,
      effectFields: present(schema.EFFECT_FIELDS, data.effects.header), effectHeader: data.effects.header, implementedEffectTypes: implemented,
      stageFields: present(schema.STAGE_FIELDS, data.stages.header), stageHeader: data.stages.header, maps: mapNames(),
    },
    units: data.units.records.filter((r) => r.UnitId).map((r) => ({ ...r, _status: unitStatus(r, data) })),
    stages: data.stages.records.filter((s) => s.StageId).map((s) => ({ ...s, _status: stageStatus(s, data) })),
    effects: data.effects.records.filter((e) => e.EffectId).map((e) => ({ ...e, _status: effectStatus(e, data, implemented) })),
    // 스킬 범위 미리보기용: 피해 폭 = SkillRadius × RangeScale × 2, 범위 박스 높이 = SkillBoxHeight
    battle: {
      rangeScale: readBattleNumber(path.join(BATTLE_DIR, 'BattleConfig.mlua'), 'RangeScale', 0.65),
      unitScale: readBattleNumber(path.join(BATTLE_DIR, 'BattleConfig.mlua'), 'UnitScale', 0.65),
      skillBoxHeight: readBattleNumber(path.join(BATTLE_DIR, 'FieldFx.mlua'), 'SkillBoxHeight', 1.2),
      multiSpawnInterval: readBattleNumber(path.join(BATTLE_DIR, 'BattleConfig.mlua'), 'MultiSpawnInterval', 0.25),
    },
    files: FILES,
  };
}

function previewValidate(input, opts = {}) {
  const data = loadAll();
  const unit = normalizeUnit(input);
  const waves = Array.isArray(input.waves) ? input.waves : [];
  const loopPoolStages = Array.isArray(input.loopPool) ? input.loopPool : [];
  const r = validateUnit(unit, data, { mode: opts.mode || 'upsert', waves, loopPool: loopPoolStages });
  r.errors.push(...validateWaves(waves, data));
  if (Array.isArray(input.effects)) {
    const ruleResult = validateEffectRules(unit, normalizeRules(input.effects), data);
    r.errors.push(...ruleResult.errors);
    r.warnings.push(...ruleResult.warnings);
  }
  const ids = stageIds(data.stages);
  for (const s of loopPoolStages) if (!ids.includes(s)) r.errors.push(`스테이지 "${s}"가 StageTable에 없습니다`);
  return { ok: r.errors.length === 0, ...r, unit };
}

module.exports = {
  ROOT, DATA_DIR, FILES,
  parseCsv, serializeCsv, readTable, writeTable,
  loadAll, listUnits, getUnit, unitStatus, templateFor, stateForEditor,
  normalizeUnit, validateUnit, previewValidate, saveUnit, removeUnit,
  implementedEffectTypes, listEffects, effectTemplate, previewValidateEffect, saveEffect, removeEffect,
  mapNames, listStages, stageTemplate, previewValidateStage, saveStage, removeStage,
  lookupResource, fetchSprite, fetchAudio,
};
