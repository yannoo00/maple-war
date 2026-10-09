import { useEffect, useState } from 'react';
import { api } from './api.js';
import { MODES } from './modes.js';
import { Messages, useConfirm } from './ui.jsx';
import Sidebar from './Sidebar.jsx';
import UnitForm, { UnitBadges } from './forms/UnitForm.jsx';
import StageForm, { StageBadges } from './forms/StageForm.jsx';
import EffectForm, { EffectBadges } from './forms/EffectForm.jsx';
import ChestForm, { ChestBadges } from './forms/ChestForm.jsx';

const FORMS = {
  units: { Form: UnitForm, Badges: UnitBadges },
  stages: { Form: StageForm, Badges: StageBadges },
  chests: { Form: ChestForm, Badges: ChestBadges },
  effects: { Form: EffectForm, Badges: EffectBadges },
};

export default function App() {
  const [data, setData] = useState(null);        // /api/state
  const [mode, setMode] = useState('units');
  const [editing, setEditing] = useState(null);  // { draft, isNew, originalId, enemyStages }
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState(null);    // 검사/저장 결과 메시지
  const [filterKind, setFilterKind] = useState('');
  const [search, setSearch] = useState('');
  const [newKind, setNewKind] = useState('monster');
  const { ask, dialog } = useConfirm();

  const m = MODES[mode];
  const { Form, Badges } = FORMS[mode];

  const load = async () => {
    const d = await api('GET', '/api/state');
    setData(d);
    return d;
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!data) return null;

  const find = (d, id) => d[m.list].find((x) => x[m.idKey] === id);
  const show = (next, message = null) => { setEditing(next); setResult(message); setDirty(false); };
  const open = (item, d = data) => show({ draft: m.open(item, d.schema), isNew: false, originalId: item[m.idKey], enemyStages: item._status.enemyStages ?? [] });
  const startNew = (from) => show({ draft: m.blank(data.schema, from?.Kind ?? newKind, from), isNew: true, originalId: null, enemyStages: [] });
  const set = (key, value) => { setEditing((e) => ({ ...e, draft: { ...e.draft, [key]: value } })); setDirty(true); };

  // 저장 안 한 변경이 있으면 물어보고 진행한다.
  const guard = async (fn) => {
    if (dirty && !(await ask('저장하지 않은 변경이 있습니다. 버리고 이동할까요?'))) return;
    fn();
  };
  const changeMode = (next) => guard(() => { setMode(next); show(null); });
  const reload = () => guard(async () => {
    const d = await load();
    const item = editing && !editing.isNew && find(d, editing.originalId);
    if (item) open(item, d); else show(null);
  });

  const body = () => ({ [m.api]: m.payload(editing.draft), mode: editing.isNew ? 'add' : 'upsert' });

  const validate = async () => {
    setResult(await api('POST', `/api/${m.api}/validate`, body()));
    window.scrollTo({ top: 0 });
  };

  const save = async () => {
    const { draft, isNew, originalId } = editing;
    if (!isNew && draft[m.idKey] !== originalId) {
      const msg = `${m.idKey}를 "${originalId}"에서 "${draft[m.idKey]}"로 바꾸면 새 항목이 추가되고 원래 항목은 남습니다. 계속할까요?`;
      if (!(await ask(msg))) return;
    }
    const r = await api('POST', `/api/${m.api}`, body());
    if (!r.ok) { setResult(r); window.scrollTo({ top: 0 }); return; }
    const d = await load();
    open(find(d, r[m.api][m.idKey]), d);
    setResult({ ...r, savedText: m.savedText(r) });
    window.scrollTo({ top: 0 });
  };

  const remove = async () => {
    const id = editing.originalId;
    if (!(await ask(m.deleteText(find(data, id))))) return;
    const r = await api('DELETE', `/api/${m.api}/${encodeURIComponent(id)}?force=1`);
    if (!r.ok) return alert((r.errors || [r.error]).join('\n'));
    show(null);
    load();
  };

  const selected = editing && !editing.isNew ? find(data, editing.originalId) : null;
  const { schema } = data;

  return (
    <>
      <header>
        <h1>유닛 편집기</h1>
        <div className="mode">
          {Object.entries(MODES).map(([key, v]) => (
            <button key={key} className={mode === key ? 'on' : ''} onClick={() => changeMode(key)}>{v.label}</button>
          ))}
        </div>
        <span>
          {mode === 'units' && (
            <select value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              {schema.kinds.map((k) => <option key={k} value={k}>{schema.kindLabels[k]}</option>)}
            </select>
          )}
          <button onClick={() => guard(() => startNew(null))}>{m.newLabel}</button>
          {m.cloneable && <button disabled={!selected} onClick={() => guard(() => startNew(selected))}>복제</button>}
        </span>
        <span className="spacer" />
        <span className="muted">{data.files[m.file].replace(/\\/g, '/')}</span>
        <button onClick={reload}>다시 읽기</button>
      </header>

      <div className="layout">
        <Sidebar mode={mode} m={m} data={data} selectedId={editing?.originalId} filterKind={filterKind} setFilterKind={setFilterKind}
          search={search} setSearch={setSearch} onSelect={(item) => guard(() => open(item))} />
        <main>
          {!editing ? <div className="empty">{m.empty}</div> : (
            <>
              <div className="status">
                <strong>{editing.isNew ? `새 ${m.noun(editing.draft, schema)}` : `${editing.draft.Name} (${editing.originalId})`}</strong>
                <Badges draft={editing.draft} data={data} originalId={editing.originalId} enemyStages={editing.enemyStages} />
                <span className="spacer" />
                <button onClick={validate}>검사</button>
                <button className="primary" onClick={save}>저장</button>
                {!editing.isNew && <button className="danger" onClick={remove}>삭제</button>}
              </div>
              <Messages result={result} />
              <Form draft={editing.draft} set={set} data={data} originalId={editing.originalId} />
            </>
          )}
        </main>
      </div>
      {dialog}
    </>
  );
}
