import Field, { ExtraFields } from '../Field.jsx';
import SkillPreview from './SkillPreview.jsx';
import AttackEffectPreview from './AttackEffectPreview.jsx';
import AttackRangePreview from './AttackRangePreview.jsx';

// 유닛 편집 상단 줄에는 이름 외에 배지를 두지 않는다(획득 방법·등장 스테이지는 목록과 스테이지 편집에서 본다).
export function UnitBadges() {
  return null;
}

// 몬스터·설치물의 효과 규칙: 언제(시점) · 누구에게(대상) · 몇 %로. 효과 자체(무엇을 하는지)는 효과 표에서 정한다.
const NEW_RULE = { effectId: '', trigger: 'on_hit', target: 'target', chance: '20', duration: '', power: '' };

function EffectRules({ draft, set, data }) {
  const rules = draft.effects || [];
  const triggers = data.schema.ruleTriggers;
  const update = (i, patch) => set('effects', rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const changeTrigger = (i, id) => {
    const t = triggers.find((x) => x.id === id);
    update(i, { trigger: id, target: t.target, chance: id === 'on_hit' ? (rules[i].chance && rules[i].chance !== '100' ? rules[i].chance : '20') : '100' });
  };
  return (
    <fieldset>
      <legend>효과 규칙 — 언제 · 누구에게 · 몇 %로 (한 유닛에 여러 개)</legend>
      <div className="muted">
        효과 표는 효과가 "무엇을 하는지"만 정하고, 걸리는 조건은 여기서 정합니다. <b>공격 시</b> = 이 유닛의 공격이 적에게 피해를 줄 때 확률(%)로 맞은 적에게.
        <b> 항상</b> = 생성될 때 자신에게(특성, 사는 동안 지속; 확률 칸은 괴력처럼 확률로 발동하는 특성의 발동 확률, 보통 100). 지속·세기는 비우면 효과 표의 값을 씁니다.
      </div>
      <table className="waves" style={{ maxWidth: 820, marginTop: 8 }}>
        <thead><tr><th>효과</th><th style={{ width: 130 }}>시점</th><th style={{ width: 70 }}>대상</th><th style={{ width: 80 }}>확률(%)</th><th style={{ width: 80 }}>지속(초)</th><th style={{ width: 70 }}>세기</th><th style={{ width: 60 }} /></tr></thead>
        <tbody>
          {rules.length === 0 && <tr><td colSpan={7} className="muted">효과 없음 — "규칙 추가"</td></tr>}
          {rules.map((r, i) => {
            const effect = data.effects.find((e) => e.EffectId === r.effectId);
            const always = r.trigger === 'always';
            return (
              <tr key={i}>
                <td>
                  <select value={r.effectId} onChange={(e) => update(i, { effectId: e.target.value })}>
                    <option value="">(선택)</option>
                    {data.effects.map((e) => <option key={e.EffectId} value={e.EffectId}>{e.Name} ({e.EffectId}{e._status.implemented ? '' : ' · 미구현'})</option>)}
                  </select>
                </td>
                <td>
                  <select value={r.trigger} onChange={(e) => changeTrigger(i, e.target.value)}>
                    {triggers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </td>
                <td>{r.target === 'self' ? '자신' : '맞은 적'}</td>
                <td><input type="text" inputMode="decimal" value={always && r.chance === '' ? '100' : r.chance} onChange={(e) => update(i, { chance: e.target.value })} /></td>
                <td><input type="text" inputMode="decimal" value={always ? '' : r.duration} disabled={always} placeholder={effect ? effect.Duration : ''} onChange={(e) => update(i, { duration: e.target.value })} /></td>
                <td><input type="text" inputMode="decimal" value={r.power} placeholder={effect ? effect.Power : ''} onChange={(e) => update(i, { power: e.target.value })} /></td>
                <td><button onClick={() => set('effects', rules.filter((_, j) => j !== i))}>삭제</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 6 }}><button onClick={() => set('effects', [...rules, { ...NEW_RULE }])}>규칙 추가</button></div>
    </fieldset>
  );
}

// 한 번에 여러 마리(군단)를 소환하는 몬스터: 몇 초에 걸쳐 나오는지와 마나 비교를 한 줄로 보여 준다.
function SpawnHint({ draft, battle }) {
  const count = Number(draft.SpawnCount);
  if (!(count > 1)) return null;
  const total = (count - 1) * battle.multiSpawnInterval;
  return (
    <div className="muted" style={{ marginTop: 10 }}>
      {count}마리가 {total.toFixed(2)}초에 걸쳐 나옵니다(간격 {battle.multiSpawnInterval}초 고정). 카드 마나 {draft.Cost || '?'} 한 번에 {count}마리가 모두 나옵니다. 마리당 능력치는 이 행의 값이니 마나 비용과 함께 균형을 맞추세요.
    </div>
  );
}

export default function UnitForm({ draft, set, data }) {
  const { schema } = data;
  const kind = draft.Kind;
  const known = schema.fields.map((f) => f.key);
  return (
    <>
      {schema.groups.filter((g) => g.kinds.includes(kind)).map((g) => (
        <fieldset key={g.id}>
          <legend>{g.label}</legend>
          <div className="grid">
            {schema.fields.filter((f) => f.group === g.id && f.kinds.includes(kind)).map((f) => (
              <Field key={f.key} field={f} kind={kind} value={draft[f.key]} onChange={(v) => set(f.key, v)} schema={schema} data={data} />
            ))}
          </div>
          {g.id === 'skill' && <div style={{ marginTop: 12 }}><SkillPreview draft={draft} set={set} data={data} /></div>}
          {g.id === 'fx' && <div style={{ marginTop: 12 }}><AttackEffectPreview draft={draft} set={set} data={data} /></div>}
          {g.id === 'fx' && (kind === 'monster' || kind === 'build') && <div style={{ marginTop: 16 }}><AttackRangePreview draft={draft} set={set} data={data} /></div>}
          {g.id === 'card' && <SpawnHint draft={draft} battle={data.battle} />}
        </fieldset>
      ))}
      {(kind === 'monster' || kind === 'build') && <EffectRules draft={draft} set={set} data={data} />}
      <ExtraFields header={schema.header} known={known} draft={draft} set={set} />
    </>
  );
}
