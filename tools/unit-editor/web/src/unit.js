// 목록·시간표·칩에 쓰는 유닛 그림: 스킬은 카드 아이콘 또는 범위 이펙트, 나머지는 stand 클립.
export function unitIconRuid(u) {
  if (!u) return '';
  return u.Kind === 'skill' ? u.IconRuid || u.EffectRuid : u.StandRuid;
}

// 목록·표 정렬. 같은 값이면 보조 기준(등급순이면 마나, 마나순이면 등급)과 이름으로 이어서 정렬한다.
export const SORT_OPTIONS = [['Rarity', '등급순'], ['Cost', '마나순'], ['', '표 순서']];
const NUMERIC = ['Cost', 'Attack', 'MaxHp', 'Speed'];
const TIEBREAK = { Rarity: ['Cost'], Cost: ['Rarity'] };

export function sortUnits(list, key, dir, rarityOrder) {
  if (!key) return list;
  const val = (u, k) => {
    if (k === 'Rarity') return rarityOrder.indexOf(u.Rarity);
    if (NUMERIC.includes(k)) return u[k] === '' || u[k] == null ? -Infinity : Number(u[k]);
    return u[k] ?? '';
  };
  const cmp = (a, b) => (a > b ? 1 : a < b ? -1 : 0);
  return [...list].sort((a, b) => {
    const c = cmp(val(a, key), val(b, key));
    if (c) return c * dir;
    for (const k of TIEBREAK[key] || []) { const t = cmp(val(a, k), val(b, k)); if (t) return t; }
    return cmp(a.Name || '', b.Name || '');
  });
}

// 종류(Kind) 드롭다운을 바꿀 때 폼을 새 종류에 맞게 정리한다: 새 종류가 쓰지 않는 칸은 비우고(이전 종류의 기본값이
// 남아 "쓰지 않는 칸입니다" 오류가 나던 문제), 새로 쓰게 된 칸이 비어 있으면 그 칸의 기본값을 채운다.
// 효과 규칙은 몬스터·설치물만 쓴다.
export function adaptToKind(draft, kind, schema) {
  if (!kind) return { ...draft, Kind: kind };
  const next = { ...draft, Kind: kind };
  for (const f of schema.fields) {
    if (f.key === 'Kind' || f.key === 'UnitId') continue;
    if (!f.kinds.includes(kind)) next[f.key] = '';
    else if ((next[f.key] === '' || next[f.key] == null) && f.default != null) next[f.key] = f.default;
  }
  if (kind !== 'monster' && kind !== 'build') next.effects = [];
  return next;
}
