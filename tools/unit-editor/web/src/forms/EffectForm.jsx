import { useState } from 'react';
import Field, { ExtraFields } from '../Field.jsx';
import { Badge } from '../ui.jsx';

// 코드에 없는 효과 타입을 Claude에게 구현시키기 위한 요청 글
function requestText(e) {
  return `EffectTable에 새 효과 "${e.EffectId}"(이름 "${e.Name}")를 추가했어. 아직 코드에 없어. 아래 설명대로 BattleEffects.mlua의 GetDefs에 "${e.EffectId}" 항목으로 구현해줘.\n` +
    `- 기본 지속 시간 ${e.Duration || 0}초, 세기(Power) ${e.Power || 0}, 쓸 수 있는 대상(Applies) ${e.Applies || 'target'}\n` +
    `- 설명: ${e['#Memo'] || '(메모 없음)'}\n` +
    `걸리는 시점·확률은 효과가 아니라 몬스터의 효과 규칙(UnitEffectTable)이 정해. 구현 뒤 add-unit 스킬의 effect types로 이 ID가 인식되는지 확인해줘.`;
}

export function EffectBadges({ draft, data, originalId }) {
  const implemented = data.schema.implementedEffectTypes.includes(draft.EffectId);
  const usedBy = data.effects.find((e) => e.EffectId === originalId)?._status.usedBy ?? [];
  return (
    <>
      {implemented ? <Badge type="ok">구현됨</Badge> : <Badge type="warn">미구현 · 설명만 저장됨</Badge>}
      {usedBy.length > 0 && <Badge type="none">사용: {usedBy.join(', ')}</Badge>}
    </>
  );
}

export default function EffectForm({ draft, set, data }) {
  const { schema } = data;
  const [copied, setCopied] = useState(false);
  const implemented = schema.implementedEffectTypes.includes(draft.EffectId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestText(draft));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 클립보드가 막혀도 글은 선택해서 복사할 수 있다 */ }
  };

  return (
    <>
      <fieldset>
        <legend>효과</legend>
        <div className="muted" style={{ marginBottom: 8 }}>
          구현된 효과: {schema.implementedEffectTypes.map((t) => <code key={t}>{t} </code>)}
          — 효과 ID가 곧 코드의 이름입니다. 새 ID는 "미구현"으로 저장되고, 메모의 설명이 구현 스펙이 됩니다. 효과는 <b>무엇을 하는지</b>만 정합니다. 어느 몬스터가 언제·몇 %로 거는지는 몬스터의 효과 규칙에서 정합니다.
        </div>
        <div className="grid">
          {schema.effectFields.map((f) => (
            <Field key={f.key} field={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} schema={schema} data={data} />
          ))}
        </div>
      </fieldset>
      <ExtraFields header={schema.effectHeader} known={schema.effectFields.map((f) => f.key)} draft={draft} set={set} />
      {!implemented && (
        <fieldset>
          <legend>Claude에게 구현 요청하기</legend>
          <div className="muted">저장한 뒤 아래 글을 복사해 Claude 세션에 붙여 넣으면 됩니다.</div>
          <div className="clip"><pre>{requestText(draft)}</pre><button onClick={copy}>{copied ? '복사됨' : '복사'}</button></div>
        </fieldset>
      )}
    </>
  );
}
