import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';
import {
  BRIGADES, DEFAULT_PERIOD, GAS_URL,
  calcRecord, getAllUnits, getAgeGroup, getSquadForUnit,
  getSquadsForBrigade, loadFromGAS, parsePeriod,
} from './lib/fitnessCore.js';

// ── constants ──────────────────────────────────────────────
const pages = [
  { id: 'dashboard', label: '總覽', icon: 'ri-dashboard-line' },
  { id: 'records', label: '成績查詢', icon: 'ri-file-list-3-line' },
  { id: 'results', label: '換算結果', icon: 'ri-trophy-line' },
  { id: 'analysis', label: '統計分析', icon: 'ri-bar-chart-2-line' },
];

const PAGE_SIZE = 50;

function getPeriodOptions() {
  const now = new Date();
  const rocYear = now.getFullYear() - 1911;
  const max = rocYear + 1;
  const opts = [];
  for (let y = max; y >= 114; y--) {
    opts.push(`${y}年下半年`);
    opts.push(`${y}年上半年`);
  }
  return opts;
}
const PERIOD_OPTIONS = getPeriodOptions();

const SCORE_COLS = [
  { label: '立跳', key: 'standing_jump' },
  { label: '後拋', key: 'ball_throw' },
  { label: '折返', key: 'shuttle_run' },
  { label: '硬舉', key: 'deadlift' },
  { label: '懸吊', key: 'chin_up' },
  { label: '負重', key: 'loaded_walk' },
  { label: '跑步', key: 'run_1500' },
];

const CHART_FONT = { family: 'Noto Sans TC', size: 12 };

// ── hooks ───────────────────────────────────────────────────
function useLocalRecords() {
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fitness_records') || '[]'); } catch { return []; }
  });
  const replace = useCallback(next => {
    setRecords(next);
    localStorage.setItem('fitness_records', JSON.stringify(next));
  }, []);
  return [records, replace];
}

function useChart(ref, type, data, options) {
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, { type, data, options });
    return () => chart.destroy();
  }, [JSON.stringify(data)]);
}

// ── small components ────────────────────────────────────────
function ScoreBadge({ value }) {
  const tone = value >= 10 ? 'high' : value >= 6 ? 'mid' : 'low';
  return <span className={`score ${tone}`}>{value}</span>;
}
function PassBadge({ pass }) {
  return <span className={`pass ${pass ? 'yes' : 'no'}`}>{pass ? '及格' : '不及格'}</span>;
}
function Pagination({ page, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return <div className="pagination" style={{ fontSize: 13, color: 'var(--muted)' }}>共 {total} 筆</div>;
  return (
    <div className="pagination">
      <span>共 {total} 筆，第 {page}/{pages} 頁</span>
      <button disabled={page <= 1} onClick={() => onPage(p => Math.max(1, p - 1))}>上一頁</button>
      <button disabled={page >= pages} onClick={() => onPage(p => Math.min(pages, p + 1))}>下一頁</button>
    </div>
  );
}

function FilterBar({ period, setPeriod, brigade, setBrigade, squad, setSquad, unit, setUnit, search, setSearch, onReset }) {
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
          {squads.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {setUnit && unit !== undefined && (
        <select value={unit} onChange={e => { setUnit(e.target.value); onReset?.(); }}
          disabled={brigade === 'all' || squad === 'all' || squad === '大隊本部'}>
          <option value="all">全部分隊</option>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      )}
      {search !== undefined && (
        <input type="search" placeholder="搜尋姓名" value={search}
          onChange={e => { setSearch(e.target.value); onReset?.(); }} />
      )}
    </div>
  );
}

// ── GSheet ──────────────────────────────────────────────────
async function gasPost(body) {
  const resp = await fetch(GAS_URL, { method: 'POST', body: new URLSearchParams(body) });
  return resp.json();
}

// ── Chart components ────────────────────────────────────────
function RadarChart({ data }) {
  const ref = useRef(null);
  useChart(ref, 'radar', {
    labels: data.labels,
    datasets: [{ label: '平均得分', data: data.values, backgroundColor: 'rgba(220,38,38,0.15)', borderColor: '#dc2626', borderWidth: 2, pointBackgroundColor: '#dc2626' }],
  }, {
    responsive: true, maintainAspectRatio: false,
    scales: { r: { min: 0, max: 20, ticks: { font: CHART_FONT }, pointLabels: { font: { ...CHART_FONT, size: 11 } } } },
    plugins: { legend: { display: false } },
  });
  return <canvas ref={ref} />;
}

function LineChart({ labels, datasets }) {
  const ref = useRef(null);
  useChart(ref, 'line', { labels, datasets }, {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { font: CHART_FONT, boxWidth: 12 } } },
    scales: { x: { ticks: { font: CHART_FONT } }, y: { beginAtZero: true, ticks: { font: CHART_FONT } } },
  });
  return <canvas ref={ref} />;
}

function BarChart({ labels, datasets, yCallback }) {
  const ref = useRef(null);
  useChart(ref, 'bar', { labels, datasets }, {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: CHART_FONT } },
      y: { min: 0, max: 100, ticks: { font: CHART_FONT, callback: yCallback || (v => v + '%') } },
    },
  });
  return <canvas ref={ref} />;
}

// ── RecordModal ─────────────────────────────────────────────
const mLabel = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 };
const mInput = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' };

function RecordModal({ record, period, onSave, onDelete, onClose }) {
  const { year, semester } = parsePeriod(period);
  const isNew = !record?.id;

  const [brigade, setBrigade] = useState(record?.brigade || BRIGADES[0]);
  const [squad, setSquad] = useState(record?.squad || '');
  const [unit, setUnit] = useState(record?.unit || '');
  const [name, setName] = useState(record?.name || '');
  const [gender, setGender] = useState(record?.gender || '男');
  const [age, setAge] = useState(record?.age ?? '');
  const [vals, setVals] = useState({
    standing_jump: record?.standing_jump ?? '',
    ball_throw: record?.ball_throw ?? '',
    shuttle_run: record?.shuttle_run ?? '',
    deadlift: record?.deadlift ?? '',
    chin_up_count: record?.chin_up_count ?? '',
    chin_up_sec: record?.chin_up_sec ?? '',
    loaded_walk: record?.loaded_walk ?? '',
    run_1500: record?.run_1500 ?? '',
  });

  const squads = useMemo(() => getSquadsForBrigade(brigade), [brigade]);
  const units = useMemo(() => {
    if (!squad || squad === '大隊本部') return [];
    return getAllUnits(brigade, squad);
  }, [brigade, squad]);

  function handleBrigadeChange(v) { setBrigade(v); setSquad(''); setUnit(''); }
  function handleSquadChange(v) { setSquad(v); setUnit(''); }

  function handleSubmit() {
    if (!name.trim()) { alert('請填寫姓名'); return; }
    const rec = {
      id: record?.id || crypto.randomUUID(),
      year, semester,
      brigade,
      squad: squad || getSquadForUnit(unit),
      unit,
      name: name.trim(),
      gender,
      age: age !== '' ? parseInt(age) : null,
      ageGroup: getAgeGroup(age),
      standing_jump: vals.standing_jump !== '' ? parseFloat(vals.standing_jump) : null,
      ball_throw: vals.ball_throw !== '' ? parseFloat(vals.ball_throw) : null,
      shuttle_run: vals.shuttle_run !== '' ? parseFloat(vals.shuttle_run) : null,
      deadlift: vals.deadlift !== '' ? parseFloat(vals.deadlift) : null,
      chin_up_count: vals.chin_up_count !== '' ? parseFloat(vals.chin_up_count) : null,
      chin_up_sec: vals.chin_up_sec !== '' ? parseFloat(vals.chin_up_sec) : null,
      loaded_walk: vals.loaded_walk !== '' ? parseFloat(vals.loaded_walk) : null,
      run_1500: vals.run_1500 !== '' ? parseFloat(vals.run_1500) : null,
    };
    onSave(rec);
  }

  const scoreFields = [
    ['立定跳遠 (cm)', 'standing_jump'], ['後拋擲遠 (m)', 'ball_throw'],
    ['折返跑 (趟)', 'shuttle_run'], ['菱形槓硬舉 (kg)', 'deadlift'],
    ['懸吊屈體 (次)', 'chin_up_count'], ['懸吊屈體 (秒)', 'chin_up_sec'],
    ['負重行走 (kg)', 'loaded_walk'], ['1500跑步 (秒)', 'run_1500'],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>{isNew ? '新增紀錄' : '編輯紀錄'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><label style={mLabel}>大隊</label>
            <select style={mInput} value={brigade} onChange={e => handleBrigadeChange(e.target.value)}>
              {BRIGADES.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div><label style={mLabel}>中隊</label>
            <select style={mInput} value={squad} onChange={e => handleSquadChange(e.target.value)}>
              <option value="">請選擇</option>
              {squads.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={mLabel}>分隊</label>
            {units.length > 0
              ? <select style={mInput} value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="">請選擇</option>
                  {units.map(u => <option key={u}>{u}</option>)}
                </select>
              : <input style={mInput} value={unit} onChange={e => setUnit(e.target.value)} placeholder="分隊名稱" />
            }
          </div>
          <div><label style={mLabel}>姓名 *</label>
            <input style={mInput} value={name} onChange={e => setName(e.target.value)} placeholder="請輸入姓名" />
          </div>
          <div><label style={mLabel}>性別</label>
            <select style={mInput} value={gender} onChange={e => setGender(e.target.value)}>
              <option>男</option><option>女</option>
            </select>
          </div>
          <div><label style={mLabel}>年齡</label>
            <input style={mInput} type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="歲" />
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>成績（原始數值）</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {scoreFields.map(([label, key]) => (
              <div key={key}><label style={mLabel}>{label}</label>
                <input style={mInput} type="number" step="any" value={vals[key]}
                  onChange={e => setVals(v => ({ ...v, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {!isNew && onDelete && (
            <button onClick={() => { if (window.confirm('確定刪除此筆紀錄？')) onDelete(record.id); }}
              style={{ border: '1px solid #dc2626', background: '#fff', color: '#dc2626', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
              刪除此筆
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={onClose}
              style={{ border: '1px solid #64748b', background: '#fff', color: '#64748b', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
              取消
            </button>
            <button onClick={handleSubmit}
              style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
              {isNew ? '新增' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── main App ────────────────────────────────────────────────
export function App() {
  const [page, setPage] = useState('dashboard');
  const [records, setRecords] = useLocalRecords();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('admin_key') || '');
  const isAdmin = !!adminKey;

  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [brigade, setBrigade] = useState('all');
  const [squad, setSquad] = useState('all');
  const [unit, setUnit] = useState('all');
  const [search, setSearch] = useState('');
  const [recPage, setRecPage] = useState(1);
  const [resPage, setResPage] = useState(1);

  const [editTarget, setEditTarget] = useState(null); // null=closed, {}=new, record=editing

  // personal analysis state
  const [personalName, setPersonalName] = useState('');
  const [personalResults, setPersonalResults] = useState(null);

  const { year, semester } = parsePeriod(period);

  const filtered = useMemo(() => {
    const kw = search.trim();
    return records.filter(r => {
      if (year && String(r.year) !== String(year)) return false;
      if (semester && String(r.semester || '上半年') !== semester) return false;
      if (brigade !== 'all' && r.brigade !== brigade) return false;
      if (squad !== 'all' && squad !== '') {
        const rSquad = r.squad || getSquadForUnit(r.unit);
        if (rSquad !== squad) return false;
      }
      if (unit !== 'all' && r.unit !== unit) return false;
      if (kw && !String(r.name || '').includes(kw)) return false;
      return true;
    });
  }, [records, year, semester, brigade, squad, unit, search]);

  const stats = useMemo(() => {
    const scored = filtered.map(calcRecord);
    const total = filtered.length;
    const pass = scored.filter(s => s.pass).length;
    const avg = total ? (scored.reduce((s, c) => s + c.total, 0) / total).toFixed(1) : '0.0';
    return { total, pass, avg, rate: total ? ((pass / total) * 100).toFixed(1) : '0.0' };
  }, [filtered]);

  // Cross-year trend data
  const trendData = useMemo(() => {
    const src = brigade !== 'all' ? records.filter(r => r.brigade === brigade) : records;
    const map = {};
    src.forEach(r => {
      const p = `${r.year}年${r.semester || '上半年'}`;
      if (!map[p]) map[p] = [];
      map[p].push(r);
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const ya = parseInt(a), yb = parseInt(b);
        const sa = a.includes('上') ? 0 : 1, sb = b.includes('上') ? 0 : 1;
        return ya !== yb ? ya - yb : sa - sb;
      })
      .map(([p, arr]) => {
        const scored = arr.map(calcRecord);
        const pass = scored.filter(s => s.pass).length;
        return {
          period: p, count: arr.length,
          passRate: arr.length ? +(pass / arr.length * 100).toFixed(1) : 0,
          avgScore: arr.length ? +(scored.reduce((s, c) => s + c.total, 0) / arr.length).toFixed(1) : 0,
        };
      });
  }, [records, brigade]);

  // Radar: avg per item for current period
  const radarData = useMemo(() => {
    const items = ['立定跳遠', '後拋擲遠', '折返跑', '菱形槓硬舉', '懸吊', '負重行走', '跑步'];
    const keys = ['standing_jump', 'ball_throw', 'shuttle_run', 'deadlift', 'chin_up', 'loaded_walk', 'run_1500'];
    const values = keys.map(k => {
      if (!filtered.length) return 0;
      return +(filtered.reduce((s, r) => s + (calcRecord(r)[k] || 0), 0) / filtered.length).toFixed(1);
    });
    return { labels: items, values };
  }, [filtered]);

  // Brigade comparison
  const brigadeCompare = useMemo(() => {
    return BRIGADES.map(b => {
      const arr = records.filter(r => r.brigade === b && String(r.year) === year && r.semester === semester);
      const scored = arr.map(calcRecord);
      const pass = scored.filter(s => s.pass).length;
      return {
        brigade: b, count: arr.length,
        passRate: arr.length ? +(pass / arr.length * 100).toFixed(1) : 0,
        avgScore: arr.length ? +(scored.reduce((s, c) => s + c.total, 0) / arr.length).toFixed(1) : 0,
      };
    });
  }, [records, year, semester]);

  function handleModalSave(rec) {
    const idx = records.findIndex(r => r.id === rec.id);
    const next = idx >= 0 ? records.map(r => r.id === rec.id ? rec : r) : [...records, rec];
    setRecords(next);
    resetPages();
    setEditTarget(null);
    showMsg(idx >= 0 ? '已更新紀錄' : '已新增紀錄');
  }
  function handleModalDelete(id) {
    setRecords(records.filter(r => r.id !== id));
    setEditTarget(null);
    showMsg('已刪除紀錄');
  }

  function handleDownloadTemplate() {
    const headers = ['號碼', '大隊', '分隊', '姓名', '性別', '年齡', '', '立定跳遠(cm)', '後拋擲遠(m)', '折返跑(趟)', '菱形槓硬舉(kg)', '懸吊屈體(次)', '懸吊屈體(秒)', '負重行走(kg)', '1500跑步(秒)'];
    const example = [1, '第一大隊', '第一分隊', '王小明', '男', 35, '', 220, 8.5, 10, 80, 15, '', 20, 450];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    XLSX.utils.book_append_sheet(wb, ws, '成績輸入');
    XLSX.writeFile(wb, '常訓體能成績匯入範本.xlsx');
  }

  function resetPages() { setRecPage(1); setResPage(1); }
  function showMsg(text) { setMsg(text); setTimeout(() => setMsg(''), 4000); }

  function handleAdminLogin() {
    const key = window.prompt('請輸入管理者金鑰');
    if (!key) return;
    setAdminKey(key);
    localStorage.setItem('admin_key', key);
    showMsg('管理者模式已啟用');
  }
  function handleAdminLogout() {
    setAdminKey('');
    localStorage.removeItem('admin_key');
    showMsg('已登出');
  }

  async function handleLoadData() {
    setLoading(true);
    try {
      const { records: next, incoming, skipped } = await loadFromGAS({ year, semester }, records);
      setRecords(next); resetPages();
      showMsg(`已更新 ${incoming.length} 筆${skipped > 0 ? `，略過重複 ${skipped} 筆` : ''}`);
    } catch (e) { showMsg('更新失敗：' + e.message); }
    finally { setLoading(false); }
  }

  async function handleSaveData() {
    if (!adminKey) return;
    const toSave = records.filter(r => String(r.year) === String(year) && r.semester === semester);
    if (!toSave.length) { showMsg('此年度/上下半年沒有資料'); return; }
    setLoading(true);
    try {
      const data = await gasPost({ action: 'save', adminKey, year, semester, records: JSON.stringify(toSave) });
      if (data.ok) showMsg(`已儲存 ${data.saved} 筆`);
      else showMsg('儲存失敗：' + (data.error || ''));
    } catch (e) { showMsg('儲存失敗：' + e.message); }
    finally { setLoading(false); }
  }

  async function handleDeletePeriod() {
    if (!adminKey) return;
    if (!year || !semester) { showMsg('請先選擇年度'); return; }
    const label = `${year}年${semester}`;
    if (!window.confirm(`確定要刪除「${label}」的所有資料嗎？此操作無法復原。`)) return;
    setLoading(true);
    try {
      const data = await gasPost({ action: 'deletePeriod', adminKey, year, semester });
      if (data.ok) {
        const next = records.filter(r => !(String(r.year) === String(year) && r.semester === semester));
        setRecords(next); resetPages();
        showMsg(`已刪除 ${data.deleted} 筆`);
      } else showMsg('刪除失敗：' + (data.error || ''));
    } catch (e) { showMsg('刪除失敗：' + e.message); }
    finally { setLoading(false); }
  }

  function handleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets['成績輸入'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const { year: iy, semester: is } = parsePeriod(period);
        let added = 0, updated = 0, skipped = 0;
        const keyMap = {};
        records.forEach((r, i) => { keyMap[`${r.year}|${r.semester}|${r.unit}|${r.name}`] = i; });
        const next = [...records];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[3]) { skipped++; continue; }
          const name = String(row[3] || '').trim();
          if (!name || name === '姓名' || name.startsWith('【')) { skipped++; continue; }
          const age = parseInt(row[5]);
          const unitVal = String(row[2] || '').trim();
          const rec = {
            year: iy, semester: is,
            brigade: String(row[1] || '').trim(),
            squad: getSquadForUnit(unitVal),
            unit: unitVal, name,
            gender: String(row[4] || '男').trim(),
            age: isNaN(age) ? null : age,
            ageGroup: getAgeGroup(age),
            standing_jump: row[7] !== undefined && row[7] !== '' ? parseFloat(row[7]) : null,
            ball_throw: row[8] !== undefined && row[8] !== '' ? parseFloat(row[8]) : null,
            shuttle_run: row[9] !== undefined && row[9] !== '' ? parseFloat(row[9]) : null,
            deadlift: row[10] !== undefined && row[10] !== '' ? parseFloat(row[10]) : null,
            chin_up_count: row[11] !== undefined && row[11] !== '' ? parseFloat(row[11]) : null,
            chin_up_sec: row[12] !== undefined && row[12] !== '' ? parseFloat(row[12]) : null,
            loaded_walk: row[13] !== undefined && row[13] !== '' ? parseFloat(row[13]) : null,
            run_1500: row[14] !== undefined && row[14] !== '' ? parseFloat(row[14]) : null,
          };
          const k = `${iy}|${is}|${unitVal}|${name}`;
          if (keyMap[k] !== undefined) { rec.id = next[keyMap[k]].id; next[keyMap[k]] = rec; updated++; }
          else { rec.id = crypto.randomUUID(); keyMap[k] = next.length; next.push(rec); added++; }
        }
        setRecords(next); resetPages();
        showMsg(`匯入完成：${added} 新增，${updated} 更新，${skipped} 略過`);
      } catch (err) { showMsg('匯入失敗：' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleExportRaw() {
    if (!filtered.length) { showMsg('沒有資料'); return; }
    const h = ['號碼','大隊','中隊','分隊','姓名','性別','年齡','年齡層','立定跳遠(cm)','後拋擲遠(m)','折返跑(趟)','菱形槓硬舉(kg)','懸吊屈體(次)','懸吊屈體(秒)','負重行走(kg)','1500跑步(秒)'];
    const d = filtered.map((r, i) => [i+1, r.brigade, r.squad||getSquadForUnit(r.unit), r.unit, r.name, r.gender, r.age, r.ageGroup, r.standing_jump, r.ball_throw, r.shuttle_run, r.deadlift, r.chin_up_count, r.chin_up_sec, r.loaded_walk, r.run_1500]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h, ...d]), '原始資料');
    XLSX.writeFile(wb, `常訓體能原始資料_${period}.xlsx`);
  }

  function handleExportResults() {
    if (!filtered.length) { showMsg('沒有資料'); return; }
    const h = ['號碼','大隊','中隊','分隊','姓名','性別','年齡層','立跳','後拋','折返','硬舉','懸吊','負重','跑步','總分','及格'];
    const d = filtered.map((r, i) => { const s = calcRecord(r); return [i+1, r.brigade, r.squad||getSquadForUnit(r.unit), r.unit, r.name, r.gender, r.ageGroup, s.standing_jump, s.ball_throw, s.shuttle_run, s.deadlift, s.chin_up, s.loaded_walk, s.run_1500, s.total, s.pass?'及格':'不及格']; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h, ...d]), '換算結果');
    XLSX.writeFile(wb, `常訓體能換算結果_${period}.xlsx`);
  }

  // Personal analysis
  function handlePersonalSearch() {
    const name = personalName.trim();
    if (!name) return;
    const matched = records.filter(r => r.name === name);
    if (!matched.length) { setPersonalResults([]); return; }
    // Group by brigade+unit
    const groups = {};
    matched.forEach(r => {
      const key = `${r.brigade}/${r.unit}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    const result = Object.entries(groups).map(([key, recs]) => {
      const sorted = [...recs].sort((a, b) => {
        const ya = parseInt(a.year), yb = parseInt(b.year);
        return ya !== yb ? ya - yb : (a.semester || '').includes('上') ? -1 : 1;
      });
      return { key, recs: sorted };
    });
    setPersonalResults(result);
  }

  const pagedRec = filtered.slice((recPage - 1) * PAGE_SIZE, recPage * PAGE_SIZE);
  const pagedRes = filtered.slice((resPage - 1) * PAGE_SIZE, resPage * PAGE_SIZE);

  const btnStyle = (color = '#dc2626') => ({ border: `1px solid ${color}`, background: color, color: '#fff', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13 });
  const outlineStyle = (color = '#64748b') => ({ border: `1px solid ${color}`, background: '#fff', color, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo"><b>台北消防局</b><span>常訓體能成績管理系統</span></div>
        {pages.map(p => (
          <button key={p.id} className={page === p.id ? 'active' : ''} onClick={() => setPage(p.id)}>
            <i className={p.icon}></i>{p.label}
          </button>
        ))}
        <small style={{ marginTop: 'auto' }}>{isAdmin ? '管理者模式' : '查詢模式'}</small>
      </aside>

      <main className="main">
        <header>
          <h1>{pages.find(p => p.id === page)?.label}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {msg && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{msg}</span>}
            {isAdmin
              ? <button onClick={handleAdminLogout} style={outlineStyle('#dc2626')}>登出管理者</button>
              : <button onClick={handleAdminLogin} style={outlineStyle()}>管理者登入</button>}
          </div>
        </header>

        {/* Shared toolbar */}
        {['dashboard', 'records', 'results'].includes(page) && (
          <section style={{ paddingBottom: 0 }}>
            <div className="toolbar">
              <button style={btnStyle('#475569')} onClick={handleLoadData} disabled={loading}>
                {loading ? '更新中...' : '更新資料'}
              </button>
              {isAdmin && <>
                <button style={btnStyle('#059669')} onClick={handleSaveData} disabled={loading}>儲存資料</button>
                <button style={btnStyle('#2563eb')} onClick={() => setEditTarget({})}>新增紀錄</button>
                <button style={btnStyle('#059669')} onClick={handleExportRaw}>匯出原始資料</button>
                <button style={btnStyle('#059669')} onClick={handleExportResults}>匯出換算結果</button>
                <label style={btnStyle('#059669')}>
                  匯入Excel
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                    onChange={e => { handleImport(e.target.files[0]); e.target.value = ''; }} />
                </label>
                <button style={outlineStyle('#059669')} onClick={handleDownloadTemplate}>下載範本</button>
                <button style={btnStyle('#dc2626')} onClick={handleDeletePeriod} disabled={loading}>刪除此年度資料</button>
              </>}
            </div>
          </section>
        )}

        {/* Dashboard */}
        {page === 'dashboard' && (
          <section>
            <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
              squad={squad} setSquad={setSquad} onReset={resetPages} />
            <div className="cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
              {[['總人數', stats.total, '人員紀錄'], ['及格人數', stats.pass, '114-115年≥50 / 116年起≥60'], ['及格率', stats.rate + '%', '及格/總人數'], ['平均分數', stats.avg, '所有人員平均']].map(([l, v, sub]) => (
                <div key={l}><span>{l}</span><b>{v}</b><span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span></div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>各項目平均得分</h3>
                <div style={{ height: 280 }}><RadarChart data={radarData} /></div>
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>大隊及格率 ({period})</h3>
                <div style={{ height: 280 }}>
                  <BarChart
                    labels={brigadeCompare.map(d => d.brigade)}
                    datasets={[{ label: '及格率(%)', data: brigadeCompare.map(d => d.passRate), backgroundColor: ['#dc2626','#b91c1c','#ef4444','#f87171'], borderRadius: 4 }]}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Records */}
        {page === 'records' && (
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
        )}

        {/* Results */}
        {page === 'results' && (
          <section>
            <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
              squad={squad} setSquad={setSquad} onReset={resetPages} />
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>年齡層</th>{SCORE_COLS.map(c => <th key={c.key}>{c.label}</th>)}<th>總分</th><th>狀態</th></tr></thead>
                <tbody>
                  {pagedRes.map(r => { const s = calcRecord(r); return (
                    <tr key={r.id} style={!s.pass ? { background: '#fff5f5' } : {}}>
                      <td>{r.brigade}</td><td>{r.squad || getSquadForUnit(r.unit)}</td><td>{r.unit}</td>
                      <td><b>{r.name}</b></td><td>{r.gender}</td><td>{r.ageGroup}</td>
                      {SCORE_COLS.map(c => <td key={c.key}><ScoreBadge value={s[c.key] ?? 0} /></td>)}
                      <td><b style={{ color: s.pass ? '#059669' : '#dc2626' }}>{s.total}</b></td>
                      <td><PassBadge pass={s.pass} /></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
            {!filtered.length && <div className="empty" style={{ padding: 32, textAlign: 'center' }}>沒有符合條件的資料</div>}
            <Pagination page={resPage} total={filtered.length} onPage={setResPage} />
          </section>
        )}

        {/* Analysis */}
        {page === 'analysis' && (
          <section>
            <div className="filters" style={{ marginBottom: 16 }}>
              <select value={brigade} onChange={e => setBrigade(e.target.value)}>
                <option value="all">全部大隊</option>
                {BRIGADES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Sub-tabs */}
            {(() => {
              const [tab, setTab] = useState('trend');
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
                      const ITEM_COLORS = ['#dc2626','#f59e0b','#059669','#2563eb','#7c3aed','#db2777','#475569'];
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
            })()}
          </section>
        )}
      </main>

      {editTarget !== null && (
        <RecordModal
          record={Object.keys(editTarget).length ? editTarget : null}
          period={period}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
