import { useMemo, useState } from 'react';
import {
  BRIGADES,
  DEFAULT_PERIOD,
  calcRecord,
  getAllUnits,
  getSquadsForBrigade,
  loadFromGAS,
  parsePeriod,
} from './lib/fitnessCore.js';

const pages = [
  { id: 'dashboard', label: '總覽', icon: 'ri-dashboard-line' },
  { id: 'records', label: '成績查詢', icon: 'ri-file-list-3-line' },
  { id: 'results', label: '換算結果', icon: 'ri-trophy-line' },
  { id: 'analysis', label: '分析', icon: 'ri-bar-chart-2-line' },
];

const PAGE_SIZE = 50;
const periodOptions = ['114年上半年', '114年下半年', '115年上半年', '115年下半年', '116年上半年', '116年下半年'];
const scoreColumns = [
  ['立定跳遠', 'standing_jump'],
  ['後拋擲遠', 'ball_throw'],
  ['折返跑', 'shuttle_run'],
  ['硬舉', 'deadlift'],
  ['懸吊', 'chin_up'],
  ['負重行走', 'loaded_walk'],
  ['1500跑步', 'run_1500'],
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

function ScoreBadge({ value }) {
  const tone = value >= 10 ? 'high' : value >= 6 ? 'mid' : 'low';
  return <span className={'score ' + tone}>{value}</span>;
}

export function App() {
  const [page, setPage] = useState('dashboard');
  const [records, setRecords] = useLocalRecords();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [brigade, setBrigade] = useState('all');
  const [squad, setSquad] = useState('all');
  const [unit, setUnit] = useState('all');
  const [search, setSearch] = useState('');
  const [recordPage, setRecordPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { year, semester } = parsePeriod(period);

  const squads = useMemo(() => brigade === 'all' ? [] : getSquadsForBrigade(brigade), [brigade]);
  const units = useMemo(() => getAllUnits(brigade, squad), [brigade, squad]);

  const visible = useMemo(() => {
    const keyword = search.trim();
    return records.filter(r => {
      if (String(r.year) !== String(year)) return false;
      if (String(r.semester || '上半年') !== String(semester)) return false;
      if (brigade !== 'all' && r.brigade !== brigade) return false;
      if (squad !== 'all' && r.squad !== squad) return false;
      if (unit !== 'all' && r.unit !== unit) return false;
      if (keyword && !(String(r.name || '').includes(keyword) || String(r.unit || '').includes(keyword) || String(r.brigade || '').includes(keyword))) return false;
      return true;
    });
  }, [records, year, semester, brigade, squad, unit, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pagedRecords = visible.slice((recordPage - 1) * PAGE_SIZE, recordPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const scored = visible.map(calcRecord);
    const total = visible.length;
    const pass = scored.filter(s => s.pass).length;
    const average = total ? (scored.reduce((sum, s) => sum + s.total, 0) / total).toFixed(1) : '0.0';
    return { total, pass, average, rate: total ? ((pass / total) * 100).toFixed(1) : '0.0' };
  }, [visible]);

  function resetRecordPage() { setRecordPage(1); }

  async function handleLoadGSheet() {
    setLoading(true);
    setMessage('');
    try {
      const result = await loadFromGAS({ year, semester }, records);
      setRecords(result.records);
      setRecordPage(1);
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

      {(page === 'dashboard' || page === 'records') && <section className="toolbar-section">
        <div className="toolbar">
          <select value={period} onChange={e => { setPeriod(e.target.value); resetRecordPage(); }}>
            {periodOptions.map(option => <option key={option}>{option}</option>)}
          </select>
          <button onClick={handleLoadGSheet} disabled={loading}>{loading ? '載入中...' : '從 GSheet 載入'}</button>
          {message && <span className="msg">{message}</span>}
        </div>
      </section>}

      {page === 'dashboard' && <section>
        <div className="note"><b>系統定位與資料來源</b><p>本系統定位為常訓體能成績管理與統計後台。React 第一階段先平移架構，不直接取代舊版。</p></div>
        <div className="cards"><div><span>總人數</span><b>{stats.total}</b></div><div><span>及格人數</span><b>{stats.pass}</b></div><div><span>及格率</span><b>{stats.rate}%</b></div><div><span>平均分數</span><b>{stats.average}</b></div></div>
      </section>}

      {page === 'records' && <section>
        <div className="note">已接入舊版 UNIT_MAP / CONV_TABLE，分數會依平移換算表即時計算。這一版補上查詢篩選、分頁與完整成績欄位。</div>
        <div className="filters">
          <select value={brigade} onChange={e => { setBrigade(e.target.value); setSquad('all'); setUnit('all'); resetRecordPage(); }}>
            <option value="all">全部大隊</option>
            {BRIGADES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={squad} onChange={e => { setSquad(e.target.value); setUnit('all'); resetRecordPage(); }} disabled={brigade === 'all'}>
            <option value="all">全部中隊</option>
            {squads.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={unit} onChange={e => { setUnit(e.target.value); resetRecordPage(); }}>
            <option value="all">全部分隊</option>
            {units.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="search" placeholder="搜尋姓名、單位、大隊" value={search} onChange={e => { setSearch(e.target.value); resetRecordPage(); }} />
          <span className="count">共 {visible.length} 筆</span>
        </div>
        <div className="table-wrap"><table><thead><tr><th>大隊</th><th>中隊</th><th>單位</th><th>姓名</th><th>性別</th><th>年齡</th>{scoreColumns.map(([label]) => <th key={label}>{label}</th>)}<th>總分</th><th>狀態</th></tr></thead><tbody>{pagedRecords.map(r=>{const s=calcRecord(r); return <tr key={r.id || r.year + r.unit + r.name}><td>{r.brigade}</td><td>{r.squad}</td><td>{r.unit}</td><td>{r.name}</td><td>{r.gender}</td><td>{r.age}</td>{scoreColumns.map(([label, key]) => <td key={label}><ScoreBadge value={s[key] || 0} /></td>)}<td><b>{s.total}</b></td><td><span className={'pass ' + (s.pass ? 'yes' : 'no')}>{s.pass ? '及格' : '未及格'}</span></td></tr>})}</tbody></table></div>
        {!visible.length && <div className="empty">沒有符合條件的資料。請調整篩選或先從 GSheet 載入。</div>}
        {visible.length > 0 && <div className="pagination"><button disabled={recordPage <= 1} onClick={() => setRecordPage(p => Math.max(1, p - 1))}>上一頁</button><span>第 {recordPage} / {totalPages} 頁</span><button disabled={recordPage >= totalPages} onClick={() => setRecordPage(p => Math.min(totalPages, p + 1))}>下一頁</button></div>}
      </section>}

      {(page === 'results' || page === 'analysis') && <section className="empty">這頁會從舊版 index.html 逐步平移。</section>}
    </main>
  </div>;
}
