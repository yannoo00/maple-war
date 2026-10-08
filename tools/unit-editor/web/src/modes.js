// 유닛 / 스테이지 / 효과는 "목록 → 초안 편집 → 검사·저장·삭제" 흐름이 같다.
// 서로 다른 부분만 모드별 설정으로 모아 둔다.

const fromHeader = (header, item) => Object.fromEntries(header.map((h) => [h, item?.[h] ?? '']));
const withDefaults = (fields, draft, kind) => {
  for (const f of fields) if ((!kind || f.kinds.includes(kind)) && f.default != null) draft[f.key] = f.default;
  return draft;
};
const savedText = (r) => `저장됨: ${r.changed.join(', ')} — Maker에서 refresh 하면 반영됩니다`;

export const MODES = {
  units: {
    label: '유닛', newLabel: '새 유닛', api: 'unit', list: 'units', idKey: 'UnitId', file: 'units', cloneable: true,
    empty: '왼쪽에서 유닛을 고르거나 "새 유닛"을 누르세요.',
    noun: (draft, schema) => schema.kindLabels[draft.Kind],
    open: (item, schema) => fromHeader(schema.header, item),
    blank(schema, kind, from) {
      const draft = from ? fromHeader(schema.header, from) : withDefaults(schema.fields, fromHeader(schema.header), kind);
      return { ...draft, Kind: kind, UnitId: '', ...(from && { '#Memo': '' }) };
    },
    payload: (draft) => draft,   // 스테이지 등장은 스테이지 모드에서 고치므로 유닛 저장은 스테이지 파일을 건드리지 않는다.
    savedText,
    deleteText: (item) => item._status.enemy
      ? `"${item.UnitId}"를 지우고 스테이지 ${item._status.enemyStages.join(', ')}의 시간표·반복 풀에서도 뺄까요?`
      : `"${item.UnitId}"를 지울까요?`,
  },

  stages: {
    label: '스테이지', newLabel: '새 스테이지', api: 'stage', list: 'stages', idKey: 'StageId', file: 'stages', cloneable: true,
    empty: '왼쪽에서 스테이지를 고르거나 "새 스테이지"를 누르세요.',
    noun: () => '스테이지',
    open(item, schema) {
      const draft = fromHeader(schema.stageHeader.filter((h) => h !== 'LoopPool'), item);
      return { ...draft, waves: item._status.waves.map((w) => ({ ...w })), loopPool: [...item._status.pool] };
    },
    blank(schema, kind, from) {
      if (from) return { ...this.open(from, schema), StageId: '', Name: '', '#Memo': '' };
      const draft = fromHeader(schema.stageHeader.filter((h) => h !== 'LoopPool'));
      return { ...withDefaults(schema.stageFields, draft), waves: [], loopPool: [] };
    },
    payload: (draft) => ({ ...draft, waves: draft.waves.map((w) => ({ time: w.time, unitId: w.unitId, level: w.level === '' ? 1 : w.level })) }),
    savedText,
    deleteText: (item) => item._status.unlockedBy.length
      ? `"${item.StageId}"를 지우면 이를 선행 스테이지로 쓰는 ${item._status.unlockedBy.join(', ')}의 선행 칸이 비워집니다. 시간표도 함께 지웁니다. 계속할까요?`
      : `"${item.StageId}"와 그 시간표를 지울까요?`,
  },

  effects: {
    label: '효과', newLabel: '새 효과', api: 'effect', list: 'effects', idKey: 'EffectId', file: 'effects', cloneable: false,
    empty: '왼쪽에서 효과를 고르거나 "새 효과"를 누르세요.',
    noun: () => '효과',
    open: (item, schema) => fromHeader(schema.effectHeader, item),
    blank: (schema) => withDefaults(schema.effectFields, fromHeader(schema.effectHeader)),
    payload: (draft) => draft,
    savedText: (r) => r.status.implemented ? savedText(r) : `저장됨: ${r.changed.join(', ')} — 미구현 타입이므로 아래 요청 글을 Claude에게 보내 구현을 받으세요`,
    deleteText: (item) => item._status.usedBy.length
      ? `"${item.EffectId}"를 지우고 이 효과를 쓰는 유닛(${item._status.usedBy.join(', ')})의 Effect 칸도 비울까요?`
      : `"${item.EffectId}"를 지울까요?`,
  },
};
