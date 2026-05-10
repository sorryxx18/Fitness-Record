import { useCallback, useState } from 'react';

export function useLocalRecords() {
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fitness_records') || '[]'); } catch { return []; }
  });
  const replace = useCallback(next => {
    setRecords(next);
    localStorage.setItem('fitness_records', JSON.stringify(next));
  }, []);
  return [records, replace];
}
