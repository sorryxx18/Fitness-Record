import { useState } from 'react';
import { BRIGADES, calcRecord } from '../lib/fitnessCore.js';
import { SCORE_COLS } from '../constants/appConstants.js';
import { BarChart, LineChart } from '../components/Charts.jsx';

// ── AnalysisPanel ────────────────────────────────────────────
function AnalysisPanel({ trendData, brigadeCompare, period, records, personalName, setPersonalName, personalResults, handlePersonalSearch, btnStyle }) {
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
        <div className="filters" style={{ marginBottom: 16 }}>
          <input type="search" placeholder="輸入姓名搜尋" value={personalName}
            onChange={e => setPersonalName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePersonalSearch()} />
          <button style={btnStyle()} onClick={handlePersonalSearch}>查詢</button>
        </div>
        {personalResults === null && <div style={{ color: 'var(--muted)', padding: 24 }}>輸入姓名後點擊查詢</div>}
        {personalResults?.length === 0 && <div style={{ color: 'var(--muted)', padding: 24 }}>查無資料</div>}
        {personalResults?.map(({ key, recs }) => {
          const labels = recs.map(r => `${r.year}年${r.semester || ''}`);
          const totals = recs.map(r => calcRecord(r).total);
          const datasets = [
            { label: '總分', data: totals, borderColor: '#111', backgroundColor: 'rgba(17,24,39,0.08)', tension: 0.3, pointRadius: 5, borderWidth: 2.5, fill: true, yAxisID: 'yTotal' },
            ...SCORE_COLS.map((c, i) => ({
              label: c.label, data: recs.map(r => calcRecord(r)[c.key] || 0),
              borderColor: ITEM_COLORS[i], backgroundColor: 'transparent',
              tension: 0.3, pointRadius: 3, borderWidth: 1.5, yAxisID: 'yItem',
            })),
          ];
          return (
            <div key={key} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>{recs[0]?.name}（{key}）歷年成績</h3>
              <div style={{ height: 300 }}>
                <LineChart labels={labels} datasets={datasets} />
              </div>
            </div>
          );
        })}
      </>
    )}
  </>;
}



export function AnalysisPage({ brigade, setBrigade, trendData, brigadeCompare, period, records, personalName, setPersonalName, personalResults, handlePersonalSearch, btnStyle }) {
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
      />
    </section>
  );
}
