import { useMemo, useState } from 'react';
import { DEFAULT_PERIOD, calcRecord, loadFromGAS, parsePeriod } from './lib/fitnessCore.js';

const pages = [
  { id: 'dashboard', label: '總覽', icon: 'ri-dashboard-line' },
  { id: 'records', label: '成績查詢', icon: 'ri-file-list-3-line' },
  { id: 'results', label: '換算結果', icon: 'ri-trophy-line' },
  { id: 'analysis', label: '分析', icon: 'ri-bar-chart-2-line' },
];

function useLocalRecords() {
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fitness_records') || '[]'); } catch { return []; }
  });
  function replace(next) {
    setRecords(next);
    localStorage.setItem('fitness_records', JSON.stringify(next));
  }
  return [records, replace];
}

export function App() {
  const [page, setPage] = useState('dashboard');
  const [records, setRecords] = useLocalRecords();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { year, semester } = parsePeriod(period);
  const visible = useMemo(() => records.filter(r => String(r.year) === String(year) && String(r.semester || '上半年') === String(semester)), [records, year, semester]);
  const stats = useMemo(() => {
    const scored = visible.map(calcRecord);
    const total = visible.length;
    const pass = scored.filter(s => s.pass).length;
    const average = total ? (scored.reduce((sum, s) => sum + s.total, 0) / total).toFixed(1) : '0.0';
    return { total, pass, average, rate: total ? ((pass / total) * 100).toFixed(1) : '0.0' };
  }, [visible]);

  async function handleLoadGSheet() {
    setLoading(true);
    setMessage('');
    try {
      const result = await loadFromGAS({ year, semester }, records);
      setRecords(result.records);
      setMessage('已載入 ' + result.incoming.length + ' 筆，略過重複 ' + result.skipped + ' 筆');
    } catch (error) {
      setMessage(error.message || 'GSheet 載入失敗');
    } finally {
      setLoading(false);
    }
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="logo"><b>台北消防局</b><span>常訓體能成績管理系統</span></div>
      {pages.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><i className={item.icon}></i>{item.label}</button>)}
      <small>React/Vite 平移重構版｜舊版 index.html 保留</small>
    </aside>
    <main className="main">
      <header><h1>{pages.find(p => p.id === page)?.label}</h1><span className="badge">查詢模式</span></header>
      {(page === 'dashboard' || page === 'records') && <section>
        <div className="toolbar">
          <select value={period} onChange={e => setPeriod(e.target.value)}><option>114年上半年</option><option>114年下半年</option><option>115年上半年</option><option>115年下半年</option><option>116年上半年</option><option>116年下半年</option></select>
          <button onClick={handleLoadGSheet} disabled={loading}>{loading ? '載入中...' : '從 GSheet 載入'}</button>
          {message && <span className="msg">{message}</span>}
        </div>
      </section>}
      {page === 'dashboard' && <section>
        <div className="note"><b>系統定位與資料來源</b><p>本系統定位為常訓體能成績管理與統計後台。React 第一階段先平移架構，不直接取代舊版。</p></div>
        <div className="cards"><div><span>總人數</span><b>{stats.total}</b></div><div><span>及格人數</span><b>{stats.pass}</b></div><div><span>及格率</span><b>{stats.rate}%</b></div><div><span>平均分數</span><b>{stats.average}</b></div></div>
      </section>}
      {page === 'records' && <section><div className="note">已接入舊版 UNIT_MAP / CONV_TABLE，分數會依平移換算表即時計算。下一步搬新增、編輯、匯入與管理者維護模式。</div><table><thead><tr><th>大隊</th><th>中隊</th><th>單位</th><th>姓名</th><th>總分</th><th>狀態</th></tr></thead><tbody>{visible.slice(0,50).map(r=>{const s=calcRecord(r); return <tr key={r.id || r.year + r.unit + r.name}><td>{r.brigade}</td><td>{r.squad}</td><td>{r.unit}</td><td>{r.name}</td><td>{s.total}</td><td>{s.pass?'及格':'未及格'}</td></tr>})}</tbody></table></section>}
      {(page === 'results' || page === 'analysis') && <section className="empty">這頁會從舊版 index.html 逐步平移。</section>}
    </main>
  </div>;
}
