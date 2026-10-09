import { isRuid, useResource } from './api.js';

function RuidPreview({ value }) {
  const ruid = value.trim();
  const r = useResource(ruid);
  if (!ruid) return <div className="preview" />;
  if (!isRuid(ruid)) return <div className="preview"><span className="bad">32자리 16진수가 아님</span></div>;
  if (!r) return <div className="preview"><span>불러오는 중…</span></div>;
  if (!r.ok) return <div className="preview"><span className="bad">{r.error || '조회 실패'}</span></div>;
  if (r.audio) {
    // 소리 리소스: 길이와 설명, 바로 들어 볼 수 있는 재생기
    return (
      <div className="preview" style={{ flexWrap: 'wrap' }}>
        <audio controls preload="none" src={`/api/audio/${ruid.toLowerCase()}`} style={{ height: 32 }} />
        <span>{[`${Number(r.audio.length).toFixed(2)}초`, r.audio.format, r.audio.description].filter(Boolean).join(' · ')}</span>
      </div>
    );
  }
  const meta = [r.name, r.type, r.frameCount && `${r.frameCount}프레임`, r.width && `${r.width}×${r.height}`].filter(Boolean).join(' · ');
  return <div className="preview">{r.thumbnail && <img src={r.thumbnail} alt="" />}<span>{meta}</span></div>;
}

function Options({ items, value, empty, getValue, getLabel }) {
  return (
    <>
      <option value="">{empty}</option>
      {items.map((it) => <option key={getValue(it)} value={getValue(it)}>{getLabel(it)}</option>)}
    </>
  );
}

function Input({ f, value, onChange, schema, data, selfId }) {
  const set = (e) => onChange(e.target.value);

  if (f.type === 'enum') {
    const labels = schema.enumLabels[f.key] || {};
    return (
      <select value={value} onChange={set}>
        <Options items={f.enum} value={value} empty={f.key === 'Kind' ? '' : '(빈칸)'} getValue={(e) => e}
          getLabel={(e) => `${labels[e] || schema.kindLabels[e] || e} (${e})`} />
      </select>
    );
  }
  if (f.type === 'effect') {
    return (
      <select value={value} onChange={set}>
        <Options items={data.effects} empty="(없음)" getValue={(e) => e.EffectId}
          getLabel={(e) => `${e.Name} (${e.EffectId} · ${e.Type}${e._status.implemented ? '' : ' · 미구현'})`} />
      </select>
    );
  }
  if (f.type === 'map') {
    const missing = value && !schema.maps.includes(value);
    return (
      <select value={value} onChange={set}>
        <Options items={schema.maps} empty="(선택)" getValue={(m) => m} getLabel={(m) => m} />
        {missing && <option value={value}>{value} (map/ 폴더에 없음)</option>}
      </select>
    );
  }
  if (f.type === 'stage') {
    return (
      <select value={value} onChange={set}>
        <Options items={data.stages.filter((s) => s.StageId !== selfId)} empty="(없음 · 처음부터 열림)"
          getValue={(s) => s.StageId} getLabel={(s) => `${s.Name} (${s.StageId})`} />
      </select>
    );
  }
  if (f.type === 'baseunit') {
    return (
      <select value={value} onChange={set}>
        <Options items={data.units.filter((u) => u.Kind === 'base')} empty="(기본 기지)"
          getValue={(u) => u.UnitId} getLabel={(u) => `${u.Name} (${u.UnitId})`} />
      </select>
    );
  }
  if (f.type === 'bool') {
    return (
      <select value={value === '1' ? '1' : '0'} onChange={set}>
        <option value="0">아니오 (0)</option>
        <option value="1">예 (1)</option>
      </select>
    );
  }
  if (f.type === 'memo') return <textarea value={value} onChange={set} />;
  if (f.type === 'ruid') {
    return (
      <>
        <input type="text" className="ruid" maxLength={32} placeholder="32자리 RUID" value={value} onChange={set} />
        <RuidPreview value={value} />
      </>
    );
  }
  return <input type="text" inputMode={f.type === 'number' ? 'decimal' : undefined} value={value} onChange={set} />;
}

// 스키마의 필드 하나 = 라벨 + 입력 + 도움말
export default function Field({ field: f, value, onChange, kind, schema, data, selfId }) {
  const required = Array.isArray(f.required) ? f.required.includes(kind) : f.required === true;
  return (
    <label className={`f ${f.type === 'memo' ? 'wide' : ''}`}>
      <span className="k">{f.label} <code>{f.key}</code>{required && <b>*</b>}</span>
      <Input f={f} value={value ?? ''} onChange={onChange} schema={schema} data={data} selfId={selfId} />
      {f.help && <span className="h">{f.help}</span>}
    </label>
  );
}

// 스키마가 모르는 CSV 열(다른 세션이 코드로 추가한 열)도 숨기지 않고 그대로 보여 주고 저장한다.
export function ExtraFields({ header, known, draft, set }) {
  const extra = header.filter((h) => !known.includes(h));
  if (!extra.length) return null;
  return (
    <fieldset>
      <legend>기타 열 (스키마에 없는 열 · 그대로 저장)</legend>
      <div className="grid">
        {extra.map((h) => (
          <label key={h} className="f">
            <span className="k">{h} <code>{h}</code></span>
            <input type="text" value={draft[h] ?? ''} onChange={(e) => set(h, e.target.value)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
