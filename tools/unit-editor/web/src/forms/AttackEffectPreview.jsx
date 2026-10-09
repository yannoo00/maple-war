import { useState } from 'react';
import { useResource } from '../api.js';
import { r2, useContentRange, useFrameIndex } from '../effectGeo.js';
import { Frame, Ground, Handle, MoveArea, rectCorners, scaleFactor, stageStyle, useSvgDrag } from './previewParts.jsx';

// 공격 이펙트가 몸에 대해 어디에 놓이는지: 몬스터(stand 첫 프레임, 게임과 같은 축척)를 지면에 세우고
// 공격 이펙트를 부착 지점(발 + 위치 칸)에 피벗을 맞춰 재생한다.
// 게임(BattleFx.OnAttackFired)은 이펙트를 유닛에 붙이므로 유닛 크기와 좌우 반전을 그대로 따른다:
// 원본 클립은 왼쪽을 보고, 아군은 오른쪽을 보므로 몸과 이펙트를 같이 좌우 반전해 그린다. 위치 X는 앞(오른쪽)이 +, Y는 발 기준 위가 +.
// 드래그: 이펙트 안쪽 = 위치(AttackEffectOffset), 이펙트 모서리 = 크기(AttackEffectScale, 반대쪽 모서리 고정).
export default function AttackEffectPreview({ draft, set, data }) {
  const { battle } = data;
  const body = useResource(draft.StandRuid?.trim());
  const fx = useResource(draft.AttackEffectRuid?.trim());
  const [overlay, setOverlay] = useState(false);
  const [frameMs, setFrameMs] = useState(150);
  const { svgRef, begin, handlers } = useSvgDrag();
  const bodyFrames = body?.ok ? (body.frames || []).slice(0, 1) : [];
  const fxFrames = fx?.ok ? fx.frames || [] : [];
  const bodyRange = useContentRange(bodyFrames);
  const fxRange = useContentRange(fxFrames);
  const idx = useFrameIndex(fxFrames.length, !overlay, frameMs);

  if (!draft.AttackEffectRuid?.trim()) return <div className="muted">공격 이펙트 RUID를 넣으면 몸과 겹친 모양이 미리보기로 나옵니다.</div>;

  const ku = (Number(draft.Scale) || 1) * battle.unitScale / 100;                  // 몸: 픽셀당 월드 유닛
  const s = Number(draft.AttackEffectScale) > 0 ? Number(draft.AttackEffectScale) : 1;
  const ke = ku * s;                                                              // 이펙트는 유닛 크기를 따라가고 배율을 곱한다
  const offX = Number(draft.AttackEffectOffsetX) || 0;
  const offY = Number(draft.AttackEffectOffsetY) || 0;
  const b0 = bodyFrames[0];

  // 반전된 프레임의 가로 범위: 피벗(ox) 기준 왼쪽 (width - px), 오른쪽 px.
  let xMin = -0.4, xMax = 0.4, yMax = 0.6, yMin = 0;
  if (b0) {
    xMin = Math.min(xMin, -(b0.width - b0.px) * ku); xMax = Math.max(xMax, b0.px * ku);
    yMax = Math.max(yMax, (b0.height - b0.py) * ku);
  }
  fxFrames.forEach((f) => {
    xMin = Math.min(xMin, offX - (f.width - f.px) * ke); xMax = Math.max(xMax, offX + f.px * ke);
    yMax = Math.max(yMax, offY + (f.height - f.py) * ke);
    yMin = Math.min(yMin, offY - f.py * ke);
  });
  const pad = 0.25;
  const vbW = xMax - xMin + pad * 2;
  const hs = vbW / 50;

  // 몸 중앙 = 몸의 알파 무게중심(좌우 반전 때문에 x 부호가 뒤집힘), 이펙트 중심 = 이펙트의 알파 무게중심(피벗 기준 px).
  const bodyCenter = bodyRange && { x: -bodyRange.cx * ku, y: bodyRange.cy * ku };
  const fxCenter = fxRange && { x: fxRange.cx, y: fxRange.cy };
  const fitContent = () => {
    set('AttackEffectOffsetX', r2(bodyCenter.x + fxCenter.x * ke));
    set('AttackEffectOffsetY', r2(bodyCenter.y - fxCenter.y * ke));
  };
  const fitPivot = () => {
    set('AttackEffectOffsetX', r2(bodyCenter.x));
    set('AttackEffectOffsetY', r2(bodyCenter.y));
  };
  const fxBox = fxRange && {
    x0: offX - fxRange.maxX * ke, x1: offX - fxRange.minX * ke, y0: offY + fxRange.minY * ke, y1: offY + fxRange.maxY * ke,
  };

  const startMove = (e) => {
    const x0 = offX, y0 = offY;
    begin(e, (cur, st) => { set('AttackEffectOffsetX', r2(x0 + cur.x - st.x)); set('AttackEffectOffsetY', r2(y0 + cur.y - st.y)); });
  };
  const startScale = (e, corner) => {
    const P0 = { x: offX, y: offY }, s0 = s;
    begin(e, (cur) => {
      const f = scaleFactor(cur, corner.a, corner.c);
      set('AttackEffectScale', r2(s0 * f));
      set('AttackEffectOffsetX', r2(corner.a.x + f * (P0.x - corner.a.x)));
      set('AttackEffectOffsetY', r2(corner.a.y + f * (P0.y - corner.a.y)));
    });
  };

  return (
    <div>
      <svg ref={svgRef} {...handlers} viewBox={`${xMin - pad} ${-(yMax + 0.2)} ${vbW} ${yMax - yMin + 0.2 + 0.4}`} style={{ ...stageStyle, touchAction: 'none' }}>
        {b0 && <Frame frame={b0} k={ku} ox={0} oy={0} mirror opacity={0.9} />}
        {fxFrames.length > 0 && (overlay
          ? fxFrames.map((f, i) => <Frame key={i} frame={f} k={ke} ox={offX} oy={offY} mirror opacity={0.12} />)
          : <Frame frame={fxFrames[idx]} k={ke} ox={offX} oy={offY} mirror />)}
        {fxBox && <rect x={fxBox.x0} y={-fxBox.y1} width={fxBox.x1 - fxBox.x0} height={fxBox.y1 - fxBox.y0} fill="none" stroke="var(--ok)" strokeWidth="0.02" strokeDasharray="0.05 0.04" />}
        {bodyCenter && (
          <g stroke="var(--accent)" strokeWidth="0.02">
            <line x1={bodyCenter.x - 0.07} x2={bodyCenter.x + 0.07} y1={-bodyCenter.y} y2={-bodyCenter.y} />
            <line x1={bodyCenter.x} x2={bodyCenter.x} y1={-bodyCenter.y - 0.07} y2={-bodyCenter.y + 0.07} />
          </g>
        )}
        <circle cx={offX} cy={-offY} r="0.035" fill="var(--danger)" />
        <Ground xMin={xMin - pad} xMax={xMax + pad} />
        {fxBox && <MoveArea rect={fxBox} onPointerDown={startMove} />}
        {fxBox && rectCorners(fxBox).map((c, i) => <Handle key={i} x={c.c.x} y={c.c.y} size={hs} cursor={c.cursor} onPointerDown={(e) => startScale(e, c)} />)}
      </svg>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        <button disabled={!bodyCenter || !fxCenter} onClick={fitContent}>이펙트 내용물 중앙 → 몸 중앙</button>
        <button disabled={!bodyCenter} onClick={fitPivot}>이펙트 피벗 → 몸 중앙</button>
        <button onClick={() => { set('AttackEffectOffsetX', ''); set('AttackEffectOffsetY', ''); set('AttackEffectScale', ''); }}>위치·크기 초기화</button>
        <label className="muted"><input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> 전체 프레임 겹쳐 보기</label>
        <label className="muted">프레임 간격(ms){' '}
          <input type="number" min="20" step="10" value={frameMs} onChange={(e) => setFrameMs(Math.max(20, Number(e.target.value) || 150))} style={{ width: 70 }} />
        </label>
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        <b>드래그</b>: 이펙트 안쪽 = 위치, 이펙트 모서리(흰 사각형) = 크기(반대쪽 모서리 고정). 몸은 오른쪽을 보는 아군 기준입니다(앞 = 오른쪽 = X +).
        <br />파란 십자 = 몸 중앙, 빨간 점 = 이펙트 피벗이 놓이는 곳, 초록 점선 = 이펙트가 실제로 그려지는 영역(가장자리 희미한 부분 제외).
        {!b0 && ' 몬스터의 stand 클립(StandRuid)이 있어야 몸이 그려집니다.'}
        {fx?.ok && fxFrames.length === 0 && ' 이펙트 프레임 정보를 가져오지 못했습니다.'}
        <br />위치 칸은 화면에서 보이는 월드 유닛(발 기준)이고, 크기 배율은 유닛 크기 위에 곱해집니다.
      </div>
    </div>
  );
}
