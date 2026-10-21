import { useState } from 'react';

// Searchable, filterable single-select list used for choosing a workout or a dinner
export default function Picker({ items, categories, categoryLabel = (c) => c, selectedId, onSelect, meta, Detail }) {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  const shown = items.filter(
    (i) => (cat === 'all' || i.category === cat) && i.name.toLowerCase().includes(q.trim().toLowerCase())
  );
  const selected = items.find((i) => i.id === selectedId);

  function surprise() {
    if (!shown.length) return;
    onSelect(shown[Math.floor(Math.random() * shown.length)].id);
  }

  return (
    <div className="picker">
      <div className="row">
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={surprise}>🎲 Surprise us</button>
      </div>
      <div className="chips">
        {['all', ...categories].map((c) => (
          <button type="button" key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c === 'all' ? 'All' : categoryLabel(c)}
          </button>
        ))}
      </div>
      <ul className="options">
        {shown.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className={`option ${i.id === selectedId ? 'on' : ''}`}
              onClick={() => onSelect(i.id === selectedId ? null : i.id)}
            >
              <strong>{i.name}</strong>
              <span>{meta(i)}</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="muted empty">Nothing matches.</li>}
      </ul>
      {selected && Detail && (
        <div className="detail">
          <h4>{selected.name}</h4>
          <Detail item={selected} />
        </div>
      )}
    </div>
  );
}
