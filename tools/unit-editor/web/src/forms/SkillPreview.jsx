import { useState } from 'react';
import { useResource } from '../api.js';
import { largestFrame, r2, useContentRange, useFrameIndex } from '../effectGeo.js';
import { Frame, Ground, stageStyle } from './previewParts.jsx';

// 스킬이 실제 전투에서 차지하는 모양: 이펙트(투명 프레임, 게임과 같은 규칙으로 배치)와 피해 범위를 같은 축척으로 겹쳐 보여 준다.
// 게임(FieldFx.PlaySkillEffect)과 같은 규칙: 피해 폭 = 범위 × RangeScale × 2, 이펙트는 그 폭 × 이펙트 크기로 늘려
// 가장 넓은 프레임을 범위 중심에 가로로 맞추고 그 프레임의 바닥을 지면에 둔다. 거기에 EffectOffsetX / Y를 더한다.
// 모든 프레임은 피벗을 같은 점에 맞춰 그려진다(엔진과 같음). 월드 유닛 기준(1칸 = 100px).
export default function SkillPreview({ draft, set, data }) {
  const { battle } = data;
  const res = useResource(draft.EffectRuid?.trim());
  const [overlay, setOverlay] = useState(false);
  const monsters = data.units.filter((u) => u.Kind === 'monster' && u.StandRuid);
  const [refId, setRefId] = useState(() => (monsters.find((u) => u.UnitId === 'mushroom') || monsters[0] || {}).UnitId || '');
  const refUnit = monsters.find((u) => u.UnitId === refId);
  const refRes = useResource(refUnit?.StandRuid);
  const frames = res?.ok ? res.frames || [] : [];
  const range = useContentRange(frames);
  const idx = useFrameIndex(frames.length, !overlay);

  const radius = Number(draft.SkillRadius);
  if (!(radius > 0)) return <div className="muted">범위(SkillRadius)를 넣으면 범위가 그려집니다.</div>;

  const scale = Number(draft.EffectScale) || 1;
  const offX = Number(draft.EffectOffsetX) || 0;
  const offY = Number(draft.EffectOffsetY) || 0;
  const areaW = radius * battle.rangeScale * 2;
  const boxH = battle.skillBoxHeight;
  const m = frames.length ? largestFrame(frames) : null;
  const k = m ? (areaW * scale) / m.width : 0;
  const Px = m ? offX - (m.width / 2 - m.px) * k : 0;   // 피벗의 월드 x (범위 중심 = 0)
  const Py = m ? offY + m.py * k : 0;                   // 피벗의 월드 y (지면 = 0)

  const ref = refRes?.ok && refRes.frames?.length ? refRes.frames[0] : null;
  const ku = refUnit ? (Number(refUnit.Scale) || 1) * battle.unitScale / 100 : 0;

  let xMin = -areaW / 2, xMax = areaW / 2, yMax = boxH, yMin = 0;
  frames.forEach((f) => {
    xMin = Math.min(xMin, Px - f.px * k);
    xMax = Math.max(xMax, Px + (f.width - f.px) * k);
    yMax = Math.max(yMax, Py + (f.height - f.py) * k);
    yMin = Math.min(yMin, Py - f.py * k);
  });
  const refX = ref ? xMin - 0.15 - (ref.width - ref.px) * ku : 0;
  if (ref) { xMin = Math.min(xMin, refX - ref.px * ku); yMax = Math.max(yMax, (ref.height - ref.py) * ku); }
  const pad = 0.25;

  const content = range && k ? {
    x0: Px + range.minX * k, x1: Px + range.maxX * k, y0: Py + range.minY * k, y1: Py + range.maxY * k,
    cx: Px + range.cx * k, cy: Py + range.cy * k,   // 알파 무게중심
  } : null;
  const fitBottom = () => set('EffectOffsetY', r2(offY - content.y0));
  const fitCenter = () => {
    set('EffectOffsetX', r2(offX - content.cx));
    set('EffectOffsetY', r2(offY + boxH / 2 - content.cy));
  };

  return (
    <div>
      <svg viewBox={`${xMin - pad} ${-(yMax + 0.2)} ${xMax - xMin + pad * 2} ${yMax - yMin + 0.2 + 0.4}`} style={stageStyle}>
        {ref && <Frame frame={ref} k={ku} ox={refX} oy={0} opacity={0.85} />}
        <rect x={-areaW / 2} y={-boxH} width={areaW} height={boxH} fill="var(--danger)" fillOpacity="0.18" stroke="var(--danger)" strokeWidth="0.02" strokeDasharray="0.06 0.04" />
        {m && (overlay
          ? frames.map((f, i) => <Frame key={i} frame={f} k={k} ox={Px} oy={Py} opacity={0.12} />)
          : <Frame frame={frames[idx]} k={k} ox={Px} oy={Py} />)}
        {content && <rect x={content.x0} y={-content.y1} width={content.x1 - content.x0} height={content.y1 - content.y0} fill="none" stroke="var(--ok)" strokeWidth="0.02" strokeDasharray="0.05 0.04" />}
        {m && <circle cx={Px} cy={-Py} r="0.035" fill="var(--accent)" />}
        {content && <circle cx={content.cx} cy={-content.cy} r="0.045" fill="none" stroke="var(--ok)" strokeWidth="0.02" />}
        <Ground xMin={xMin - pad} xMax={xMax + pad} />
      </svg>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        <button disabled={!content} onClick={fitBottom}>내용물 하단 → 지면</button>
        <button disabled={!content} onClick={fitCenter}>내용물 중앙 → 범위 박스 중앙</button>
        <button onClick={() => { set('EffectOffsetX', ''); set('EffectOffsetY', ''); }}>위치 초기화</button>
        <label className="muted"><input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> 전체 프레임 겹쳐 보기</label>
        <label className="muted">크기 비교 몬스터{' '}
          <select value={refId} onChange={(e) => setRefId(e.target.value)} style={{ width: 'auto' }}>
            {monsters.map((u) => <option key={u.UnitId} value={u.UnitId}>{u.Name}</option>)}
          </select>
        </label>
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        붉은 점선 = 실제 피해 범위(폭 <b>{areaW.toFixed(2)}</b> 유닛, 높이는 참고용). 초록 점선 = 이펙트가 실제로 그려지는 영역(가장자리 희미한 부분 제외), 초록 원 = 그 무게중심, 파란 점 = 이펙트 피벗(엔진이 이 점을 기준으로 놓음).
        {!m && (res?.ok ? ' 프레임 정보를 가져오지 못했습니다.' : ' 범위 이펙트 RUID를 넣으면 이펙트가 겹쳐 보입니다.')}
        {m && !content && ' 이펙트 내용물 영역을 계산하는 중…'}
        <br />눈금은 월드 유닛(가운데 0 = 범위 중심). 위치 칸은 월드 유닛이고 이펙트 위치 Y는 지면 기준 위가 +입니다.
      </div>
    </div>
  );
}
