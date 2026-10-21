import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { useWeekData } from '../lib/useWeekData';
import {
  START_HOUR, END_HOUR, HOUR_PX, spanMinutes, spanStyle, toHHMM, fmt, hourLabel, intersect, minutesOf,
} from '../lib/time';
import EventModal from './EventModal';
import { KIND_ICON, eventTitle } from './catalog';

const thisWeek = () => startOfWeek(new Date(), { weekStartsOn: 1 });

export default function WeekView({ pair, me, partner }) {
  const [weekStart, setWeekStart] = useState(thisWeek);
  const { blocks, events, error, reload } = useWeekData(pair.id, weekStart);
  const [modal, setModal] = useState(null);
  const now = useNow();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const bodyHeight = (END_HOUR - START_HOUR) * HOUR_PX;

  function openNew(day, startMin, mode = 'block', endMin) {
    setModal({
      mode,
      date: format(day, 'yyyy-MM-dd'),
      start: toHHMM(startMin),
      end: toHHMM(Math.min(endMin ?? startMin + 60, 24 * 60)),
    });
  }

  function openEdit(record, mode) {
    setModal({
      mode,
      record,
      date: format(record.start, 'yyyy-MM-dd'),
      start: format(record.start, 'HH:mm'),
      end: format(record.end, 'HH:mm'),
    });
  }

  return (
    <section className="week">
      <div className="toolbar">
        <div className="nav">
          <button onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="Previous week">‹</button>
          <button onClick={() => setWeekStart(thisWeek())}>This week</button>
          <button onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="Next week">›</button>
          <h2>{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</h2>
        </div>
        <div className="legend">
          <span><i className="sw me" />{me.display_name}</span>
          <span><i className="sw partner" />{partner?.display_name ?? 'Partner'}</span>
          <span><i className="sw free" />Free</span>
          <span><i className="sw together" />Together</span>
          <span><i className="sw both" />Both free</span>
        </div>
        <button className="primary" onClick={() => openNew(new Date(), 18 * 60)}>+ Add time</button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid-scroll">
        <div className="grid">
          <div className="gutter">
            <div className="day-head" />
            <div className="gutter-body" style={{ height: bodyHeight }}>
              {hours.map((h) => (
                <span key={h} style={{ top: (h - START_HOUR) * HOUR_PX }}>{hourLabel(h)}</span>
              ))}
            </div>
          </div>

          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              me={me}
              partner={partner}
              blocks={blocks.filter((b) => isSameDay(b.start, day))}
              events={events.filter((e) => isSameDay(e.start, day))}
              height={bodyHeight}
              nowMin={isToday(day) ? minutesOf(now) : null}
              onCreate={openNew}
              onEditBlock={(b) => openEdit(b, 'block')}
              onEditEvent={(e) => openEdit(e, 'shared')}
            />
          ))}
        </div>
      </div>

      <p className="hint muted">
        Click an empty slot to add your own busy or free time. Click a green “both free” band to plan something together.
      </p>

      {modal && (
        <EventModal
          initial={modal}
          me={me}
          partner={partner}
          blocks={blocks}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload(); }}
        />
      )}
    </section>
  );
}

function DayColumn({ day, me, partner, blocks, events, height, nowMin, onCreate, onEditBlock, onEditEvent }) {
  const mine = blocks.filter((b) => b.user_id === me.id);
  const theirs = partner ? blocks.filter((b) => b.user_id === partner.id) : [];
  const freeSpans = (list) => list.filter((b) => b.status === 'free').map((b) => spanMinutes(b.start, b.end));
  const bothFree = partner ? intersect(freeSpans(mine), freeSpans(theirs)) : [];

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const slot = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
    onCreate(day, Math.min(START_HOUR * 60 + slot, 23 * 60 + 30), 'block');
  }

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div className={`day ${isToday(day) ? 'today' : ''}`}>
      <div className="day-head">
        <div className="day-name">{format(day, 'EEE')} <b>{format(day, 'd')}</b></div>
        <div className="lanes-head">
          <span className="me">{me.display_name}</span>
          <span className="partner">{partner?.display_name ?? '—'}</span>
        </div>
      </div>

      <div className="day-body" style={{ height, backgroundSize: `100% ${HOUR_PX}px` }} onClick={handleClick}>
        {bothFree.map(([s, e]) => {
          const pos = spanStyle(s, e);
          return pos && (
            <button
              key={`f${s}`}
              className="both-free"
              style={pos}
              title="You're both free — plan something"
              onClick={stop(() => onCreate(day, s, 'shared', e))}
            />
          );
        })}

        {[...mine.map((b) => [b, 'me']), ...theirs.map((b) => [b, 'partner'])].map(([b, lane]) => {
          const pos = spanStyle(...spanMinutes(b.start, b.end));
          if (!pos) return null;
          const own = lane === 'me';
          return (
            <div
              key={b.id}
              className={`block ${b.status} lane-${lane} ${own ? 'editable' : ''}`}
              style={pos}
              title={`${b.label || b.status} · ${fmt(b.start)}–${fmt(b.end)}`}
              onClick={(e) => { e.stopPropagation(); if (own) onEditBlock(b); }}
            >
              <strong>{b.label || (b.status === 'busy' ? 'Busy' : 'Free')}</strong>
              <span>{fmt(b.start)}–{fmt(b.end)}</span>
            </div>
          );
        })}

        {events.map((ev) => {
          const pos = spanStyle(...spanMinutes(ev.start, ev.end));
          return pos && (
            <div key={ev.id} className={`together kind-${ev.kind}`} style={pos} onClick={stop(() => onEditEvent(ev))}>
              <strong>{KIND_ICON[ev.kind]} {eventTitle(ev)}</strong>
              <span>{fmt(ev.start)}–{fmt(ev.end)}</span>
            </div>
          );
        })}

        {nowMin != null && nowMin >= START_HOUR * 60 && (
          <div className="now-line" style={{ top: ((nowMin - START_HOUR * 60) / 60) * HOUR_PX }} />
        )}
      </div>
    </div>
  );
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
