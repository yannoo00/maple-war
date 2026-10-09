import { Badge, Thumb } from './ui.jsx';
import { SORT_OPTIONS, sortUnits, unitIconRuid } from './unit.js';

function UnitRow({ item: u, schema }) {
  return (
    <>
      <Thumb ruid={unitIconRuid(u)} />
      <div className="main"><div className="nm">{u.Name}</div><div className="id">{u.UnitId} · {schema.kindLabels[u.Kind]} · {u.Kind === 'base' ? `HP ${u.MaxHp}` : `마나 ${u.Cost}`}</div></div>
    </>
  );
}

function StageRow({ item: s }) {
  const st = s._status;
  return (
    <>
      <div className="main"><div className="nm">{s.Name}</div><div className="id">{s.StageId} · 맵 {s.MapName} · 기지 HP {s.BaseHp}</div></div>
      <div className="badges">
        <Badge type="enemy">시간표 {st.waveCount} · {st.lastWaveTime}초</Badge>
        {st.pool.length ? <Badge type="none">반복 {st.pool.length}</Badge> : <Badge type="warn">반복 없음</Badge>}
        {!st.mapExists && <Badge type="warn">맵 없음</Badge>}
      </div>
    </>
  );
}

function EffectRow({ item: e }) {
  const st = e._status;
  return (
    <>
      <div className="main"><div className="nm">{e.Name}</div><div className="id">{e.EffectId} · {e.Type} · {e.Duration}초</div></div>
      <div className="badges">
        {st.implemented ? <Badge type="ok">구현됨</Badge> : <Badge type="warn">미구현 · 설명만</Badge>}
        <Badge type="none">{st.usedBy.length ? `${st.usedBy.length}유닛` : '미사용'}</Badge>
      </div>
    </>
  );
}

function ChestRow({ item: c, schema }) {
  const st = c._status;
  const price = Number(c.PriceMeso) || 0;
  return (
    <>
      <Thumb ruid={c.IconRuid || schema.summonStoneIconRuid} />
      <div className="main"><div className="nm">{c.Name}</div><div className="id">{c.ChestId} · 카드 {c.Cards}장 · {schema.rarityLabels[c.Rarity] || c.Rarity}</div></div>
      <div className="badges">
        {Math.abs(st.chanceSum - 100) > 0.001 && <Badge type="warn">합 {st.chanceSum}%</Badge>}
        {price > 0 ? <Badge type="ally">{price}메소</Badge> : <Badge type="none">비매품</Badge>}
        {st.rewardOf.length > 0 && <Badge type="enemy">보상 {st.rewardOf.map((x) => x.replace('stage', '')).join(',')}</Badge>}
      </div>
    </>
  );
}

const ROWS = { units: UnitRow, stages: StageRow, chests: ChestRow, effects: EffectRow };
const KIND_TABS = [['', '전체'], ['monster', '몬스터'], ['build', '설치물'], ['skill', '스킬'], ['base', '기지']];

export default function Sidebar({ mode, m, data, selectedId, filterKind, setFilterKind, search, setSearch, sort, setSort, onSelect }) {
  const q = search.trim().toLowerCase();
  const Row = ROWS[mode];
  let items = data[m.list]
    .filter((it) => mode !== 'units' || (data.schema.kinds.includes(it.Kind) && (!filterKind || it.Kind === filterKind)))
    .filter((it) => !q || it[m.idKey].toLowerCase().includes(q) || (it.Name || '').toLowerCase().includes(q));
  if (mode === 'units') items = sortUnits(items, sort.key, sort.dir, data.schema.fields.find((f) => f.key === 'Rarity').enum);

  return (
    <aside>
      <div className="tools">
        {mode === 'units' && KIND_TABS.map(([kind, label]) => (
          <button key={kind} className={`tab ${filterKind === kind ? 'on' : ''}`} onClick={() => setFilterKind(kind)}>{label}</button>
        ))}
        <input type="text" placeholder="이름 / id 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        {mode === 'units' && (
          <>
            <select value={sort.key} onChange={(e) => setSort({ ...sort, key: e.target.value })} style={{ width: 'auto' }}>
              {SORT_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button disabled={!sort.key} title="오름차순 / 내림차순" onClick={() => setSort({ ...sort, dir: -sort.dir })}>{sort.dir > 0 ? '▲' : '▼'}</button>
          </>
        )}
      </div>
      {items.length === 0 && <div className="empty">없음</div>}
      {items.map((it) => (
        <div key={it[m.idKey]} className={`row ${it[m.idKey] === selectedId ? 'on' : ''} ${mode === 'units' ? `r-${it.Rarity || 'normal'}` : ''}`} onClick={() => onSelect(it)}>
          <Row item={it} schema={data.schema} />
        </div>
      ))}
    </aside>
  );
}
