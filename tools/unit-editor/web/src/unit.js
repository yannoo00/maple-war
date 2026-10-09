// 목록·시간표·칩에 쓰는 유닛 그림: 스킬은 카드 아이콘 또는 범위 이펙트, 나머지는 stand 클립.
export function unitIconRuid(u) {
  if (!u) return '';
  return u.Kind === 'skill' ? u.IconRuid || u.EffectRuid : u.StandRuid;
}
