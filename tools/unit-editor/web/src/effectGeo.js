import { useEffect, useState } from 'react';

// 이펙트·몬스터 프레임의 배치와 "실제로 그려진 영역"을 계산하는 도구.
// 프레임은 리소스 API의 frames: { spriteRuid, width, height, px, py }
// (px = 가로 피벗, py = 세로 피벗. 모두 왼쪽 아래 기준 픽셀, 엔진은 피벗을 엔티티 위치에 맞춰 그린다).

export const r2 = (v) => String(Math.round(v * 100) / 100);

const boxCache = new Map();

// 프레임 PNG에서 그려진 영역. 희미한 입자 몇 개에 영역이 끌려가지 않도록 알파 질량의 가장자리 2%씩은 버린다.
// { l, r, b, t } = 영역(px, 왼쪽 아래 기준), { cx, cy } = 알파 무게중심(px, 같은 기준). 못 읽으면 null.
const EDGE = 0.02;


export function alphaBox(spriteRuid) {
  if (!boxCache.has(spriteRuid)) {
    boxCache.set(spriteRuid, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const rows = new Float64Array(height);
          const cols = new Float64Array(width);
          let total = 0, sx = 0, sy = 0;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const a = data[(y * width + x) * 4 + 3];
              if (a > 16) { rows[y] += a; cols[x] += a; total += a; sx += a * (x + 0.5); sy += a * (y + 0.5); }
            }
          }
          if (!total) { resolve(null); return; }
          const at = (arr, q) => { let acc = 0; for (let i = 0; i < arr.length; i++) { acc += arr[i]; if (acc >= total * q) return i; } return arr.length - 1; };
          const top = at(rows, EDGE), bottom = at(rows, 1 - EDGE) + 1;
          resolve({ l: at(cols, EDGE), r: at(cols, 1 - EDGE) + 1, b: height - bottom, t: height - top, cx: sx / total, cy: height - sy / total, mass: total });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = `/api/sprite/${spriteRuid}`;
    }));
  }
  return boxCache.get(spriteRuid);
}

// 프레임이 많으면 고르게 최대 max장만 읽는다.
export function sampleFrames(frames, max = 10) {
  if (frames.length <= max) return frames;
  return Array.from({ length: max }, (_, n) => frames[Math.round((n * (frames.length - 1)) / (max - 1))]);
}

// 게임(FieldFx.PlaySkillEffect)이 기준으로 삼는 프레임: 가장 넓은 프레임(같으면 앞쪽).
export function largestFrame(frames) {
  return frames.reduce((best, f) => (best === null || f.width > best.width ? f : best), null);
}

// 프레임들의 그려진 영역을 피벗 기준 px 범위 { minX, maxX, minY, maxY } 로 합치고, 알파 무게중심 { cx, cy }(피벗 기준 px)도 구한다. 계산 전/실패면 null.
export function useContentRange(frames) {
  const key = frames.map((f) => f.spriteRuid).join(',');
  const [range, setRange] = useState(null);
  useEffect(() => {
    let alive = true;
    setRange(null);
    const picks = sampleFrames(frames);
    Promise.all(picks.map((f) => alphaBox(f.spriteRuid))).then((boxes) => {
      if (!alive) return;
      let acc = null;
      let mass = 0, mx = 0, my = 0;
      boxes.forEach((b, n) => {
        if (!b) return;
        const f = picks[n];
        const x0 = b.l - f.px, x1 = b.r - f.px, y0 = b.b - f.py, y1 = b.t - f.py;
        acc = acc
          ? { minX: Math.min(acc.minX, x0), maxX: Math.max(acc.maxX, x1), minY: Math.min(acc.minY, y0), maxY: Math.max(acc.maxY, y1) }
          : { minX: x0, maxX: x1, minY: y0, maxY: y1 };
        mass += b.mass; mx += b.mass * (b.cx - f.px); my += b.mass * (b.cy - f.py);
      });
      setRange(acc && { ...acc, cx: mx / mass, cy: my / mass });
    });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return range;
}

// 애니메이션 미리보기용 프레임 번호.
export function useFrameIndex(count, playing, ms = 100) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!playing || count < 2) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % count), ms);
    return () => clearInterval(t);
  }, [count, playing, ms]);
  return count ? i % count : 0;
}
