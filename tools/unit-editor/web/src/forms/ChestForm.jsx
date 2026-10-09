import Field, { ExtraFields } from '../Field.jsx';
import { Badge } from '../ui.jsx';

const RARITIES = ['normal', 'rare', 'epic', 'unique', 'legendary'];
const CHANCE_KEYS = { normal: 'ChanceNormal', rare: 'ChanceRare', epic: 'ChanceEpic', unique: 'ChanceUnique', legendary: 'ChanceLegendary' };
const RARITY_COLORS = { normal: '#9e9e9e', rare: '#4089ff', epic: '#a854f7', unique: '#e6c21a', legendary: '#7cc22e' };

const chanceSum = (draft) => RARITIES.reduce((s, r) => s + (Number(draft[CHANCE_KEYS[r]]) || 0), 0);

export function ChestBadges({ draft, data, originalId }) {
  const sum = chanceSum(draft);
  const rewardOf = data.chests.find((c) => c.ChestId === originalId)?._status.rewardOf ?? [];
  const price = Number(draft.PriceMeso) || 0;
  return (
    <>
      {Math.abs(sum - 100) < 0.001 ? <Badge type="ok">확률 합 100%</Badge> : <Badge type="warn">확률 합 {sum}%</Badge>}
      {price > 0 ? <Badge type="ally">상점 {price} 메소</Badge> : <Badge type="none">상점 판매 안 함</Badge>}
      {rewardOf.length > 0 && <Badge type="enemy">보상: {rewardOf.join(', ')}</Badge>}
    </>
  );
}

// 카드 한 장의 등급 확률이 돌 하나에서 몇 장으로 나오는지 미리 계산해 보여 준다.
function DropPreview({ draft, data }) {
  const cards = Number(draft.Cards) || 0;
  const sum = chanceSum(draft);
  const units = data.chests[0]?._status.cardUnits ?? {};
  const labels = data.schema.rarityLabels;
  return (
    <div className="drop-preview">
      <div className="bar">
        {RARITIES.map((r) => {
          const pct = Number(draft[CHANCE_KEYS[r]]) || 0;
          return pct > 0 ? <span key={r} style={{ width: `${(pct / Math.max(sum, 100)) * 100}%`, background: RARITY_COLORS[r] }} title={`${labels[r]} ${pct}%`} /> : null;
        })}
      </div>
      <table>
        <thead><tr><th>등급</th><th>확률</th><th>돌 하나당 기대 장수</th><th>나올 수 있는 카드</th></tr></thead>
        <tbody>
          {RARITIES.map((r) => {
            const pct = Number(draft[CHANCE_KEYS[r]]) || 0;
            return (
              <tr key={r} className={pct > 0 ? '' : 'muted'}>
                <td><span className="dot" style={{ background: RARITY_COLORS[r] }} />{labels[r]}</td>
                <td>{pct}%</td>
                <td>{(cards * pct / 100).toFixed(2)}장</td>
                <td>{units[r] ?? 0}종{pct > 0 && !units[r] ? ' — 없음, 한 단계 낮은 등급으로 나옴' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="muted">
        카드 {cards}장마다 위 확률로 등급을 굴린 뒤 그 등급의 카드 유닛 중 하나가 나옵니다.
        {draft.Guarantee ? ` 첫 장은 ${labels[draft.Guarantee]} 이상이 보장됩니다.` : ''} 합계 {sum}%{Math.abs(sum - 100) < 0.001 ? '' : ' — 100%가 되어야 저장됩니다'}.
      </div>
    </div>
  );
}

export default function ChestForm({ draft, set, data }) {
  const { schema } = data;
  return (
    <>
      {schema.chestGroups.map((g) => (
        <fieldset key={g.id}>
          <legend>{g.label}</legend>
          <div className="grid">
            {schema.chestFields.filter((f) => f.group === g.id).map((f) => (
              <Field key={f.key} field={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} schema={schema} data={data} />
            ))}
          </div>
          {g.id === 'chance' && <DropPreview draft={draft} data={data} />}
        </fieldset>
      ))}
      <ExtraFields header={schema.chestHeader} known={schema.chestFields.map((f) => f.key)} draft={draft} set={set} />
    </>
  );
}
