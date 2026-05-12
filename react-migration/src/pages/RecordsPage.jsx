import { useState } from 'react';
import { calcRecord, getSquadForUnit } from '../lib/fitnessCore.js';
import { SCORE_COLS } from '../constants/appConstants.js';
import { FilterBar } from '../components/FilterBar.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { PassBadge, ScoreBadge } from '../components/badges.jsx';

const RAW_COLS = [
  { label: '立跳(cm)', key: 'standing_jump' },
  { label: '後拋(m)',  key: 'ball_throw' },
  { label: '折返(趟)', key: 'shuttle_run' },
  { label: '硬舉(kg)', key: 'deadlift' },
  { label: '懸吊(次)', key: 'chin_up_count' },
  { label: '懸吊(秒)', key: 'chin_up_sec' },
  { label: '負重(kg)', key: 'loaded_walk' },
  { label: '跑步(秒)', key: 'run_1500' },
];

function maskName(name) {
  if (!name) return '';
  return name[0] + 'OO';
}

export function RecordsPage({ isAdmin, onAdminLogin, period, setPeriod, brigade, setBrigade, squad, setSquad, unit, setUnit, search, setSearch, resetPages, pagedRec, filtered, recPage, setRecPage, setEditTarget }) {
  const [viewMode, setViewMode] = useState('converted');

  const btnStyle = (active) => ({
    border: '1px solid #e2e8f0',
    background: active ? '#1e293b' : '#fff',
    color: active ? '#fff' : '#64748b',
    borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
  });

  function handleSearchFocus() {
    if (!isAdmin && onAdminLogin) {
      onAdminLogin();
    }
  }

  return (
    <section>
      {!isAdmin && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ri-lock-line" />
          目前顯示遮蔽版。輸入金鑰後可查看完整姓名與分項成績。
        </div>
      )}
      <FilterBar
        period={period} setPeriod={setPeriod}
        brigade={brigade} setBrigade={setBrigade}
        squad={squad} setSquad={setSquad}
        unit={unit} setUnit={setUnit}
        search={isAdmin ? search : ''}
        setSearch={isAdmin ? setSearch : () => {}}
        onReset={resetPages}
        searchPlaceholder={isAdmin ? '搜尋姓名' : '🔒 搜尋姓名（需解鎖）'}
        onSearchFocus={handleSearchFocus}
      />

      {/* 切換按鈕（管理者才顯示） */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, margin: '12px 0 8px', alignItems: 'center' }}>
          <button style={btnStyle(viewMode === 'converted')} onClick={() => setViewMode('converted')}>換算得分</button>
          <button style={btnStyle(viewMode === 'raw')} onClick={() => setViewMode('raw')}>原始數值</button>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>{filtered.length} 筆</span>
        </div>
      )}
      {!isAdmin && (
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0', textAlign: 'right' }}>{filtered.length} 筆</div>
      )}

      <div className="table-wrap">
        {/* 非管理者：遮蔽版 */}
        {!isAdmin && (
          <table>
            <thead>
              <tr><th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>及格狀態</th></tr>
            </thead>
            <tbody>
              {pagedRec.map(r => {
                const s = calcRecord(r);
                return (
                  <tr key={r.id} style={!s.pass ? { background: '#fff5f5' } : {}}>
                    <td>{r.brigade}</td><td>{r.squad || getSquadForUnit(r.unit)}</td><td>{r.unit}</td>
                    <td>{maskName(r.name)}</td><td>{r.gender}</td>
                    <td><PassBadge pass={s.pass} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 管理者：完整版（換算得分） */}
        {isAdmin && viewMode === 'converted' && (
          <table>
            <thead>
              <tr>
                <th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>年齡層</th>
                {SCORE_COLS.map(c => <th key={c.key}>{c.label}</th>)}
                <th>總分</th><th>狀態</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pagedRec.map(r => {
                const s = calcRecord(r);
                return (
                  <tr key={r.id} style={!s.pass ? { background: '#fff5f5' } : {}}>
                    <td>{r.brigade}</td><td>{r.squad || getSquadForUnit(r.unit)}</td><td>{r.unit}</td>
                    <td><b>{r.name}</b></td><td>{r.gender}</td><td>{r.ageGroup}</td>
                    {SCORE_COLS.map(c => <td key={c.key}><ScoreBadge value={s[c.key] ?? 0} /></td>)}
                    <td><b style={{ color: s.pass ? '#059669' : '#dc2626' }}>{s.total}</b></td>
                    <td><PassBadge pass={s.pass} /></td>
                    <td><button onClick={() => setEditTarget(r)} style={{ border: '1px solid #94a3b8', background: '#f8fafc', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>編輯</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 管理者：完整版（原始數值） */}
        {isAdmin && viewMode === 'raw' && (
          <table>
            <thead>
              <tr>
                <th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>年齡</th>
                {RAW_COLS.map(c => <th key={c.key}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagedRec.map(r => (
                <tr key={r.id}>
                  <td>{r.brigade}</td><td>{r.squad || getSquadForUnit(r.unit)}</td><td>{r.unit}</td>
                  <td><b>{r.name}</b></td><td>{r.gender}</td><td>{r.age ?? '—'}</td>
                  {RAW_COLS.map(c => (
                    <td key={c.key} style={{ color: r[c.key] == null ? '#94a3b8' : undefined }}>{r[c.key] ?? '—'}</td>
                  ))}
                  <td><button onClick={() => setEditTarget(r)} style={{ border: '1px solid #94a3b8', background: '#f8fafc', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>編輯</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!filtered.length && <div className="empty" style={{ padding: 32, textAlign: 'center' }}>沒有符合條件的資料</div>}
      <Pagination page={recPage} total={filtered.length} onPage={setRecPage} />
    </section>
  );
}
