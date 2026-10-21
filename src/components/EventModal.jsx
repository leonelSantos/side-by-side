import { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { supabase } from '../supabaseClient';
import Picker from './Picker';
import { fmt, overlaps } from '../lib/time';
import {
  WORKOUT_CATEGORIES, FOOD_CATEGORIES, FOOD_CATEGORY_LABEL, KIND_ICON, KIND_LABEL,
  workoutMeta, foodMeta, WorkoutDetail, FoodDetail,
} from './catalog';

export default function EventModal({ initial, me, partner, blocks, onClose, onSaved }) {
  const rec = initial.record;
  const editing = Boolean(rec);

  const [mode, setMode] = useState(initial.mode); // 'block' = my own time, 'shared' = together
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  const [status, setStatus] = useState(rec?.status ?? 'busy');
  const [label, setLabel] = useState(rec?.label ?? '');

  const [kind, setKind] = useState(rec?.kind ?? 'workout');
  const [title, setTitle] = useState(rec?.title ?? '');
  const [workoutId, setWorkoutId] = useState(rec?.workout_id ?? null);
  const [foodId, setFoodId] = useState(rec?.food_id ?? null);
  const [notes, setNotes] = useState(rec?.notes ?? '');

  const [workouts, setWorkouts] = useState([]);
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('workouts').select('*').order('name').then(({ data }) => setWorkouts(data ?? []));
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods(data ?? []));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function range() {
    const s = new Date(`${date}T${start}`);
    let e = new Date(`${date}T${end}`);
    if (end === '00:00') e = addDays(e, 1); // ending at midnight
    return [s, e];
  }

  // Warn (don't block) when planning together time over someone's busy time
  const conflicts = useMemo(() => {
    if (mode !== 'shared' || !date || !start || !end) return [];
    const [s, e] = range();
    if (!(e > s)) return [];
    return blocks.filter((b) => b.status === 'busy' && overlaps(s, e, b.start, b.end));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, date, start, end, blocks]);

  const nameOf = (userId) => (userId === me.id ? 'You' : partner?.display_name ?? 'Partner');

  async function save(e) {
    e.preventDefault();
    const [s, en] = range();
    if (!(en > s)) return setError('End time must be after the start time.');
    setSaving(true);
    setError('');

    const times = { starts_at: s.toISOString(), ends_at: en.toISOString() };
    let res;
    if (mode === 'block') {
      const row = { ...times, status, label: label.trim() || null };
      res = editing
        ? await supabase.from('schedule_blocks').update(row).eq('id', rec.id)
        : await supabase.from('schedule_blocks').insert(row);
    } else {
      const row = {
        ...times,
        kind,
        title: title.trim() || null,
        workout_id: kind === 'workout' ? workoutId : null,
        food_id: kind === 'dinner' ? foodId : null,
        notes: notes.trim() || null,
      };
      res = editing
        ? await supabase.from('shared_events').update(row).eq('id', rec.id)
        : await supabase.from('shared_events').insert(row);
    }

    setSaving(false);
    if (res.error) return setError(res.error.message);
    onSaved();
  }

  async function remove() {
    if (!confirm(mode === 'block' ? 'Delete this time block?' : 'Cancel this plan for both of you?')) return;
    const table = mode === 'block' ? 'schedule_blocks' : 'shared_events';
    const { error } = await supabase.from(table).delete().eq('id', rec.id);
    if (error) return setError(error.message);
    onSaved();
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal stack" onSubmit={save}>
        <div className="modal-head">
          <h3>{editing ? 'Edit' : 'Add'} {mode === 'block' ? 'my time' : 'time together'}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!editing && (
          <div className="segmented">
            <button type="button" className={mode === 'block' ? 'on' : ''} onClick={() => setMode('block')}>My time</button>
            <button type="button" className={mode === 'shared' ? 'on' : ''} onClick={() => setMode('shared')} disabled={!partner}>
              Together
            </button>
          </div>
        )}

        <div className="row three">
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label>Start<input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} required /></label>
          <label>End<input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
        </div>

        {mode === 'block' ? (
          <>
            <div className="segmented">
              <button type="button" className={status === 'busy' ? 'on' : ''} onClick={() => setStatus('busy')}>Busy</button>
              <button type="button" className={status === 'free' ? 'on' : ''} onClick={() => setStatus('free')}>Free</button>
            </div>
            <label>Label (optional)
              <input placeholder={status === 'busy' ? 'Work, class, gym…' : 'Open evening'} value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <div className="segmented">
              {['workout', 'dinner', 'hangout'].map((k) => (
                <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                  {KIND_ICON[k]} {KIND_LABEL[k]}
                </button>
              ))}
            </div>

            {kind === 'workout' && (
              <Picker
                items={workouts}
                categories={WORKOUT_CATEGORIES}
                selectedId={workoutId}
                onSelect={setWorkoutId}
                meta={workoutMeta}
                Detail={WorkoutDetail}
              />
            )}
            {kind === 'dinner' && (
              <Picker
                items={foods}
                categories={FOOD_CATEGORIES}
                categoryLabel={(c) => FOOD_CATEGORY_LABEL[c]}
                selectedId={foodId}
                onSelect={setFoodId}
                meta={foodMeta}
                Detail={FoodDetail}
              />
            )}

            <label>Title (optional)
              <input placeholder={kind === 'hangout' ? 'Movie night, beach…' : 'Defaults to the one you picked'} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>Notes<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

            {conflicts.length > 0 && (
              <div className="warning">
                Heads up — this overlaps busy time:
                <ul>
                  {conflicts.map((b) => (
                    <li key={b.id}>{nameOf(b.user_id)}: {b.label || 'Busy'} ({fmt(b.start)}–{fmt(b.end)})</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          {editing && <button type="button" className="danger" onClick={remove}>Delete</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
