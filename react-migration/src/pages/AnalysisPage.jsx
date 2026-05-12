import { useState } from 'react';
import { BRIGADES, calcRecord } from '../lib/fitnessCore.js';
import { SCORE_COLS } from '../constants/appConstants.js';
import { BarChart } from '../components/Charts.jsx';
import { ScoreBadge, PassBadge } from '../components/badges.jsx';

// ── AnalysisPanel ────────────────────────────────────────────
function AnalysisPanel({ trendData, brigadeCompare, period, records, personalName, setPersonalName, personalResults, handlePersonalSearch, btnStyle, isAdmin, onAdminLogin }) {
  const [tab, setTab] = useState('trend');

  const ITEM_COLORS = ['#dc2626','#f59e0b','#059669','#2563eb','#7c3aed','#db2777','#475569'];

  return <>
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
      {[['trend','跨年度趨勢'],['brigade','大隊比較'],['personal','個人成長']].map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)}
          style={{ border: '1px solid', borderColor: tab === id ? '#dc2626' : 'var(--border)', background: tab === id ? '#dc2626' : '#fff', color: tab === id ? '#fff' : 'var(--dark)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
          {label}
        </button>
      ))}
    </div>

    {tab === 'trend' && (
      <>
        {trendData.length > 1 && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>及格率趨勢</h3>
            <div style={{ height: 260 }}>
              <LineChart
                labels={trendData.map(d => d.period)}
                datasets={[{ label: '及格率(%)', data: trendData.map(d => d.passRate), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', tension: 0.3, pointRadius: 5, fill: true }]}
              />
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>期間</th><th>人數</th><th>及格率</th><th>平均分數</th><th>趨勢</th></tr></thead>
            <tbody>
              {trendData.map((d, i) => {
                const prev = trendData[i - 1];
                const dir = prev ? (d.passRate > prev.passRate ? '↑' : d.passRate < prev.passRate ? '↓' : '─') : '─';
                const c = dir === '↑' ? '#059669' : dir === '↓' ? '#dc2626' : '#64748b';
                return <tr key={d.period}><td><b>{d.period}</b></td><td>{d.count}</td><td><b style={{ color: d.passRate >= 80 ? '#059669' : '#dc2626' }}>{d.passRate}%</b></td><td>{d.avgScore}</td><td><b style={{ color: c, fontSize: 18 }}>{dir}</b></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </>
    )}

    {tab === 'brigade' && (
      <>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>各大隊及格率 ({period})</h3>
          <div style={{ height: 260 }}>
            <BarChart
              labels={brigadeCompare.map(d => d.brigade)}
              datasets={[{ label: '及格率(%)', data: brigadeCompare.map(d => d.passRate), backgroundColor: ['#dc2626','#b91c1c','#ef4444','#f87171'], borderRadius: 4 }]}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>大隊</th><th>人數</th><th>及格</th><th>及格率</th><th>平均分</th></tr></thead>
            <tbody>
              {brigadeCompare.map(d => (
                <tr key={d.brigade}><td><b>{d.brigade}</b></td><td>{d.count}</td><td>{Math.round(d.count * d.passRate / 100)}</td><td><b style={{ color: d.passRate >= 80 ? '#059669' : '#dc2626' }}>{d.passRate}%</b></td><td>{d.avgScore}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}

    {tab === 'personal' && (
      <>
        {!isAdmin && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ri-lock-line" />個人成長查詢需要解鎖。
            <button onClick={onAdminLogin} style={{ border: '1px solid #d97706', background: '#fff', color: '#d97706', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12, marginLeft: 4 }}>輸入金鑰</button>
          </div>
        )}
        <div className="filters" style={{ marginBottom: 16 }}>
          <input type="search" placeholder={isAdmin ? '輸入姓名搜尋' : '🔒 需解鎖才能搜尋'}
            value={isAdmin ? personalName : ''}
            onChange={e => isAdmin && setPersonalName(e.target.value)}
            onFocus={() => !isAdmin && onAdminLogin?.()}
            onKeyDown={e => e.key === 'Enter' && isAdmin && handlePersonalSearch()} />
          <button style={btnStyle()} onClick={() => isAdmin ? handlePersonalSearch() : onAdminLogin?.()}>查詢</button>
        </div>
        {isAdmin && personalResults === null && <div style={{ color: 'var(--muted)', padding: 24 }}>輸入姓名後點擊查詢</div>}
        {isAdmin && personalResults?.length === 0 && <div style={{ color: 'var(--muted)', padding: 24 }}>查無資料</div>}
        {isAdmin && personalResults?.map(({ key, recs }) => {
          const scored = recs.map(r => calcRecord(r));
          const periods = recs.map(r => `${r.year}年${r.semester || ''}`);
          const lastIdx = recs.length - 1;
          const prevIdx = recs.length - 2;
          return (
            <div key={key} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h3 style={{ marginBottom: 14, fontSize: 14, fontWeight: 700 }}>{recs[0]?.name}（{key}）歷年成績</h3>

              {/* 比較表格 */}
              <div className="table-wrap" style={{ marginBottom: recs.length >= 2 ? 16 : 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>項目</th>
                      {periods.map(p => <th key={p}>{p}</th>)}
                      {recs.length >= 2 && <th>最近變化</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {SCORE_COLS.map(col => {
                      const vals = scored.map(s => s[col.key] ?? 0);
                      const delta = recs.length >= 2 ? vals[lastIdx] - vals[prevIdx] : null;
                      return (
                        <tr key={col.key}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{col.label}</td>
                          {vals.map((v, i) => <td key={i}><ScoreBadge value={v} /></td>)}
                          {delta !== null && (
                            <td style={{ fontWeight: 700, color: delta > 0 ? '#059669' : delta < 0 ? '#dc2626' : '#94a3b8' }}>
                              {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'}{delta !== 0 ? Math.abs(delta) : ''}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td style={{ fontWeight: 700 }}>總分</td>
                      {scored.map((s, i) => (
                        <td key={i}><b style={{ color: s.pass ? '#059669' : '#dc2626' }}>{s.total}</b></td>
                      ))}
                      {recs.length >= 2 && (() => {
                        const d = scored[lastIdx].total - scored[prevIdx].total;
                        return <td style={{ fontWeight: 700, color: d > 0 ? '#059669' : d < 0 ? '#dc2626' : '#94a3b8' }}>{d > 0 ? '↑' : d < 0 ? '↓' : '—'}{d !== 0 ? Math.abs(d) : ''}</td>;
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 分組長條圖（兩期以上才顯示） */}
              {recs.length >= 2 && (
                <div style={{ height: 220 }}>
                  <BarChart
                    labels={SCORE_COLS.map(c => c.label)}
                    datasets={recs.map((r, i) => ({
                      label: `${r.year}年${r.semester || ''}`,
                      data: SCORE_COLS.map(col => calcRecord(r)[col.key] || 0),
                      backgroundColor: ITEM_COLORS[i % ITEM_COLORS.length],
                      borderRadius: 3,
                    }))}
                    showLegend={true}
                    yMax={20}
                  />
                </div>
              )}
            </div>
          );
        })}
      </>
    )}
  </>;
}



export function AnalysisPage({ brigade, setBrigade, trendData, brigadeCompare, period, records, personalName, setPersonalName, personalResults, handlePersonalSearch, btnStyle, isAdmin, onAdminLogin }) {
  return (
    <section>
      <div className="filters" style={{ marginBottom: 16 }}>
        <select value={brigade} onChange={e => setBrigade(e.target.value)}>
          <option value="all">全部大隊</option>
          {BRIGADES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <AnalysisPanel
        trendData={trendData}
        brigadeCompare={brigadeCompare}
        period={period}
        records={records}
        personalName={personalName}
        setPersonalName={setPersonalName}
        personalResults={personalResults}
        handlePersonalSearch={handlePersonalSearch}
        btnStyle={btnStyle}
        isAdmin={isAdmin}
        onAdminLogin={onAdminLogin}
      />
    </section>
  );
}
