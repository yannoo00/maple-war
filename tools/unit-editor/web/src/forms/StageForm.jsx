import { useState } from 'react';
import Field, { ExtraFields } from '../Field.jsx';
import { Badge, Thumb } from '../ui.jsx';

const thumbRuid = (u) => (u ? (u.Kind === 'skill' ? u.EffectRuid : u.StandRuid) : '');

export function StageBadges({ draft, data }) {
  const times = draft.waves.map((w) => Number(w.time)).filter(Number.isFinite);
  const units = new Set([...draft.waves.map((w) => w.unitId), ...draft.loopPool].filter(Boolean));
  const mapOk = !draft.MapName || data.schema.maps.includes(draft.MapName);
  return (
    <>
      <Badge type="enemy">시간표 {draft.waves.length}개 · 마지막 {times.length ? Math.max(...times) : 0}초</Badge>
      <Badge type="none">유닛 {units.size}종</Badge>
      {draft.loopPool.length ? <Badge type="none">반복 {draft.loopPool.length}</Badge> : <Badge type="warn">반복 풀 없음</Badge>}
      {!mapOk && <Badge type="warn">맵 없음</Badge>}
    </>
  );
}

// 유닛 종류별로 묶은 <option> 목록
function UnitSelect({ units, schema, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(선택)</option>
      {schema.kinds.map((k) => {
        const items = units.filter((u) => u.Kind === k);
        return items.length > 0 && (
          <optgroup key={k} label={schema.kindLabels[k]}>
            {items.map((u) => <option key={u.UnitId} value={u.UnitId}>{u.Name} ({u.UnitId})</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

function Timeline({ waves, loopCount, units }) {
  const times = waves.map((w) => Number(w.time)).filter(Number.isFinite);
  const max = Math.max(10, ...times) * 1.08;
  const step = max > 120 ? 30 : max > 60 ? 15 : max > 30 ? 10 : 5;
  const ticks = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  const pos = (t) => `${(t / max) * 100}%`;
  return (
    <div className="timeline">
      {ticks.map((t) => <span key={t} className="tick" style={{ left: pos(t) }}>{t}s</span>)}
      {waves.map((w, i) => {
        const t = Number(w.time);
        if (!Number.isFinite(t)) return null;
        const lv = Number(w.level) > 1;
        const unit = units.find((u) => u.UnitId === w.unitId);
        return (
          <span key={i} className={`mark ${lv ? 'lv' : ''}`} style={{ left: pos(t) }} title={`${unit ? unit.Name : w.unitId} · ${t}초`}>
            <Thumb ruid={thumbRuid(unit)} /><span>{t}s</span>{lv && <b>Lv{w.level}</b>}
          </span>
        );
      })}
      {loopCount > 0 && <span className="loop">→ 반복 풀 {loopCount}</span>}
    </div>
  );
}

export default function StageForm({ draft, set, data, originalId }) {
  const { schema, units } = data;
  const [poolPick, setPoolPick] = useState('');
  const { waves, loopPool } = draft;

  const setWaves = (next) => set('waves', next);
  const updateWave = (i, key, value) => setWaves(waves.map((w, j) => (j === i ? { ...w, [key]: value } : w)));
  const addWave = () => {
    const last = waves[waves.length - 1];
    setWaves([...waves, { time: String(last ? (Number(last.time) || 0) + 5 : 4), unitId: last ? last.unitId : '', level: last ? last.level : '1' }]);
  };
  const dupWave = (i) => {
    const w = waves[i];
    setWaves([...waves.slice(0, i + 1), { ...w, time: String((Number(w.time) || 0) + 5) }, ...waves.slice(i + 1)]);
  };
  const sortWaves = () => setWaves([...waves].sort((a, b) => Number(a.time) - Number(b.time)));
  const addPool = () => { if (poolPick) set('loopPool', [...loopPool, poolPick]); };
  const unitById = (id) => units.find((u) => u.UnitId === id);

  return (
    <>
      <fieldset>
        <legend>스테이지</legend>
        <div className="grid">
          {schema.stageFields.map((f) => (
            <Field key={f.key} field={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} schema={schema} data={data} selfId={originalId} />
          ))}
        </div>
      </fieldset>
      <ExtraFields header={schema.stageHeader.filter((h) => h !== 'LoopPool')} known={schema.stageFields.map((f) => f.key)} draft={draft} set={set} />

      <fieldset>
        <legend>시간표 — 전투 시작 후 몇 초에 무엇을 소환하는가</legend>
        <div className="muted">위에서부터 시간 순으로 한 번씩 소환됩니다. 저장할 때 시간순으로 정렬됩니다.</div>
        <Timeline waves={waves} loopCount={loopPool.length} units={units} />
        <table className="waves" style={{ maxWidth: 640, marginTop: 22 }}>
          <thead><tr><th style={{ width: 110 }}>시각(초)</th><th>유닛</th><th style={{ width: 70 }}>레벨</th><th style={{ width: 120 }} /></tr></thead>
          <tbody>
            {waves.length === 0 && <tr><td colSpan={4} className="muted">비어 있음 — "행 추가"</td></tr>}
            {waves.map((w, i) => (
              <tr key={i}>
                <td><input type="text" inputMode="decimal" value={w.time} onChange={(e) => updateWave(i, 'time', e.target.value)} /></td>
                <td><UnitSelect units={units} schema={schema} value={w.unitId} onChange={(v) => updateWave(i, 'unitId', v)} /></td>
                <td><input type="text" inputMode="numeric" value={w.level ?? ''} onChange={(e) => updateWave(i, 'level', e.target.value)} /></td>
                <td><button onClick={() => dupWave(i)}>복제</button> <button onClick={() => setWaves(waves.filter((_, j) => j !== i))}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}><button onClick={addWave}>행 추가</button><button onClick={sortWaves}>시간순 정렬</button></div>
      </fieldset>

      <fieldset>
        <legend>반복 풀 — 시간표가 끝난 뒤 무작위로 계속 소환</legend>
        <div className="muted">같은 유닛을 여러 번 넣으면 그만큼 자주 나옵니다(가중치). 간격은 위의 "반복 시작 간격"에서 시작해 소환마다 0.3초씩 줄어 "반복 최소 간격"까지 내려갑니다.</div>
        <div className="chips">
          {loopPool.length === 0 && <span className="muted">비어 있음</span>}
          {loopPool.map((id, i) => {
            const u = unitById(id);
            return (
              <span key={i} className="chip">
                <Thumb ruid={thumbRuid(u)} />
                {u ? `${u.Name} (${id} · ${schema.kindLabels[u.Kind] || u.Kind})` : `${id} (없음)`}
                <button title="빼기" onClick={() => set('loopPool', loopPool.filter((_, j) => j !== i))}>×</button>
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, maxWidth: 480 }}>
          <UnitSelect units={units} schema={schema} value={poolPick} onChange={setPoolPick} />
          <button onClick={addPool}>풀에 추가</button>
        </div>
      </fieldset>
    </>
  );
}
