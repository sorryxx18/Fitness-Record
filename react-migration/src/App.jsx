import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BRIGADES, DEFAULT_PERIOD,
  calcRecord, getAgeGroup, getSquadForUnit, loadFromGAS, parsePeriod,
} from './lib/fitnessCore.js';
import { pages, PAGE_SIZE, SCORE_COLS } from './constants/appConstants.js';
import { useLocalRecords } from './hooks/useLocalRecords.js';
import { gasPost } from './services/gasClient.js';
import { FilterBar } from './components/FilterBar.jsx';
import { ScoreBadge, PassBadge } from './components/badges.jsx';
import { Pagination } from './components/Pagination.jsx';
import { RadarChart, BarChart } from './components/Charts.jsx';
import { RecordModal } from './components/RecordModal.jsx';
import { ExportModal } from './components/ExportModal.jsx';
import { TrainingPage } from './pages/TrainingPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { RecordsPage } from './pages/RecordsPage.jsx';
import { ResultsPage } from './pages/ResultsPage.jsx';
import { AnalysisPage } from './pages/AnalysisPage.jsx';

// ── main App ────────────────────────────────────────────────
export function App() {
  const [page, setPage] = useState('dashboard');
  const [records, setRecords] = useLocalRecords();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('admin_key') || '');
  const isAdmin = !!adminKey;

  const [period, setPeriod] = useState(() => {
    // 預設選最新有資料的期別，而非當下日曆期別
    try {
      const recs = JSON.parse(localStorage.getItem('fitness_records') || '[]');
      if (recs?.length) {
        const latest = [...new Set(recs.map(r => `${r.year}年${r.semester || '上半年'}`))]
          .sort().reverse()[0];
        if (latest) return latest;
      }
    } catch {}
    return DEFAULT_PERIOD;
  });
  const [brigade, setBrigade] = useState('all');
  const [squad, setSquad] = useState('all');
  const [unit, setUnit] = useState('all');
  const [search, setSearch] = useState('');
  const [recPage, setRecPage] = useState(1);
  const [resPage, setResPage] = useState(1);

  const [editTarget, setEditTarget] = useState(null); // null=closed, {}=new, record=editing
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [trainingRecordsForExport, setTrainingRecordsForExport] = useState([]);

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


  // 自動載入：全量拉取所有年度，不帶期別篩選（可靠、不受期別選擇影響）
  useEffect(() => {
    setLoading(true);
    loadFromGAS({ year: '', semester: '' }, [])
      .then(({ records: next }) => {
        setRecords(next);
        resetPages();
        // 自動切到最新有資料的期別
        if (next.length) {
          const latest = [...new Set(next.map(r => `${r.year}年${r.semester || '上半年'}`))]
            .sort().reverse()[0];
          if (latest) setPeriod(p => {
            const hasCurrent = next.some(r => `${r.year}年${r.semester || '上半年'}` === p);
            return hasCurrent ? p : latest;
          });
        }
      })
      .catch(e => showMsg('載入失敗：' + e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleModalSave(rec) {
    const idx = records.findIndex(r => r.id === rec.id);
    if (idx < 0 && String(rec.year) === '114') { showMsg('114年資料已封存，只開放建立 115年上半年 資料'); return; }
    const next = idx >= 0 ? records.map(r => r.id === rec.id ? rec : r) : [...records, rec];
    setRecords(next);
    resetPages();
    setEditTarget(null);
    if (adminKey) {
      try {
        await gasPost({ action: 'upsert', adminKey, record: JSON.stringify(rec) });
        showMsg(idx >= 0 ? '已更新' : '已新增');
      } catch {
        showMsg('儲存失敗，請稍後再試');
      }
    } else {
      showMsg(idx >= 0 ? '已更新' : '已新增');
    }
  }
  async function handleModalDelete(id) {
    const rec = records.find(r => r.id === id);
    if (rec && String(rec.year) === '114') { showMsg('114年資料已封存，無法刪除'); return; }
    setRecords(records.filter(r => r.id !== id));
    setEditTarget(null);
    if (adminKey && rec) {
      try {
        await gasPost({ action: 'delete', adminKey, id, year: rec.year });
        showMsg('已刪除');
      } catch {
        showMsg('刪除失敗，請稍後再試');
      }
    } else {
      showMsg('已刪除');
    }
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
      const { records: next } = await loadFromGAS({ year: '', semester: '' }, []);
      setRecords(next); resetPages();
      if (next.length) {
        const latest = [...new Set(next.map(r => `${r.year}年${r.semester || '上半年'}`))]
          .sort().reverse()[0];
        if (latest) setPeriod(p => {
          const hasCurrent = next.some(r => `${r.year}年${r.semester || '上半年'}` === p);
          return hasCurrent ? p : latest;
        });
      }
      showMsg(`已更新 ${next.length} 筆`);
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
    if (year === '114') { showMsg('114年資料已封存，無法刪除整年度資料'); return; }
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
      <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="logo"><b>臺北消防局</b><span>常訓體能成績管理系統</span><small style={{display:"block",fontSize:11,color:"#94a3b8",marginTop:4,lineHeight:1.4}}>統整各單位常訓體能成績，支援跨年度查詢與報表輸出。</small></div>
        {pages.map(p => (
          <button key={p.id} className={page === p.id ? 'active' : ''} onClick={() => { setPage(p.id); setSidebarOpen(false); }}>
            <i className={p.icon}></i>{p.label}
          </button>
        ))}
        <small style={{ marginTop: 'auto' }}>{isAdmin ? '管理者模式' : '查詢模式'}</small>
      </aside>
      <div className={sidebarOpen ? 'sidebar-backdrop open' : 'sidebar-backdrop'} onClick={() => setSidebarOpen(false)} />

      <main className="main">
        <header>
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}><i className="ri-menu-line" /></button>
          <h1>{pages.find(p => p.id === page)?.label}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {msg && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{msg}</span>}
            <button onClick={() => setShowExport(true)} style={{ ...outlineStyle('#059669'), display:'flex', alignItems:'center', gap:4 }}>
              <i className="ri-download-2-line"></i>匯出
            </button>
            {isAdmin
              ? <button onClick={handleAdminLogout} style={outlineStyle('#dc2626')}>登出管理者</button>
              : <button onClick={handleAdminLogin} style={outlineStyle()}>管理者登入</button>}
          </div>
        </header>

        {/* Top loading progress bar */}
        <div className={loading ? 'progress-bar active' : 'progress-bar'} />

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
          <DashboardPage
            brigade={brigade}
            setBrigade={setBrigade}
            trendData={trendData}
            trainingRecords={trainingRecordsForExport}
            records={records}
          />
        )}

        {/* Records */}
        {page === 'records' && (
          <RecordsPage
            isAdmin={isAdmin}
            period={period}
            setPeriod={setPeriod}
            brigade={brigade}
            setBrigade={setBrigade}
            squad={squad}
            setSquad={setSquad}
            unit={unit}
            setUnit={setUnit}
            search={search}
            setSearch={setSearch}
            resetPages={resetPages}
            pagedRec={pagedRec}
            filtered={filtered}
            recPage={recPage}
            setRecPage={setRecPage}
            setEditTarget={setEditTarget}
          />
        )}

        {/* Results */}
        {page === 'results' && (
          <ResultsPage
            period={period}
            setPeriod={setPeriod}
            brigade={brigade}
            setBrigade={setBrigade}
            squad={squad}
            setSquad={setSquad}
            resetPages={resetPages}
            pagedRes={pagedRes}
            filtered={filtered}
            resPage={resPage}
            setResPage={setResPage}
          />
        )}

        {/* Analysis */}
        {page === 'analysis' && (
          <AnalysisPage
            brigade={brigade}
            setBrigade={setBrigade}
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
        )}
        {/* Training Records */}
        {page === 'training' && (
          <TrainingPage isAdmin={isAdmin} adminKey={adminKey} onRecordsChange={setTrainingRecordsForExport} onLoadingChange={setLoading} />
        )}

      </main>

      {showExport && (
        <ExportModal
          fitnessRecords={records}
          trainingRecords={trainingRecordsForExport}
          period={period}
          onClose={() => setShowExport(false)}
        />
      )}

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
