import { useState } from 'react';
import type { Ctx } from '../App';
import type { Preset } from '../domain/types';
import { CatDot, FoodPic, Sheet, TopBar, yen } from './parts';

const DAY_CHOICES = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30, 60, 90, 180];

export function PresetsPage({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { data } = ctx;
  const [edit, setEdit] = useState<Preset | null>(null);
  const placeName = (id: string) => data.places.find((x) => x.id === id)?.name ?? '';
  return (
    <div className="page presets">
      <TopBar title="食材の目安と値段" onBack={onClose} />
      <p className="muted small lead">押すと日数と値段を変えられます。日数は「買った日から何日くらいで食べ切るか」の目安で、タベドキ独自の値です。袋や箱に書かれた期限があれば、そちらが優先です。</p>
      {data.cats.map((c) => {
        const ps = data.presets.filter((p) => p.cat === c.id);
        if (!ps.length) return null;
        return (
          <section key={c.id} className="pre-group">
            <h2><CatDot color={c.color} />{c.name}</h2>
            <ul>
              {ps.map((p) => (
                <li key={p.id}>
                  <button className={'pre-row' + (p.hidden ? ' hidden' : '')} onClick={() => setEdit(p)}>
                    <FoodPic name={p.name} cat={c} size={40} />
                    <span className="pre-main">
                      <span className="pre-name">{p.name}{p.hidden && <small>(隠している)</small>}</span>
                      <span className="muted small">{placeName(p.place)}・{p.kind === 'shohi' ? '消費' : '賞味'}</span>
                    </span>
                    <span className="pre-days">{p.days}日</span>
                    <span className="pre-yen muted">{p.price ? yen(p.price) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="card about-src">
        <h2>目安の考え方と出典</h2>
        <p>食品ごとの「家庭で何日もつか」を公的機関がまとめた一覧は見つからなかったため、日数はタベドキが一般的な家庭の使い方から決めた目安です。短めにしてあります。</p>
        <p>保存の前提は、厚生労働省「家庭でできる食中毒予防の6つのポイント」の「冷蔵庫は10℃以下、冷凍庫は-15℃以下に維持することがめやす」「早めに使いきるようにしましょう」に沿っています。</p>
        <p className="muted small">https://www.mhlw.go.jp/www1/houdou/0903/h0331-1.html</p>
        <p>開けた後は、袋の期限より早く傷みます。においや見た目がおかしい物は食べないでください。</p>
      </section>

      {edit && (
        <Sheet title={edit.name} onClose={() => setEdit(null)}>
          <EditPreset p={edit} onSave={(np) => { ctx.setData((d) => ({ ...d, presets: d.presets.map((x) => (x.id === np.id ? np : x)) })); setEdit(null); }} />
        </Sheet>
      )}
    </div>
  );
}

function EditPreset({ p, onSave }: { p: Preset; onSave: (p: Preset) => void }) {
  const [days, setDays] = useState(p.days);
  const [price, setPrice] = useState(String(p.price || ''));
  const [hidden, setHidden] = useState(!!p.hidden);
  return (
    <>
      <p className="field-label">買ってから何日くらい?</p>
      <div className="chips-sel">
        {[...new Set([...DAY_CHOICES, p.days])].sort((a, b) => a - b).map((d) => (
          <button key={d} className={'cat' + (days === d ? ' on' : '')} onClick={() => setDays(d)}>{d}日</button>
        ))}
      </div>
      <div className="row2">
        <label className="field">いつもの値段<input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />円</label>
        <label className="check-label"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />ワンタップに出さない</label>
      </div>
      <button className="btn primary wide big" onClick={() => onSave({ ...p, days, price: Math.max(0, Number(price) || 0), hidden })}>保存する</button>
    </>
  );
}
