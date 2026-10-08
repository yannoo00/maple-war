import { useState } from 'react';
import Field, { ExtraFields } from '../Field.jsx';
import { Badge } from '../ui.jsx';

const ELEMENTS = ['earth', 'water', 'fire', 'wind', 'light', 'dark'];

// 코드에 없는 효과 타입을 Claude에게 구현시키기 위한 요청 글
function requestText(e) {
  const chance = ELEMENTS.map((a) => `${a} ${e['Chance' + a[0].toUpperCase() + a.slice(1)] || 0}%`).join(', ');
  return `EffectTable에 새 효과 "${e.EffectId}"(Type=${e.Type}, 이름 "${e.Name}")를 추가했어. 아직 코드에 없는 타입이야. 아래 설명대로 BattleUnit:ReceiveEffect에 구현해줘.\n` +
    `- 지속 시간 ${e.Duration || 0}초, 세기(Power) ${e.Power || 0}, 속성별 확률: ${chance}\n` +
    `- 설명: ${e['#Memo'] || '(메모 없음)'}\n` +
    `구현 뒤 add-unit 스킬의 effect types로 타입이 인식되는지 확인하고, 플레이 로그로 효과가 걸리는 걸 보여줘.`;
}

export function EffectBadges({ draft, data, originalId }) {
  const implemented = data.schema.implementedEffectTypes.includes(draft.Type);
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
  const implemented = schema.implementedEffectTypes.includes(draft.Type);

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
          구현된 타입: {schema.implementedEffectTypes.map((t) => <code key={t}>{t} </code>)}
          — 다른 타입을 적으면 "미구현"으로 저장되고, 메모의 설명이 구현 스펙이 됩니다. 확률은 <b>맞은 유닛의 속성</b> 기준입니다.
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
