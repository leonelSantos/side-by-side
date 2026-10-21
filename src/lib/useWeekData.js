import { useCallback, useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import { supabase } from '../supabaseClient';

// Loads both people's blocks and shared events for one week, and keeps them live.
export function useWeekData(pairId, weekStart) {
  const [blocks, setBlocks] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const startMs = weekStart.getTime();

  const load = useCallback(async () => {
    const from = new Date(startMs).toISOString();
    const to = addDays(new Date(startMs), 7).toISOString();
    const [b, e] = await Promise.all([
      supabase.from('schedule_blocks').select('*').gte('starts_at', from).lt('starts_at', to).order('starts_at'),
      supabase
        .from('shared_events')
        .select('*, workout:workouts(*), food:foods(*)')
        .gte('starts_at', from)
        .lt('starts_at', to)
        .order('starts_at'),
    ]);
    if (b.error || e.error) setError((b.error || e.error).message);
    else setError('');
    if (!b.error) setBlocks(b.data.map(withDates));
    if (!e.error) setEvents(e.data.map(withDates));
  }, [startMs]);

  useEffect(() => { load(); }, [load]);

  // Realtime: row-level security limits what each person receives to their own pair
  useEffect(() => {
    if (!pairId) return;
    const channel = supabase
      .channel(`pair-${pairId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_blocks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_events' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pairId, load]);

  return { blocks, events, error, reload: load };
}

const withDates = (row) => ({ ...row, start: new Date(row.starts_at), end: new Date(row.ends_at) });
