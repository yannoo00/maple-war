import { useResource } from '../api.js';

// 스킬이 실제 전투에서 차지하는 모양: 이펙트와 피해 범위를 같은 축척으로 겹쳐 보여 준다.
// 게임(FieldFx.PlaySkillEffect)과 같은 규칙: 피해 폭 = 범위 × RangeScale × 2, 이펙트는 그 폭 × 이펙트 크기로 늘려
// 범위 중심에 가로로 맞추고 바닥을 지면에 둔다. 월드 유닛 기준(1칸 = 100px).
export default function SkillPreview({ draft, battle }) {
  const res = useResource(draft.EffectRuid?.trim());
  const radius = Number(draft.SkillRadius);
  const scale = Number(draft.EffectScale) || 1;
  if (!(radius > 0)) return <div className="muted">범위(SkillRadius)를 넣으면 범위가 그려집니다.</div>;

  const areaW = radius * battle.rangeScale * 2;
  const hasClip = res?.ok && res.width > 0 && res.height > 0;
  const effW = hasClip ? areaW * scale : 0;
  const effH = hasClip ? effW * (res.height / res.width) : 0;

  const boxH = battle.skillBoxHeight;
  const top = Math.max(effH, boxH) * 1.15;
  const span = Math.max(areaW, effW, 3) * 1.25;
  const step = span > 12 ? 2 : 1;
  const ticks = [];
  for (let t = Math.ceil(-span / 2 / step) * step; t <= span / 2; t += step) ticks.push(t);

  const ratio = hasClip ? effW / areaW : 1;
  const fit = !hasClip ? null : ratio > 1.2 ? `이펙트가 피해 범위보다 ${Math.round((ratio - 1) * 100)}% 넓음` : ratio < 0.8 ? `이펙트가 피해 범위보다 ${Math.round((1 - ratio) * 100)}% 좁음` : '이펙트와 범위가 거의 일치';

  return (
    <div>
      <svg viewBox={`${-span / 2} ${-top} ${span} ${top + 0.35}`} style={{ width: '100%', maxHeight: 260, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6 }}>
        {hasClip && <image href={res.thumbnail} x={-effW / 2} y={-effH} width={effW} height={effH} preserveAspectRatio="none" />}
        <rect x={-areaW / 2} y={-boxH} width={areaW} height={boxH} fill="var(--danger)" fillOpacity="0.18" stroke="var(--danger)" strokeWidth="0.02" strokeDasharray="0.06 0.04" />
        <line x1={-span / 2} x2={span / 2} y1="0" y2="0" stroke="var(--muted)" strokeWidth="0.02" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={t} x2={t} y1="0" y2="0.07" stroke="var(--muted)" strokeWidth="0.015" />
            <text x={t} y="0.25" fontSize="0.14" textAnchor="middle" fill="var(--muted)">{t}</text>
          </g>
        ))}
      </svg>
      <div className="muted" style={{ marginTop: 4 }}>
        피해 폭 <b>{areaW.toFixed(2)}</b> 유닛 (범위 {radius} × {battle.rangeScale} × 2, 붉은 점선 박스 · 높이는 게임의 미리보기 박스 {boxH}, 피해에는 영향 없음)
        {hasClip ? <> · 이펙트 폭 <b>{effW.toFixed(2)}</b> ({fit})</> : ' · 범위 이펙트 RUID를 넣으면 이펙트가 겹쳐 보입니다'}
        <br />눈금은 월드 유닛(가운데 0 = 범위 중심). 이펙트는 그림 전체 크기 기준이라 투명한 가장자리가 있으면 실제 보이는 폭은 더 좁을 수 있습니다.
      </div>
    </div>
  );
}
