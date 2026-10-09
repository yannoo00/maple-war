import { useEffect, useState } from 'react';
import { useResource } from '../api.js';
import { largestFrame, r2, useContentRange, useFrameIndex } from '../effectGeo.js';
import { Frame, Ground, Handle, MoveArea, rectCorners, scaleFactor, stageStyle, useSvgDrag } from './previewParts.jsx';

// 스킬이 실제 전투에서 차지하는 모양: 이펙트(투명 프레임, 게임과 같은 규칙으로 배치)와 피해 범위를 같은 축척으로 겹쳐 보여 준다.
// 게임(FieldFx.PlaySkillEffect)과 같은 규칙: 피해 폭 = 범위 × RangeScale × 2, 이펙트는 그 폭 × 이펙트 크기로 늘려
// 가장 넓은 프레임을 범위 중심에 가로로 맞추고 그 프레임의 바닥을 지면에 둔다. 거기에 EffectOffsetX / Y를 더한다.
// 모든 프레임은 피벗을 같은 점에 맞춰 그려진다(엔진과 같음). 월드 유닛 기준(1칸 = 100px).
// 드래그: 이펙트 안쪽 = 위치(EffectOffset), 이펙트 모서리 = 크기(EffectScale, 반대쪽 모서리 고정), 붉은 범위 상자 좌우 = 범위(SkillRadius).
export default function SkillPreview({ draft, set, data }) {
  const { battle } = data;
  const res = useResource(draft.EffectRuid?.trim());
  const [overlay, setOverlay] = useState(false);
  const [frameMs, setFrameMs] = useState(150);   // 프레임 간격(미리보기용). 클립의 실제 속도는 API에 없어 가정값이다.
  const [cast, setCast] = useState(null);        // 시전 재생 중이면 { start }
  const [now, setNow] = useState(0);
  const { svgRef, begin, handlers } = useSvgDrag();
  const monsters = data.units.filter((u) => u.Kind === 'monster' && u.StandRuid);
  const [refId, setRefId] = useState(() => (monsters.find((u) => u.UnitId === 'mushroom') || monsters[0] || {}).UnitId || '');
  const refUnit = monsters.find((u) => u.UnitId === refId);
  const refRes = useResource(refUnit?.StandRuid);
  const frames = res?.ok ? res.frames || [] : [];
  const range = useContentRange(frames);
  const idx = useFrameIndex(frames.length, !overlay && !cast, frameMs);

  const soundRuid = draft.SkillSoundRuid?.trim();
  const soundDelay = Math.max(0, Number(draft.SkillSoundDelay) || 0);
  const hitDelay = Math.max(0, Number(draft.SkillHitDelay) || 0);
  const castLen = Math.max((frames.length * frameMs) / 1000, soundDelay + 0.6, hitDelay + 0.4) + 0.2;

  // 시전 재생: 이펙트는 한 번 재생, 소리는 효과음 시점에, 피해 상자는 피해 시점에 번쩍인다.
  useEffect(() => {
    if (!cast) return undefined;
    let raf;
    let sound;
    if (soundRuid) sound = setTimeout(() => { new Audio(`/api/audio/${soundRuid}`).play().catch(() => {}); }, soundDelay * 1000);
    const tick = () => {
      const t = (performance.now() - cast.start) / 1000;
      setNow(t);
      if (t >= castLen) { setCast(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(sound); };
  }, [cast]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const vbW = xMax - xMin + pad * 2;
  const hs = vbW / 50;   // 손잡이 크기

  const content = range && k ? {
    x0: Px + range.minX * k, x1: Px + range.maxX * k, y0: Py + range.minY * k, y1: Py + range.maxY * k,
    cx: Px + range.cx * k, cy: Py + range.cy * k,   // 알파 무게중심
  } : null;
  // 끌 수 있는 영역: 이펙트가 실제로 그려지는 영역(계산 전에는 가장 넓은 프레임 전체).
  const target = content || (m ? { x0: offX - (m.width * k) / 2, x1: offX + (m.width * k) / 2, y0: offY, y1: offY + m.height * k } : null);

  const fitBottom = () => set('EffectOffsetY', r2(offY - content.y0));
  const fitCenter = () => {
    set('EffectOffsetX', r2(offX - content.cx));
    set('EffectOffsetY', r2(offY + boxH / 2 - content.cy));
  };
  const startMove = (e) => {
    const x0 = offX, y0 = offY;
    begin(e, (cur, st) => { set('EffectOffsetX', r2(x0 + cur.x - st.x)); set('EffectOffsetY', r2(y0 + cur.y - st.y)); });
  };
  const startScale = (e, corner) => {
    const P0 = { x: Px, y: Py }, k0 = k, s0 = scale;
    begin(e, (cur) => {
      const f = scaleFactor(cur, corner.a, corner.c);
      const k1 = k0 * f;
      set('EffectScale', r2(s0 * f));
      set('EffectOffsetX', r2(corner.a.x + f * (P0.x - corner.a.x) + (m.width / 2 - m.px) * k1));
      set('EffectOffsetY', r2(corner.a.y + f * (P0.y - corner.a.y) - m.py * k1));
    });
  };
  const startRange = (e) => begin(e, (cur) => set('SkillRadius', r2(Math.max(0.1, Math.abs(cur.x) / battle.rangeScale))));

  const castFrame = cast && m ? Math.floor((now * 1000) / frameMs) : null;
  const showFrame = cast ? (castFrame < frames.length ? frames[castFrame] : null) : frames[idx];
  const hitFlash = cast && now >= hitDelay && now < hitDelay + 0.25;

  return (
    <div>
      <svg ref={svgRef} {...handlers} viewBox={`${xMin - pad} ${-(yMax + 0.2)} ${vbW} ${yMax - yMin + 0.2 + 0.4}`} style={{ ...stageStyle, touchAction: 'none' }}>
        {ref && <Frame frame={ref} k={ku} ox={refX} oy={0} opacity={0.85} />}
        <rect x={-areaW / 2} y={-boxH} width={areaW} height={boxH} fill="var(--danger)" fillOpacity={hitFlash ? 0.5 : 0.18} stroke="var(--danger)" strokeWidth="0.02" strokeDasharray="0.06 0.04" />
        {m && (overlay
          ? frames.map((f, i) => <Frame key={i} frame={f} k={k} ox={Px} oy={Py} opacity={0.12} />)
          : showFrame && <Frame frame={showFrame} k={k} ox={Px} oy={Py} />)}
        {content && <rect x={content.x0} y={-content.y1} width={content.x1 - content.x0} height={content.y1 - content.y0} fill="none" stroke="var(--ok)" strokeWidth="0.02" strokeDasharray="0.05 0.04" />}
        {m && <circle cx={Px} cy={-Py} r="0.035" fill="var(--accent)" />}
        {content && <circle cx={content.cx} cy={-content.cy} r="0.045" fill="none" stroke="var(--ok)" strokeWidth="0.02" />}
        <Ground xMin={xMin - pad} xMax={xMax + pad} />
        {target && <MoveArea rect={target} onPointerDown={startMove} />}
        {target && rectCorners(target).map((c, i) => <Handle key={i} x={c.c.x} y={c.c.y} size={hs} cursor={c.cursor} onPointerDown={(e) => startScale(e, c)} />)}
        {[-1, 1].map((sgn) => (
          <rect key={sgn} x={sgn * (areaW / 2) - hs / 2} y={-(boxH / 2) - hs} width={hs} height={hs * 2} fill="var(--danger)" stroke="#fff" strokeWidth={hs / 8}
            style={{ cursor: 'ew-resize', touchAction: 'none' }} onPointerDown={startRange} />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        <button className="primary" disabled={!m} onClick={() => setCast({ start: performance.now() })}>▶ 시전 재생</button>
        <button disabled={!content} onClick={fitBottom}>내용물 하단 → 지면</button>
        <button disabled={!content} onClick={fitCenter}>내용물 중앙 → 범위 박스 중앙</button>
        <button onClick={() => { set('EffectOffsetX', ''); set('EffectOffsetY', ''); }}>위치 초기화</button>
        <label className="muted"><input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> 전체 프레임 겹쳐 보기</label>
        <label className="muted">프레임 간격(ms){' '}
          <input type="number" min="20" step="10" value={frameMs} onChange={(e) => setFrameMs(Math.max(20, Number(e.target.value) || 150))} style={{ width: 70 }} />
        </label>
        <label className="muted">크기 비교 몬스터{' '}
          <select value={refId} onChange={(e) => setRefId(e.target.value)} style={{ width: 'auto' }}>
            {monsters.map((u) => <option key={u.UnitId} value={u.UnitId}>{u.Name}</option>)}
          </select>
        </label>
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        <b>드래그</b>: 이펙트 안쪽 = 위치, 이펙트 모서리(흰 사각형) = 크기(반대쪽 모서리 고정), 붉은 상자 좌우(붉은 막대) = 범위. 범위를 바꾸면 이펙트도 그 폭에 맞춰 같이 커집니다(게임 규칙).
        <br />붉은 점선 = 실제 피해 범위(폭 <b>{areaW.toFixed(2)}</b> 유닛, 높이는 참고용). 초록 점선·원 = 이펙트가 실제로 그려지는 영역(가장자리 희미한 부분 제외)과 무게중심, 파란 점 = 이펙트 피벗.
        <br />▶ 시전 재생: 이펙트를 한 번 재생하고, 효과음은 {soundRuid ? `${soundDelay}초`: '(소리 없음)'}에, 붉은 상자는 피해 시점 {hitDelay}초에 번쩍입니다{cast ? ` · t=${now.toFixed(2)}s` : ''}. 프레임 간격은 클립의 실제 속도를 알 수 없어 가정값(기본 150ms)입니다.
        {!m && (res?.ok ? ' 프레임 정보를 가져오지 못했습니다.' : ' 범위 이펙트 RUID를 넣으면 이펙트가 겹쳐 보입니다.')}
      </div>
    </div>
  );
}
