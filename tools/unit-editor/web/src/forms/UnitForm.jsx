import Field, { ExtraFields } from '../Field.jsx';
import { Badge } from '../ui.jsx';

export function UnitBadges({ draft, enemyStages }) {
  const price = Number(draft.Price || 0);
  const ally = Number(draft.Starter || 0) > 0 ? '스타터 지급' : price > 0 ? `메소 ${price}에 구매` : null;
  return (
    <>
      {ally && <Badge type="ally">{ally}</Badge>}
      {enemyStages.length > 0 && <Badge type="enemy">적: {enemyStages.join(', ')}</Badge>}
      {!ally && !enemyStages.length && <Badge type="none">스타터도 구매도 아님</Badge>}
    </>
  );
}

export default function UnitForm({ draft, set, data }) {
  const { schema } = data;
  const kind = draft.Kind;
  const known = schema.fields.map((f) => f.key);
  return (
    <>
      {schema.groups.filter((g) => g.kinds.includes(kind)).map((g) => (
        <fieldset key={g.id}>
          <legend>{g.label}</legend>
          <div className="grid">
            {schema.fields.filter((f) => f.group === g.id && f.kinds.includes(kind)).map((f) => (
              <Field key={f.key} field={f} kind={kind} value={draft[f.key]} onChange={(v) => set(f.key, v)} schema={schema} data={data} />
            ))}
          </div>
        </fieldset>
      ))}
      <ExtraFields header={schema.header} known={known} draft={draft} set={set} />
    </>
  );
}
