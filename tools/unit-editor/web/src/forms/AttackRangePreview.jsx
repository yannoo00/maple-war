import { useEffect, useState } from 'react';
import { useResource } from '../api.js';
import { r2, useFrameIndex } from '../effectGeo.js';
import { Frame, Ground, MoveArea, stageStyle, useSvgDrag } from './previewParts.jsx';

// 공격이 실제 전투에서 닿는 모양을 인게임 축척(1 = 100px, 사거리 = Range × RangeScale)으로 보여 준다.
// 공격자(아군, 오른쪽을 봄)는 x=0, 맞은 대상은 사거리 끝(x = 사거리)에 선다.
//  - 단일 공격(melee/ranged): 맞은 대상 하나에게만 타격 이펙트.
//  - 근거리 범위(melee_area): 공격자 중심 사거리 안 전부(BattleUnit.ApplyHit).
//  - 원거리 범위(ranged_area): 맞은 대상 중심 반경(AttackAreaRadius × RangeScale) 안 전부. 붉은 상자 좌우 막대를 끌어 반경을 바꾼다.
// 타격 이펙트(HitEffectRuid)는 게임(BattleFx.OnAttackHit)과 같게 맞은 대상 발 위 ProjectileAimY × UnitScale 높이에,
// 공격자 크기(Scale × UnitScale)로, 공격자가 오른쪽으로 갈 때처럼 좌우 반전해 재생한다.
const DUMMY_OFFSETS = [-1.2, -0.7, -0.3, 0, 0.3, 0.7, 1.2];   // 맞은 대상 기준 주변 더미 적(월드 유닛)

export default function AttackRangePreview({ draft, set, data }) {
  const { battle } = data;
  const type = draft.AttackType || (draft.ProjectileRuid ? 'ranged' : 'melee');
  const isRangedArea = type === 'ranged_area';
  const isMeleeArea = type === 'melee_area';
  const body = useResource(draft.StandRuid?.trim());
  const hitFx = useResource(draft.HitEffectRuid?.trim());
  const atkFx = useResource(draft.AttackEffectRuid?.trim());
  const enemies = data.units.filter((u) => u.Kind === 'monster' && u.StandRuid);
  const [refId, setRefId] = useState(() => (enemies.find((u) => u.UnitId === 'mushroom') || enemies[0] || {}).UnitId || '');
  const refUnit = enemies.find((u) => u.UnitId === refId);
  const refRes = useResource(refUnit?.StandRuid);
  const [frameMs, setFrameMs] = useState(150);
  const [cast, setCast] = useState(null);
  const [now, setNow] = useState(0);
  const { svgRef, begin, handlers } = useSvgDrag();

  const bodyFrame = body?.ok && body.frames?.length ? body.frames[0] : null;
  const refFrame = refRes?.ok && refRes.frames?.length ? refRes.frames[0] : null;
  const hitFrames = hitFx?.ok ? hitFx.frames || [] : [];
  const atkFrames = atkFx?.ok ? atkFx.frames || [] : [];
  const idx = useFrameIndex(hitFrames.length, !cast, frameMs);

  // 프레임 이미지는 그릴 때 처음 내려받으므로, 미리 불러 두지 않으면 첫 재생에서 프레임이 비어 보인다.
  const preloadKey = [...hitFrames, ...atkFrames].map((f) => f.spriteRuid).join(',');
  useEffect(() => {
    if (!preloadKey) return;
    preloadKey.split(',').forEach((r) => { const img = new Image(); img.src = `/api/sprite/${r}`; });
  }, [preloadKey]);

  const hitDelay = Math.max(0, Number(draft.AttackHitDelay) || 0);
  const castLen = Math.max(atkFrames.length * frameMs / 1000, hitDelay + hitFrames.length * frameMs / 1000, hitDelay + 0.4) + 0.2;

  useEffect(() => {
    if (!cast) return undefined;
    let raf;
    const tick = () => {
      const t = (performance.now() - cast.start) / 1000;
      setNow(t);
      if (t >= castLen) { setCast(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cast]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = Number(draft.Range);
  if (!(range > 0)) return <div className="muted">사거리(Range)를 넣으면 공격 범위가 인게임 축척으로 그려집니다.</div>;

  const attackRange = range * battle.rangeScale;                       // 공격자 → 맞은 대상 최대 거리
  const radiusAuthored = Number(draft.AttackAreaRadius) > 0 ? Number(draft.AttackAreaRadius) : 1;
  const radius = radiusAuthored * battle.rangeScale;                   // 원거리 범위 반경
  const targetX = attackRange;
  const boxH = battle.skillBoxHeight;
  const ku = (Number(draft.Scale) || 1) * battle.unitScale / 100;      // 공격자: 픽셀당 월드 유닛
  const kr = refUnit ? (Number(refUnit.Scale) || 1) * battle.unitScale / 100 : 0;
  const hs0 = Number(draft.HitEffectScale) > 0 ? Number(draft.HitEffectScale) : 1;
  const kh = ku * hs0;                                                 // 타격 이펙트는 공격자 크기(× 배율)를 따른다
  const defaultY = battle.projectileAimY * battle.unitScale;           // 위치 Y가 빈칸일 때의 기본 높이
  const hasY = draft.HitEffectOffsetY != null && String(draft.HitEffectOffsetY).trim() !== '';
  const hitOffX = Number(draft.HitEffectOffsetX) || 0;                 // 발 기준, 공격자가 보는 쪽(오른쪽)이 +
  const aimY = hasY ? Number(draft.HitEffectOffsetY) || 0 : defaultY;

  // 범위 안에 있는 적(맞은 대상 포함). 단일 공격은 맞은 대상 하나.
  const dummies = DUMMY_OFFSETS.map((o) => targetX + o);
  let center = targetX, half = 0;
  if (isRangedArea) half = radius;
  else if (isMeleeArea) { center = 0; half = attackRange; }
  const inArea = (x) => (isRangedArea || isMeleeArea) && Math.abs(x - center) <= half + 1e-9;
  // 최대 마릿수: 기준점에 가까운 순서로 1, 2, 3… (0 = 무제한). 범위 안이어도 순번이 한도를 넘으면 맞지 않는다.
  const maxT = Math.max(0, Math.floor(Number(draft.AttackMaxTargets) || 0));
  const order = (isRangedArea || isMeleeArea)
    ? dummies.filter(inArea).sort((a, b) => Math.abs(a - center) - Math.abs(b - center))
    : [targetX];
  const hitXs = maxT > 0 ? order.slice(0, maxT) : order;
  const rankOf = (x) => hitXs.indexOf(x) + 1;   // 0 = 맞지 않음
  const showDummies = isRangedArea || isMeleeArea;

  const offX = Number(draft.AttackEffectOffsetX) || 0;
  const offY = Number(draft.AttackEffectOffsetY) || 0;
  const ke = ku * (Number(draft.AttackEffectScale) > 0 ? Number(draft.AttackEffectScale) : 1);
  const xMinBody = bodyFrame ? -(bodyFrame.width - bodyFrame.px) * ku : -0.4;
  let xMin = Math.min(xMinBody, -0.4, isMeleeArea ? -half : 0);
  let xMax = Math.max(dummies[dummies.length - 1] + 0.4, targetX + 0.6, isRangedArea ? targetX + radius + 0.2 : 0);
  let yMax = Math.max(boxH, 0.8);
  if (bodyFrame) yMax = Math.max(yMax, (bodyFrame.height - bodyFrame.py) * ku);
  if (refFrame) yMax = Math.max(yMax, (refFrame.height - refFrame.py) * kr);
  // 이펙트 프레임은 피벗이 프레임 밖(예: 자쿰 py = -386)에 있을 수 있어 피벗보다 한참 위에서 그려진다.
  // 화면 영역에 모든 프레임의 실제 범위를 넣어야 위에서 떨어지는 연출이 잘리지 않는다.
  let yMin = 0;
  hitFrames.forEach((f) => {
    yMax = Math.max(yMax, aimY + (f.height - f.py) * kh);
    yMin = Math.min(yMin, aimY - f.py * kh);
    hitXs.forEach((x) => {
      xMin = Math.min(xMin, x + hitOffX - (f.width - f.px) * kh);
      xMax = Math.max(xMax, x + hitOffX + f.px * kh);
    });
  });
  atkFrames.forEach((f) => {
    yMax = Math.max(yMax, offY + (f.height - f.py) * ke);
    yMin = Math.min(yMin, offY - f.py * ke);
    xMin = Math.min(xMin, offX - (f.width - f.px) * ke);
    xMax = Math.max(xMax, offX + f.px * ke);
  });
  const pad = 0.25;
  const vbW = xMax - xMin + pad * 2;
  const hs = vbW / 50;

  const hitFrameAt = (t) => {
    if (!hitFrames.length) return null;
    if (!cast) return hitFrames[idx];
    if (t < hitDelay) return null;
    const n = Math.floor(((t - hitDelay) * 1000) / frameMs);
    return n < hitFrames.length ? hitFrames[n] : null;
  };
  const atkFrame = cast && atkFrames.length ? atkFrames[Math.floor((now * 1000) / frameMs)] || null : null;
  const hitFrame = hitFrameAt(now);
  const flash = cast && now >= hitDelay && now < hitDelay + 0.25;


  // 끌 수 있는 영역: 첫 번째 맞은 대상의 타격 이펙트(가장 큰 프레임). 끌면 위치 X·Y 칸이 바뀐다.
  const bigHit = hitFrames.reduce((b, f) => (!b || f.width * f.height > b.width * b.height ? f : b), null);
  const hx0 = hitXs[0] ?? targetX;
  const hitBox = bigHit && {
    x0: hx0 + hitOffX - (bigHit.width - bigHit.px) * kh, x1: hx0 + hitOffX + bigHit.px * kh,
    y0: aimY - bigHit.py * kh, y1: aimY + (bigHit.height - bigHit.py) * kh,
  };
  const startHitMove = (e) => {
    const x0 = hitOffX, y0 = aimY;
    begin(e, (cur, st) => { set('HitEffectOffsetX', r2(x0 + cur.x - st.x)); set('HitEffectOffsetY', r2(y0 + cur.y - st.y)); });
  };
  const headY = refFrame ? (refFrame.height - refFrame.py) * kr : null;   // 대상 머리 꼭대기 높이

  const startRadius = (e) => begin(e, (cur) => set('AttackAreaRadius', r2(Math.max(0.1, Math.abs(cur.x - targetX) / battle.rangeScale))));

  return (
    <div>
      <div className="muted" style={{ marginBottom: 6 }}>
        <b>공격 범위 미리보기</b> — {{ melee: '근거리(단일)', ranged: '원거리(단일)', melee_area: '근거리 범위', ranged_area: '원거리 범위' }[type] || type}
      </div>
      <svg ref={svgRef} {...handlers} viewBox={`${xMin - pad} ${-(yMax + 0.6)} ${vbW} ${yMax + 0.6 + 0.4 - yMin}`} style={{ ...stageStyle, touchAction: 'none' }}>
        {(isRangedArea || isMeleeArea) && (
          <rect x={center - half} y={-boxH} width={half * 2} height={boxH} fill="var(--danger)" fillOpacity={flash ? 0.45 : 0.16}
            stroke="var(--danger)" strokeWidth="0.02" strokeDasharray="0.06 0.04" />
        )}
        {bodyFrame && <Frame frame={bodyFrame} k={ku} ox={0} oy={0} mirror opacity={0.95} />}
        {refFrame && (showDummies ? dummies : [targetX]).map((x) => (
          <Frame key={x} frame={refFrame} k={kr} ox={x} oy={0} opacity={showDummies && rankOf(x) === 0 ? 0.35 : 0.9} />
        ))}
        {atkFrame && <Frame frame={atkFrame} k={ke} ox={offX} oy={offY} mirror />}
        {hitFrame && hitXs.map((x) => <Frame key={x} frame={hitFrame} k={kh} ox={x + hitOffX} oy={aimY} mirror />)}
        {showDummies && hitXs.map((x) => (
          <g key={x}>
            <circle cx={x} cy={-boxH - 0.2} r="0.11" fill="var(--danger)" />
            <text x={x} y={-boxH - 0.16} fontSize="0.14" textAnchor="middle" fill="#fff">{rankOf(x)}</text>
          </g>
        ))}
        {hitBox && <MoveArea rect={hitBox} onPointerDown={startHitMove} />}
        <Ground xMin={xMin - pad} xMax={xMax + pad} />
        {/* 사거리 표시: 공격자 → 맞은 대상 */}
        <g stroke="var(--accent)" strokeWidth="0.02" fill="var(--accent)">
          <line x1={0} x2={targetX} y1={0.12} y2={0.12} />
          <line x1={targetX} x2={targetX} y1={0.06} y2={0.18} />
          <text x={targetX / 2} y={0.32} fontSize="0.13" textAnchor="middle" stroke="none">사거리 {attackRange.toFixed(2)}</text>
        </g>
        {isRangedArea && (
          <g>
            <line x1={targetX} x2={targetX} y1={0} y2={-boxH} stroke="var(--danger)" strokeWidth="0.015" strokeDasharray="0.03 0.03" />
            <text x={targetX} y={-boxH - 0.06} fontSize="0.13" textAnchor="middle" fill="var(--danger)">반경 {radius.toFixed(2)} (폭 {(radius * 2).toFixed(2)}){maxT > 0 ? ` · 최대 ${maxT}마리` : ''}</text>
            {[-1, 1].map((sgn) => (
              <rect key={sgn} x={targetX + sgn * radius - hs / 2} y={-(boxH / 2) - hs} width={hs} height={hs * 2} fill="var(--danger)" stroke="#fff" strokeWidth={hs / 8}
                style={{ cursor: 'ew-resize', touchAction: 'none' }} onPointerDown={startRadius} />
            ))}
          </g>
        )}
        {isMeleeArea && <text x={0} y={-boxH - 0.06} fontSize="0.13" textAnchor="middle" fill="var(--danger)">공격자 중심 폭 {(half * 2).toFixed(2)}</text>}
      </svg>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
        <button className="primary" disabled={!hitFrames.length && !atkFrames.length} onClick={() => setCast({ start: performance.now() })}>▶ 공격 재생</button>
        <label className="muted">프레임 간격(ms){' '}
          <input type="number" min="20" step="10" value={frameMs} onChange={(e) => setFrameMs(Math.max(20, Number(e.target.value) || 150))} style={{ width: 70 }} />
        </label>
        <button disabled={headY == null} onClick={() => { set('HitEffectOffsetX', '0'); set('HitEffectOffsetY', r2(headY)); }}>이펙트 피벗 → 대상 머리 위</button>
        <button onClick={() => { set('HitEffectOffsetX', ''); set('HitEffectOffsetY', ''); set('HitEffectScale', ''); }}>타격 이펙트 위치·크기 초기화</button>
        <label className="muted">대상 몬스터{' '}
          <select value={refId} onChange={(e) => setRefId(e.target.value)} style={{ width: 'auto' }}>
            {enemies.map((u) => <option key={u.UnitId} value={u.UnitId}>{u.Name}</option>)}
          </select>
        </label>
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        {isRangedArea && <>맞힌 대상(사거리 끝) 중심의 붉은 상자 폭이 실제 피해 범위입니다. <b>붉은 막대를 좌우로 끌어</b> 반경(AttackAreaRadius)을 조절하세요. 흐리게 보이는 적은 맞지 않는 적입니다(범위 밖이거나 최대 마릿수 초과, 간격은 참고용 더미). 빨간 번호 = 기준점에서 가까운 순서(최대 마릿수 {maxT > 0 ? maxT : '무제한'}).</>}
        {isMeleeArea && <>공격자 중심으로 사거리 안 전부에게 피해(붉은 상자). 주변 적은 참고용 더미입니다.</>}
        {!isRangedArea && !isMeleeArea && <>단일 공격: 맞은 대상 하나에게만 피해와 타격 이펙트가 들어갑니다.</>}
        <br />타격 이펙트는 맞은 적 각각에게 발 위 {aimY.toFixed(2)}{hasY ? '' : '(기본)'} 높이에 이펙트 피벗을 두고 재생됩니다(<b>이펙트를 끌어 위치 X·Y 조절</b>, 대상 몬스터 크기는 위 선택에 따름){cast ? ` · t=${now.toFixed(2)}s` : ''}. 타격 시점 {hitDelay}초 뒤에 재생. 아군은 오른쪽을 봅니다.
        {!draft.HitEffectRuid?.trim() && ' (HitEffectRuid가 비어 타격 이펙트는 없음)'}
        {hitFx?.ok && hitFrames.length === 0 && ' 타격 이펙트 프레임 정보를 가져오지 못했습니다.'}
        {!bodyFrame && ' StandRuid가 있어야 공격자가 그려집니다.'}
      </div>
    </div>
  );
}
