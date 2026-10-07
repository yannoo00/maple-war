#!/usr/bin/env node
'use strict';
// Unit editor CLI — the entry point Claude (or a script) uses to add / update / remove units.
//
//   node tools/unit-editor/cli.cjs list [kind]              units with derived ally / enemy status
//   node tools/unit-editor/cli.cjs show <unitId>            one unit as JSON (plus status)
//   node tools/unit-editor/cli.cjs schema [kind]            field definitions (labels, enums, required)
//   node tools/unit-editor/cli.cjs template <kind>          empty JSON to fill (monster | build | skill)
//   node tools/unit-editor/cli.cjs validate <file.json>     check without writing
//   node tools/unit-editor/cli.cjs add <file.json>          add a new unit (fails if UnitId exists)
//   node tools/unit-editor/cli.cjs update <file.json>       update an existing unit (fails if missing)
//   node tools/unit-editor/cli.cjs upsert <file.json>       add or update
//   node tools/unit-editor/cli.cjs remove <unitId> [--force] remove (force also removes stage appearances)
//
//   node tools/unit-editor/cli.cjs effect list                 effects with implemented / usedBy status
//   node tools/unit-editor/cli.cjs effect show <effectId>
//   node tools/unit-editor/cli.cjs effect template            empty EffectTable JSON to fill
//   node tools/unit-editor/cli.cjs effect validate <file.json>
//   node tools/unit-editor/cli.cjs effect add|update|upsert <file.json>
//   node tools/unit-editor/cli.cjs effect remove <effectId> [--force]  (force also clears units' Effect cells)
//   node tools/unit-editor/cli.cjs effect types               effect types the game code implements
//
//   node tools/unit-editor/cli.cjs stage list                  stages with wave count / pool / map check
//   node tools/unit-editor/cli.cjs stage show <stageId>        StageTable row + timetable + pool
//   node tools/unit-editor/cli.cjs stage template             empty stage JSON to fill
//   node tools/unit-editor/cli.cjs stage validate <file.json>
//   node tools/unit-editor/cli.cjs stage add|update|upsert <file.json>
//   node tools/unit-editor/cli.cjs stage remove <stageId> [--force]  (force also clears UnlockStage references)
//   Stage JSON = StageTable columns + "waves": [{ "time": 4, "unitId": "slime", "level": 1 }] (replaces the whole
//   timetable) + "loopPool": ["slime", "slime", "spirit"] (repeats = weight). Omit either key to keep the file's.
//
//   node tools/unit-editor/cli.cjs resource <ruid>            type / name / thumbnail of a RUID (public MSW API)
//
// The unit JSON uses UnitTable column names as keys. Two extra keys are accepted as shortcuts:
//   "waves":    [{ "stage": "stage3", "time": 12, "level": 2 }]  → replaces this unit's StageWaveTable rows
//   "loopPool": ["stage3"]                                        → replaces this unit's StageTable.LoopPool membership
// Omit them to leave stage appearances untouched. Pass [] to clear.
// Exit code 0 = ok, 1 = validation error or unknown command, 2 = file error.

const fs = require('node:fs');
const schema = require('./schema.cjs');
const data = require('./unitdata.cjs');

function out(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }

function readJson(file) {
  if (!file) { console.error('JSON 파일 경로가 필요합니다'); process.exit(1); }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    console.error(`JSON을 읽을 수 없습니다: ${file}\n${e.message}`);
    process.exit(2);
  }
}

function printResult(r) {
  out(r);
  if (!r.ok) process.exit(1);
}

const [cmd, arg, ...rest] = process.argv.slice(2);

switch (cmd) {
  case 'list': {
    const list = data.listUnits().filter((u) => !arg || u.Kind === arg);
    const rows = list.map((u) => ({
      UnitId: u.UnitId, Kind: u.Kind, Name: u.Name, Rarity: u.Rarity, Cost: u.Cost, Price: u.Price, Starter: u.Starter,
      ally: u._status.ally, enemyStages: u._status.enemyStages,
    }));
    out(rows);
    break;
  }
  case 'show': {
    const u = data.getUnit(arg);
    if (!u) { console.error(`UnitId "${arg}"가 없습니다`); process.exit(1); }
    out(u);
    break;
  }
  case 'schema': {
    const fields = arg ? schema.fieldsForKind(arg) : schema.FIELDS;
    if (arg && !schema.isEditableKind(arg)) { console.error(`kind는 ${schema.KINDS.join(' / ')} 중 하나`); process.exit(1); }
    out({ kinds: schema.KINDS, groups: schema.GROUPS, fields: fields.map((f) => ({
      key: f.key, label: f.label, group: f.group, type: f.type, enum: f.enum, required: f.required || [], kinds: f.kinds,
      default: f.default, help: f.help,
    })) });
    break;
  }
  case 'template': {
    if (!schema.isEditableKind(arg)) { console.error(`kind는 ${schema.KINDS.join(' / ')} 중 하나`); process.exit(1); }
    out(data.templateFor(arg));
    break;
  }
  case 'validate': {
    const input = readJson(arg);
    const mode = rest.includes('--add') ? 'add' : rest.includes('--update') ? 'update' : 'upsert';
    printResult(data.previewValidate(input, { mode }));
    break;
  }
  case 'add':
  case 'update':
  case 'upsert': {
    const input = readJson(arg);
    printResult(data.saveUnit(input, { mode: cmd }));
    break;
  }
  case 'remove': {
    printResult(data.removeUnit(arg, { force: rest.includes('--force') }));
    break;
  }
  case 'effect': {
    const [sub, target, ...more] = [arg, ...rest];
    if (sub === 'list') {
      out(data.listEffects().map((e) => ({ EffectId: e.EffectId, Type: e.Type, Name: e.Name, Duration: e.Duration, Power: e.Power, implemented: e._status.implemented, usedBy: e._status.usedBy })));
    } else if (sub === 'show') {
      const e = data.listEffects().find((x) => x.EffectId === target);
      if (!e) { console.error(`EffectId "${target}"가 없습니다`); process.exit(1); }
      out(e);
    } else if (sub === 'template') {
      out(data.effectTemplate());
    } else if (sub === 'types') {
      out(data.implementedEffectTypes());
    } else if (sub === 'validate') {
      const mode = more.includes('--add') ? 'add' : more.includes('--update') ? 'update' : 'upsert';
      printResult(data.previewValidateEffect(readJson(target), { mode }));
    } else if (sub === 'add' || sub === 'update' || sub === 'upsert') {
      printResult(data.saveEffect(readJson(target), { mode: sub }));
    } else if (sub === 'remove') {
      printResult(data.removeEffect(target, { force: more.includes('--force') }));
    } else {
      console.error('effect 하위 명령: list | show | template | types | validate | add | update | upsert | remove');
      process.exit(1);
    }
    break;
  }
  case 'stage': {
    const [sub, target, ...more] = [arg, ...rest];
    if (sub === 'list') {
      out(data.listStages().map((s) => ({ StageId: s.StageId, Name: s.Name, MapName: s.MapName, mapExists: s._status.mapExists, BaseHp: s.BaseHp, EntryCost: s.EntryCost, UnlockStage: s.UnlockStage, waves: s._status.waveCount, lastWaveTime: s._status.lastWaveTime, loopPool: s._status.pool })));
    } else if (sub === 'show') {
      const s = data.listStages().find((x) => x.StageId === target);
      if (!s) { console.error(`StageId "${target}"가 없습니다`); process.exit(1); }
      out(s);
    } else if (sub === 'template') {
      out(data.stageTemplate());
    } else if (sub === 'validate') {
      const mode = more.includes('--add') ? 'add' : more.includes('--update') ? 'update' : 'upsert';
      printResult(data.previewValidateStage(readJson(target), { mode }));
    } else if (sub === 'add' || sub === 'update' || sub === 'upsert') {
      printResult(data.saveStage(readJson(target), { mode: sub }));
    } else if (sub === 'remove') {
      printResult(data.removeStage(target, { force: more.includes('--force') }));
    } else {
      console.error('stage 하위 명령: list | show | template | validate | add | update | upsert | remove');
      process.exit(1);
    }
    break;
  }
  case 'resource': {
    data.lookupResource(arg).then((r) => { out(r); if (!r.ok) process.exit(1); });
    break;
  }
  default: {
    console.error(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    process.exit(cmd ? 1 : 0);
  }
}
