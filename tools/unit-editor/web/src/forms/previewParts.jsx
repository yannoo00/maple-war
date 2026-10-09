import { useRef } from 'react';

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

// ---------- 드래그 편집 (파워포인트처럼: 안쪽을 끌면 이동, 모서리를 끌면 크기, 반대쪽 모서리는 고정) ----------
// SVG 위의 포인터를 월드 좌표(y 위가 +)로 바꾸고, 드래그 중 이동 콜백을 호출한다.
export function useSvgDrag() {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const toWorld = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: -p.y };
  };
  // onMove(현재 월드 좌표, 시작 월드 좌표). 호출하는 쪽의 클로저에 드래그 시작 시점의 값을 담아 둔다.
  const begin = (e, onMove) => {
    e.preventDefault();
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { onMove, start: toWorld(e) };
  };
  const end = () => { drag.current = null; };
  const handlers = {
    onPointerMove: (e) => { if (drag.current) drag.current.onMove(toWorld(e), drag.current.start); },
    onPointerUp: end,
    onPointerCancel: end,
  };
  return { svgRef, begin, handlers };
}

// 고정점(a)을 두고 모서리(c0)를 현재 위치(cur)로 끌었을 때의 균등 배율 (대각선 방향 투영).
export function scaleFactor(cur, a, c0) {
  const dx = c0.x - a.x, dy = c0.y - a.y;
  return Math.max(0.05, ((cur.x - a.x) * dx + (cur.y - a.y) * dy) / ((dx * dx + dy * dy) || 1));
}

// 사각형 { x0, x1, y0, y1 } 의 모서리 4개: 끄는 모서리 c, 고정되는 반대 모서리 a.
export function rectCorners(r) {
  return [
    { c: { x: r.x0, y: r.y0 }, a: { x: r.x1, y: r.y1 }, cursor: 'nesw-resize' },
    { c: { x: r.x1, y: r.y0 }, a: { x: r.x0, y: r.y1 }, cursor: 'nwse-resize' },
    { c: { x: r.x0, y: r.y1 }, a: { x: r.x1, y: r.y0 }, cursor: 'nwse-resize' },
    { c: { x: r.x1, y: r.y1 }, a: { x: r.x0, y: r.y0 }, cursor: 'nesw-resize' },
  ];
}

// 크기 조절 손잡이(작은 흰 사각형).
export function Handle({ x, y, size, cursor, onPointerDown }) {
  return (
    <rect
      x={x - size / 2} y={-y - size / 2} width={size} height={size}
      fill="#fff" stroke="var(--accent)" strokeWidth={size / 8}
      style={{ cursor, touchAction: 'none' }} onPointerDown={onPointerDown}
    />
  );
}

// 안쪽을 끌면 이동하는 투명한 영역.
export function MoveArea({ rect, onPointerDown }) {
  return (
    <rect
      x={rect.x0} y={-rect.y1} width={rect.x1 - rect.x0} height={rect.y1 - rect.y0}
      fill="transparent" style={{ cursor: 'move', touchAction: 'none' }} onPointerDown={onPointerDown}
    />
  );
}
