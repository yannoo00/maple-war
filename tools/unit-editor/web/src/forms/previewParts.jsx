// 이펙트 미리보기 공용 조각. 월드 좌표(1 = 100px, y는 위가 +)를 SVG(y는 아래가 +)로 옮겨 그린다.

// 프레임의 피벗이 월드 (ox, oy)에 오도록 그린다. k = 픽셀당 월드 유닛, mirror = ox를 축으로 좌우 반전.
export function Frame({ frame, k, ox, oy, mirror = false, opacity = 1 }) {
  const img = (
    <image
      href={`/api/sprite/${frame.spriteRuid}`}
      x={ox - frame.px * k}
      y={-(oy + (frame.height - frame.py) * k)}
      width={frame.width * k}
      height={frame.height * k}
      opacity={opacity}
      preserveAspectRatio="none"
    />
  );
  return mirror ? <g transform={`translate(${2 * ox} 0) scale(-1 1)`}>{img}</g> : img;
}

// 지면선과 월드 유닛 눈금.
export function Ground({ xMin, xMax }) {
  const step = xMax - xMin > 12 ? 2 : 1;
  const ticks = [];
  for (let t = Math.ceil(xMin / step) * step; t <= xMax; t += step) ticks.push(t);
  return (
    <g>
      <line x1={xMin} x2={xMax} y1="0" y2="0" stroke="var(--muted)" strokeWidth="0.02" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={t} x2={t} y1="0" y2="0.07" stroke="var(--muted)" strokeWidth="0.015" />
          <text x={t} y="0.25" fontSize="0.14" textAnchor="middle" fill="var(--muted)">{t}</text>
        </g>
      ))}
    </g>
  );
}

export const stageStyle = { width: '100%', maxHeight: 340, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6 };
