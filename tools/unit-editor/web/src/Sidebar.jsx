import { Badge, Thumb } from './ui.jsx';

function UnitRow({ item: u, schema }) {
  const s = u._status;
  return (
    <>
      <Thumb ruid={u.Kind === 'skill' ? u.EffectRuid : u.StandRuid} />
      <div className="main"><div className="nm">{u.Name}</div><div className="id">{u.UnitId} · {schema.kindLabels[u.Kind]} · 코스트 {u.Cost}</div></div>
      <div className="badges">
        {s.starter ? <Badge type="ally">스타터</Badge> : s.purchasable && <Badge type="ally">구매</Badge>}
        {s.enemy && <Badge type="enemy">적 {s.enemyStages.map((x) => x.replace('stage', '')).join(',')}</Badge>}
        {!s.ally && !s.enemy && <Badge type="none">미등장</Badge>}
      </div>
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

const ROWS = { units: UnitRow, stages: StageRow, effects: EffectRow };
const KIND_TABS = [['', '전체'], ['monster', '몬스터'], ['build', '설치물'], ['skill', '스킬']];

export default function Sidebar({ mode, m, data, selectedId, filterKind, setFilterKind, search, setSearch, onSelect }) {
  const q = search.trim().toLowerCase();
  const Row = ROWS[mode];
  const items = data[m.list]
    .filter((it) => mode !== 'units' || (data.schema.kinds.includes(it.Kind) && (!filterKind || it.Kind === filterKind)))
    .filter((it) => !q || it[m.idKey].toLowerCase().includes(q) || (it.Name || '').toLowerCase().includes(q));

  return (
    <aside>
      <div className="tools">
        {mode === 'units' && KIND_TABS.map(([kind, label]) => (
          <button key={kind} className={`tab ${filterKind === kind ? 'on' : ''}`} onClick={() => setFilterKind(kind)}>{label}</button>
        ))}
        <input type="text" placeholder="이름 / id 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {items.length === 0 && <div className="empty">없음</div>}
      {items.map((it) => (
        <div key={it[m.idKey]} className={`row ${it[m.idKey] === selectedId ? 'on' : ''}`} onClick={() => onSelect(it)}>
          <Row item={it} schema={data.schema} />
        </div>
      ))}
    </aside>
  );
}
