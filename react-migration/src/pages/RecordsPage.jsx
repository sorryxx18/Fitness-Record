import { calcRecord, getSquadForUnit } from '../lib/fitnessCore.js';
import { SCORE_COLS } from '../constants/appConstants.js';
import { FilterBar } from '../components/FilterBar.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { PassBadge, ScoreBadge } from '../components/badges.jsx';

export function RecordsPage({ isAdmin, period, setPeriod, brigade, setBrigade, squad, setSquad, unit, setUnit, search, setSearch, resetPages, pagedRec, filtered, recPage, setRecPage, setEditTarget }) {
  return (
    <section>
      {!isAdmin && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#1e3a8a' }}>
        查詢模式：可依年度、單位或姓名查詢成績。如需新增或修改資料，請以管理者身份登入。
      </div>}
      <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
        squad={squad} setSquad={setSquad} unit={unit} setUnit={setUnit}
        search={search} setSearch={setSearch} onReset={resetPages} />
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>年齡</th>{SCORE_COLS.map(c => <th key={c.key}>{c.label}</th>)}<th>總分</th><th>狀態</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {pagedRec.map(r => { const s = calcRecord(r); return (
              <tr key={r.id} style={!s.pass ? { background: '#fff5f5' } : {}}>
                <td>{r.brigade}</td><td>{r.squad || getSquadForUnit(r.unit)}</td><td>{r.unit}</td>
                <td><b>{r.name}</b></td><td>{r.gender}</td><td>{r.age}</td>
                {SCORE_COLS.map(c => <td key={c.key}><ScoreBadge value={s[c.key] ?? 0} /></td>)}
                <td><b style={{ color: s.pass ? '#059669' : '#dc2626' }}>{s.total}</b></td>
                <td><PassBadge pass={s.pass} /></td>
                {isAdmin && <td><button onClick={() => setEditTarget(r)} style={{ border: '1px solid #94a3b8', background: '#f8fafc', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>編輯</button></td>}
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      {!filtered.length && <div className="empty" style={{ padding: 32, textAlign: 'center' }}>沒有符合條件的資料</div>}
      <Pagination page={recPage} total={filtered.length} onPage={setRecPage} />
    </section>
  );
}
