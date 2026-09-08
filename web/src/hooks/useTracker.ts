import { useCallback, useState } from 'react';
import type { PokemonKey, TrackStatus } from '../data/types';

const STORAGE_KEY = 'luxdex-tracker-v1';

function load(): Record<PokemonKey, TrackStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(data: Record<PokemonKey, TrackStatus>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors in prototype
  }
}

export function useTracker() {
  const [tracker, setTracker] = useState<Record<PokemonKey, TrackStatus>>(load);

  const getStatus = useCallback((key: PokemonKey): TrackStatus => {
    return tracker[key] ?? 'unseen';
  }, [tracker]);

  const setStatus = useCallback((key: PokemonKey, status: TrackStatus) => {
    setTracker(prev => {
      const next = { ...prev };
      if (status === 'unseen') {
        delete next[key];
      } else {
        next[key] = status;
      }
      save(next);
      return next;
    });
  }, []);

  const advanceStatus = useCallback((key: PokemonKey) => {
    setTracker(prev => {
      const current = prev[key] ?? 'unseen';
      const next = { ...prev };
      if (current === 'unseen') {
        next[key] = 'seen';
      } else if (current === 'seen') {
        next[key] = 'caught';
      }
      // caught stays caught — reset only via panel
      save(next);
      return next;
    });
  }, []);

  const resetStatus = useCallback((key: PokemonKey) => {
    setTracker(prev => {
      const next = { ...prev };
      delete next[key];
      save(next);
      return next;
    });
  }, []);

  return { tracker, getStatus, setStatus, advanceStatus, resetStatus };
}
