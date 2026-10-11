import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PALETTE, MAX_COLORS, SIZE, drawPixelIcon, emptyCells, parsePixelIcon, serializePixelIcon } from './pixelIcon.js';

// 이미 만들어진 도트 그림을 목록 등에서 작게 보여 준다. 그림이 없으면 아무것도 그리지 않는다(빈 칸 틀만).
export function PixelThumb({ value, size = 44 }) {
  const ref = useRef(null);
  const parsed = parsePixelIcon(value);
  useEffect(() => {
    if (ref.current && parsed) drawPixelIcon(ref.current, parsed.colors, parsed.cells);
  }, [value]);
  if (!parsed) return <div className="thumb" style={{ width: size, height: size }} />;
  return <canvas ref={ref} className="thumb pixel" style={{ width: size, height: size }} title="도트 아이콘" />;
}

function PreviewCanvas({ colors, cells, scale, mirror, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) drawPixelIcon(ref.current, colors, cells, { mirror });
  });
  return (
    <div className="pi-prev">
      <canvas ref={ref} className="pixel" style={{ width: SIZE * scale, height: SIZE * scale }} />
      <span className="muted">{label}</span>
    </div>
  );
}

// 12×12 도트 편집기. value = PixelIcon 문자열, onChange(문자열). 칸은 팔레트 번호를 가진다(-1 = 투명).
// 팔레트는 이 편집기가 들고 있고(안 쓰는 색도 남는다), 저장 문자열에는 쓰인 색만 들어간다.
const CELL = 26;          // 칸 한 변(px). CSS .pi-cell과 같아야 한다
const PITCH = CELL + 1;   // 칸 + 격자선 1px

export default function PixelIconEditor({ value, onChange }) {
  const initial = parsePixelIcon(value);
  const [palette, setPalette] = useState(() => (initial ? [...initial.colors] : [...DEFAULT_PALETTE]));
  const [cells, setCells] = useState(() => (initial ? initial.cells : emptyCells()));
  const [pick, setPick] = useState(0);            // 선택한 색 번호, -1 = 지우개
  const lastEmitted = useRef(value ?? '');
  const painting = useRef(null);                  // 드래그 중: { mode: 'paint' | 'erase', last: 마지막 칸 }
  const gridRef = useRef(null);

  // 다른 효과를 열었거나 밖에서 값이 바뀌었으면 편집기 상태를 다시 맞춘다.
  useEffect(() => {
    if ((value ?? '') === lastEmitted.current) return;
    lastEmitted.current = value ?? '';
    const p = parsePixelIcon(value);
    setPalette(p ? [...p.colors] : [...DEFAULT_PALETTE]);
    setCells(p ? p.cells : emptyCells());
    setPick(0);
  }, [value]);

  const commit = (nextCells, nextPalette = palette) => {
    setCells(nextCells);
    setPalette(nextPalette);
    const text = serializePixelIcon(nextPalette, nextCells);
    lastEmitted.current = text;
    onChange(text);
  };

  // 칸 하나 또는 이전 칸에서 이 칸까지 이은 선(빠르게 끌어도 중간 칸이 빠지지 않게)을 한 번에 칠한다.
  const paintLine = (from, to, mode) => {
    const v = mode === 'erase' ? -1 : pick;
    const next = cells.slice();
    let x = from % SIZE; let y = Math.floor(from / SIZE);
    const tx = to % SIZE; const ty = Math.floor(to / SIZE);
    const dx = Math.abs(tx - x); const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1; const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      next[y * SIZE + x] = v;
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    if (next.some((c, i) => c !== cells[i])) commit(next);
  };
  const cellAt = (e) => {
    const rect = gridRef.current.getBoundingClientRect();
    const col = Math.min(SIZE - 1, Math.max(0, Math.floor((e.clientX - rect.left - 1) / PITCH)));
    const row = Math.min(SIZE - 1, Math.max(0, Math.floor((e.clientY - rect.top - 1) / PITCH)));
    return row * SIZE + col;
  };
  const down = (e) => {
    e.preventDefault();
    const i = cellAt(e);
    const mode = e.button === 2 || pick < 0 ? 'erase' : 'paint';
    painting.current = { mode, last: i };
    paintLine(i, i, mode);
  };
  const move = (e) => {
    const p = painting.current;
    if (!p || !e.buttons) return;
    const i = cellAt(e);
    if (i === p.last) return;
    paintLine(p.last, i, p.mode);
    p.last = i;
  };
  useEffect(() => {
    const up = () => { painting.current = null; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const shift = (dx, dy) => {
    const next = emptyCells();
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) next[ny * SIZE + nx] = cells[y * SIZE + x];
    }
    commit(next);
  };
  const flip = () => {
    const next = emptyCells();
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) next[y * SIZE + x] = cells[y * SIZE + (SIZE - 1 - x)];
    commit(next);
  };
  const recolor = (i, hex) => commit(cells, palette.map((c, j) => (j === i ? hex : c)));
  const addColor = () => {
    if (palette.length >= MAX_COLORS) return;
    setPalette([...palette, 'ffffff']);
    setPick(palette.length);
  };

  const used = new Set(cells.filter((c) => c >= 0));
  const safeColors = palette;
  return (
    <div className="pixel-editor">
      <div className="pi-main">
        <div
          ref={gridRef}
          className="pi-grid"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={down}
          onPointerMove={move}
          style={{ gridTemplateColumns: `repeat(${SIZE}, ${CELL}px)` }}
        >
          {cells.map((c, i) => (
            <div
              key={i}
              className="pi-cell"
              style={c >= 0 ? { background: `#${safeColors[c]}` } : undefined}
            />
          ))}
        </div>
        <div className="pi-side">
          <div className="pi-palette">
            {palette.map((hex, i) => (
              <button
                key={i}
                className={`pi-swatch ${pick === i ? 'on' : ''}`}
                style={{ background: `#${hex}` }}
                title={`#${hex}${used.has(i) ? '' : ' (안 쓰는 색)'}`}
                onClick={() => setPick(i)}
              />
            ))}
            {palette.length < MAX_COLORS && <button className="pi-swatch add" title="색 추가" onClick={addColor}>+</button>}
          </div>
          <div className="pi-row">
            <button className={pick < 0 ? 'primary' : ''} onClick={() => setPick(pick < 0 ? 0 : -1)}>지우개</button>
            {pick >= 0 && (
              <label className="pi-color" title="선택한 색을 바꾼다 (이 색을 쓴 칸이 모두 바뀜)">
                색 바꾸기
                <input type="color" value={`#${palette[pick] ?? 'ffffff'}`} onChange={(e) => recolor(pick, e.target.value.slice(1))} />
              </label>
            )}
          </div>
          <div className="pi-row">
            <button onClick={() => shift(0, -1)} title="위로">↑</button>
            <button onClick={() => shift(0, 1)} title="아래로">↓</button>
            <button onClick={() => shift(-1, 0)} title="왼쪽으로">←</button>
            <button onClick={() => shift(1, 0)} title="오른쪽으로">→</button>
            <button onClick={flip}>좌우 반전</button>
            <button onClick={() => commit(emptyCells())}>모두 지우기</button>
          </div>
          <div className="pi-previews">
            <PreviewCanvas colors={safeColors} cells={cells} scale={1} mirror={false} label={`실제 크기(${SIZE}px)`} />
            <PreviewCanvas colors={safeColors} cells={cells} scale={3} mirror={false} label="아군 (3배)" />
            <PreviewCanvas colors={safeColors} cells={cells} scale={3} mirror label="적 (좌우 반전, 3배)" />
          </div>
        </div>
      </div>
      <div className="muted">
        칸을 클릭하거나 끌어서 찍고, 우클릭(또는 지우개)으로 지웁니다. 게임에서는 유닛 머리 위에 약 26px로 뜨고(칸 하나가 약 2px),
        적 유닛에게는 좌우가 반전됩니다. 체크무늬 칸은 "안 찍은 칸"이고 게임에서는 흰 바탕(바깥 한 줄은 검정 테두리)으로 나옵니다 — 아래 미리보기가 실제 모양입니다. 아무것도 찍지 않고 저장하면 빈칸 = 코드의 기본 아이콘(없으면 아이콘 없음)입니다.
      </div>
    </div>
  );
}
