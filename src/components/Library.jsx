import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  WORKOUT_CATEGORIES, DIFFICULTIES, FOOD_CATEGORIES, FOOD_CATEGORY_LABEL,
  workoutMeta, foodMeta, WorkoutDetail, FoodDetail,
} from './catalog';

// Browse the workout or dinner library and add your own entries
export default function Library({ type }) {
  const isWorkouts = type === 'workouts';
  const categories = isWorkouts ? WORKOUT_CATEGORIES : FOOD_CATEGORIES;
  const catLabel = (c) => (isWorkouts ? c : FOOD_CATEGORY_LABEL[c]);
  const meta = isWorkouts ? workoutMeta : foodMeta;
  const Detail = isWorkouts ? WorkoutDetail : FoodDetail;

  const [items, setItems] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from(type).select('*').order('name');
    setItems(data ?? []);
  }, [type]);

  useEffect(() => { load(); setCat('all'); setQ(''); setAdding(false); }, [load]);

  async function remove(id) {
    if (!confirm('Remove this from your library?')) return;
    await supabase.from(type).delete().eq('id', id);
    load();
  }

  const shown = items.filter(
    (i) => (cat === 'all' || i.category === cat) && i.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <section className="library">
      <div className="toolbar">
        <h2>{isWorkouts ? 'Workout library' : 'Dinner ideas'}</h2>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : '+ Add your own'}</button>
      </div>

      {adding && <AddForm type={type} onAdded={() => { setAdding(false); load(); }} />}

      <div className="chips">
        {['all', ...categories].map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : catLabel(c)}
          </button>
        ))}
      </div>

      <div className="cards">
        {shown.map((i) => (
          <article key={i.id} className={`lib-card ${openId === i.id ? 'open' : ''}`}>
            <button className="lib-head" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
              <strong>{i.name}</strong>
              <span className="muted">{meta(i)}</span>
              {i.pair_id && <span className="badge">Yours</span>}
            </button>
            {openId === i.id && (
              <div className="lib-body">
                <Detail item={i} />
                {i.pair_id && <button className="danger small" onClick={() => remove(i.id)}>Remove</button>}
              </div>
            )}
          </article>
        ))}
        {!shown.length && <p className="muted">Nothing here yet.</p>}
      </div>
    </section>
  );
}

function AddForm({ type, onAdded }) {
  const isWorkouts = type === 'workouts';
  const [f, setF] = useState({
    name: '', category: isWorkouts ? 'strength' : 'cook', duration_min: 30, difficulty: 'medium',
    cuisine: '', prep_min: '', description: '', exercises: '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const row = isWorkouts
      ? {
          name: f.name.trim(),
          category: f.category,
          duration_min: Number(f.duration_min),
          difficulty: f.difficulty,
          description: f.description.trim() || null,
          exercises: parseExercises(f.exercises),
        }
      : {
          name: f.name.trim(),
          category: f.category,
          cuisine: f.cuisine.trim() || null,
          prep_min: f.prep_min ? Number(f.prep_min) : null,
          description: f.description.trim() || null,
        };
    const { error } = await supabase.from(type).insert(row);
    if (error) return setError(error.message);
    onAdded();
  }

  return (
    <form className="card stack add-form" onSubmit={submit}>
      <label>Name<input value={f.name} onChange={set('name')} required /></label>
      <div className="row three">
        <label>Category
          <select value={f.category} onChange={set('category')}>
            {(isWorkouts ? WORKOUT_CATEGORIES : FOOD_CATEGORIES).map((c) => (
              <option key={c} value={c}>{isWorkouts ? c : FOOD_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </label>
        {isWorkouts ? (
          <>
            <label>Minutes<input type="number" min={1} value={f.duration_min} onChange={set('duration_min')} required /></label>
            <label>Difficulty
              <select value={f.difficulty} onChange={set('difficulty')}>
                {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>Cuisine<input value={f.cuisine} onChange={set('cuisine')} /></label>
            <label>Prep minutes<input type="number" min={1} value={f.prep_min} onChange={set('prep_min')} /></label>
          </>
        )}
      </div>
      <label>Description<textarea rows={2} value={f.description} onChange={set('description')} /></label>
      {isWorkouts && (
        <label>Exercises — one per line, e.g. “Push-ups — 3 x 10”
          <textarea rows={4} value={f.exercises} onChange={set('exercises')} />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <div><button className="primary">Save to library</button></div>
    </form>
  );
}

function parseExercises(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)(?:\s+[-—–]\s+|:\s*)(.+)$/);
      return m ? { name: m[1].trim(), detail: m[2].trim() } : { name: line, detail: '' };
    });
}
