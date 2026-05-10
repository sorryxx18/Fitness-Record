import { useMemo } from 'react';
import { BRIGADES, getAllUnits, getSquadsForBrigade } from '../lib/fitnessCore.js';
import { PERIOD_OPTIONS } from '../constants/appConstants.js';

export function FilterBar({ period, setPeriod, brigade, setBrigade, squad, setSquad, unit, setUnit, search, setSearch, onReset }) {
  const squads = useMemo(() => brigade === 'all' ? [] : getSquadsForBrigade(brigade), [brigade]);
  const units = useMemo(() => {
    if (brigade === 'all' || squad === 'all' || squad === '大隊本部') return [];
    return getAllUnits(brigade, squad);
  }, [brigade, squad]);

  function handleBrigade(v) { setBrigade(v); setSquad?.('all'); setUnit?.('all'); onReset?.(); }
  function handleSquad(v) { setSquad?.(v); setUnit?.('all'); onReset?.(); }

  return (
    <div className="filters">
      {period !== undefined && (
        <select value={period} onChange={e => { setPeriod(e.target.value); onReset?.(); }}>
          {PERIOD_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      )}
      <select value={brigade} onChange={e => handleBrigade(e.target.value)}>
        <option value="all">全部大隊</option>
        {BRIGADES.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      {setSquad && (
        <select value={squad} onChange={e => handleSquad(e.target.value)} disabled={brigade === 'all'}>
          <option value="all">全部中隊</option>
          {squads.map(s => <option key={s}>{s}</option>)}
        </select>
      )}
      {setUnit && unit !== undefined && (
        <select value={unit} onChange={e => { setUnit(e.target.value); onReset?.(); }}
          disabled={brigade === 'all' || squad === 'all' || squad === '大隊本部'}>
          <option value="all">全部分隊</option>
          {units.map(u => <option key={u}>{u}</option>)}
        </select>
      )}
      {search !== undefined && (
        <input type="search" placeholder="搜尋姓名" value={search}
          onChange={e => { setSearch(e.target.value); onReset?.(); }} />
      )}
    </div>
  );
}
