import { useState } from 'react';
import { api } from '../api.js';
import { MODES } from '../modes.js';
import { Thumb } from '../ui.jsx';
import { unitIconRuid } from '../unit.js';

const KIND_TABS = [['', '전체'], ['monster', '몬스터'], ['build', '설치물'], ['skill', '스킬']];
const COLUMNS = [
  { key: 'Name', label: '이름', type: 'text' },
  { key: 'Kind', label: '종류' },
  { key: 'Rarity', label: '등급', type: 'enum' },
  { key: 'Cost', label: '코스트', type: 'number' },
  { key: 'Attack', label: '공격력', type: 'number' },
  { key: 'MaxHp', label: '체력', type: 'number' },
  { key: 'AttackType', label: '공격타입', type: 'enum' },
];

// 요약 표: 몬스터/설치물/스킬을 한 표에서 보고 바로 고친다. 저장은 유닛 편집과 같은 검증·저장 API를 쓴다.
export default function UnitTable({ data, edits, setEdits, filterKind, setFilterKind, search, setSearch, onOpen, onSaved }) {
  const { schema } = data;
  const [sort, setSort] = useState({ key: '', dir: 1 });
  const [errors, setErrors] = useState({});   // UnitId -> 메시지 목록
  const [busy, setBusy] = useState(false);
  const fieldOf = (key) => schema.fields.find((f) => f.key === key);
  const editable = (u, key) => fieldOf(key)?.kinds.includes(u.Kind);
  const value = (u, key) => edits[u.UnitId]?.[key] ?? u[key] ?? '';

  const q = search.trim().toLowerCase();
  let rows = data.units
    .filter((u) => schema.kinds.includes(u.Kind) && (!filterKind || u.Kind === filterKind))
    .filter((u) => !q || u.UnitId.toLowerCase().includes(q) || (u.Name || '').toLowerCase().includes(q));
  if (sort.key) {
    const num = ['Cost', 'Attack', 'MaxHp'].includes(sort.key);
    const order = sort.key === 'Rarity' ? schema.fields.find((f) => f.key === 'Rarity').enum : null;
    const k = (u) => { const v = value(u, sort.key); return order ? order.indexOf(v) : num ? (v === '' ? -Infinity : Number(v)) : v; };
    rows = [...rows].sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0) * sort.dir);
  }

  const edit = (id, key, v, original) => setEdits((cur) => {
    const row = { ...cur[id], [key]: v };
    if (v === original) delete row[key];
    const next = { ...cur, [id]: row };
    if (!Object.keys(row).length) delete next[id];
    return next;
  });

  const ids = Object.keys(edits);
  const saveAll = async () => {
    setBusy(true);
    const errs = {};
    const remaining = {};
    for (const id of ids) {   // 파일을 매번 다시 읽고 쓰므로 하나씩 차례로 저장한다.
      const item = data.units.find((u) => u.UnitId === id);
      const draft = { ...MODES.units.open(item, schema), ...edits[id] };
      const r = await api('POST', '/api/unit', { unit: MODES.units.payload(draft), mode: 'upsert' });
      if (!r.ok) { errs[id] = r.errors || [r.error]; remaining[id] = edits[id]; }
    }
    setErrors(errs);
    setEdits(remaining);
    await onSaved();
    setBusy(false);
  };

  const sortMark = (key) => (sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  return (
    <main className="table-view">
      <div className="tools">
        {KIND_TABS.map(([kind, label]) => (
          <button key={kind} className={`tab ${filterKind === kind ? 'on' : ''}`} onClick={() => setFilterKind(kind)}>{label}</button>
        ))}
        <input type="text" placeholder="이름 / id 검색" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <span className="muted">{rows.length}개</span>
        <span className="spacer" />
        {ids.length > 0 && <span className="muted">{ids.length}개 유닛 수정됨</span>}
        <button disabled={!ids.length || busy} onClick={() => { setEdits({}); setErrors({}); }}>되돌리기</button>
        <button className="primary" disabled={!ids.length || busy} onClick={saveAll}>모두 저장</button>
      </div>
      <table className="units">
        <thead>
          <tr>
            <th style={{ width: 52 }} />
            {COLUMNS.map((c) => <th key={c.key} className="sortable" onClick={() => toggleSort(c.key)}>{c.label}{sortMark(c.key)}</th>)}
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={COLUMNS.length + 2} className="muted">없음</td></tr>}
          {rows.flatMap((u) => {
            const out = [(
              <tr key={u.UnitId}>
                <td><Thumb ruid={unitIconRuid(u)} /></td>
                {COLUMNS.map((c) => {
                  const changed = edits[u.UnitId] && c.key in edits[u.UnitId];
                  if (c.key === 'Kind') return <td key={c.key}>{schema.kindLabels[u.Kind]}</td>;
                  if (c.key !== 'Name' && !editable(u, c.key)) return <td key={c.key} className="muted">-</td>;
                  const v = value(u, c.key);
                  const set = (e) => edit(u.UnitId, c.key, e.target.value, u[c.key] ?? '');
                  if (c.type === 'enum') {
                    const f = fieldOf(c.key);
                    const labels = schema.enumLabels[c.key] || {};
                    return (
                      <td key={c.key} className={changed ? 'changed' : ''}>
                        <select value={v} onChange={set}>
                          <option value="">(빈칸)</option>
                          {f.enum.map((e) => <option key={e} value={e}>{labels[e] || e}</option>)}
                        </select>
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className={changed ? 'changed' : ''}>
                      <input type="text" inputMode={c.type === 'number' ? 'decimal' : undefined} value={v} onChange={set} className={c.type === 'number' ? 'num' : ''} />
                    </td>
                  );
                })}
                <td><a href="#" onClick={(e) => { e.preventDefault(); onOpen(u); }}>{u.UnitId}</a></td>
              </tr>
            )];
            if (errors[u.UnitId]) out.push(
              <tr key={u.UnitId + '!'}><td colSpan={COLUMNS.length + 2}>{errors[u.UnitId].map((m, i) => <div key={i} className="msg err">{u.UnitId}: {m}</div>)}</td></tr>
            );
            return out;
          })}
        </tbody>
      </table>
    </main>
  );
}
