// 효과 도트 아이콘(EffectTable.PixelIcon) 형식. 서버의 schema.cjs parsePixelIcon, 게임의 BattleFx.ParsePixelIcon과 같은 규칙이다.
//   "ff4d4d ffd166;0......0/.1....1./..."  = 색 목록(RRGGBB, 공백 구분, 최대 16) ; 12줄(12글자, "."=투명, 0-f=색 번호)
export const SIZE = 12;
export const MAX_COLORS = 16;
export const DEFAULT_PALETTE = ['ff4d4d', 'ffa633', 'ffd166', '73f24d', '66e6ff', '6699ff', 'bf66ff', 'ffffff', '000000'];

export const emptyCells = () => Array(SIZE * SIZE).fill(-1);

// 문자열 → { colors, cells } (cells = 64칸, -1 = 투명, 그 외 colors 번호). 비었거나 형식이 틀리면 null.
export function parsePixelIcon(text) {
  const s = (text || '').trim();
  const parts = s.split(';');
  if (parts.length !== 2) return null;
  const colors = parts[0].trim() === '' ? [] : parts[0].trim().split(/\s+/);
  if (colors.length > MAX_COLORS || colors.some((c) => !/^[0-9a-fA-F]{6}$/.test(c))) return null;
  const rows = parts[1].split('/');
  if (rows.length !== SIZE || rows.some((r) => r.length !== SIZE)) return null;
  const cells = [];
  for (const row of rows) {
    for (const ch of row) {
      if (ch === '.') { cells.push(-1); continue; }
      const idx = parseInt(ch, 16);
      if (!/^[0-9a-f]$/.test(ch) || idx >= colors.length) return null;
      cells.push(idx);
    }
  }
  return { colors: colors.map((c) => c.toLowerCase()), cells };
}

// 색 목록과 칸 → 문자열. 쓰이는 색만 남기고 번호를 다시 매긴다. 찍힌 칸이 없으면 '' (= 기본 아이콘 사용).
export function serializePixelIcon(colors, cells) {
  const used = [...new Set(cells.filter((c) => c >= 0))].sort((a, b) => a - b);
  if (used.length === 0) return '';
  const remap = new Map(used.map((old, i) => [old, i]));
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const c = cells[y * SIZE + x];
      row += c < 0 ? '.' : remap.get(c).toString(16);
    }
    rows.push(row);
  }
  return `${used.map((i) => colors[i]).join(' ')};${rows.join('/')}`;
}

// 게임(BattleFx.CreateIcon)과 같은 모양으로 그린다: 안 찍힌 칸은 흰 바탕, 그중 바깥 한 줄은 검정 테두리.
// 찍힌 칸은 자기 색을 그대로 쓴다. mirror = 적 팀(좌우 반전).
export function drawPixelIcon(canvas, colors, cells, { mirror = false } = {}) {
  const ctx = canvas.getContext('2d');
  canvas.width = SIZE;
  canvas.height = SIZE;
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const sx = mirror ? SIZE - 1 - x : x;
      const c = cells[y * SIZE + sx];
      const ring = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
      ctx.fillStyle = c >= 0 ? `#${colors[c]}` : ring ? '#000000' : '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
