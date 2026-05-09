import { useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  BRIGADES, DEFAULT_PERIOD, GAS_URL,
  calcRecord, getAllUnits, getAgeGroup, getSquadForUnit,
  getSquadsForBrigade, loadFromGAS, parsePeriod,
  recordPeriodKey, dedupeRecordsByIdentity,
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

// ── localStorage hook ───────────────────────────────────────
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
    if (brigade === 'all') return [];
    if (squad === '大隊本部') return [];
    return getAllUnits(brigade, squad === 'all' ? null : squad);
  }, [brigade, squad]);

  function handleBrigade(v) { setBrigade(v); setSquad('all'); setUnit('all'); onReset?.(); }
  function handleSquad(v) { setSquad(v); setUnit('all'); onReset?.(); }

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
      <select value={squad} onChange={e => handleSquad(e.target.value)} disabled={brigade === 'all'}>
        <option value="all">全部中隊</option>
        {squads.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {unit !== undefined && (
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

// ── GSheet actions ──────────────────────────────────────────
async function gasPost(body) {
  const resp = await fetch(GAS_URL, { method: 'POST', body: new URLSearchParams(body) });
  return resp.json();
}

// ── main App ────────────────────────────────────────────────
export function App() {
  const [page, setPage] = useState('dashboard');
  const [records, setRecords] = useLocalRecords();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('admin_key') || '');
  const isAdmin = !!adminKey;

  // shared filter state
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [brigade, setBrigade] = useState('all');
  const [squad, setSquad] = useState('all');
  const [unit, setUnit] = useState('all');
  const [search, setSearch] = useState('');
  const [recPage, setRecPage] = useState(1);
  const [resPage, setResPage] = useState(1);
  const { year, semester } = parsePeriod(period);

  const filtered = useMemo(() => {
    const kw = search.trim();
    return records.filter(r => {
      if (r.year && String(r.year) !== String(year)) return false;
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

  function resetPages() { setRecPage(1); setResPage(1); }

  function showMsg(text) { setMsg(text); setTimeout(() => setMsg(''), 4000); }

  function handleAdminLogin() {
    const key = window.prompt('請輸入管理者金鑰（ADMIN_KEY）');
    if (!key) return;
    setAdminKey(key);
    sessionStorage.setItem('admin_key', key);
    showMsg('管理者模式已啟用');
  }

  function handleAdminLogout() {
    setAdminKey('');
    sessionStorage.removeItem('admin_key');
    showMsg('已登出管理者模式');
  }

  async function handleLoadGSheet() {
    setLoading(true);
    try {
      const { records: next, incoming, skipped } = await loadFromGAS({ year, semester }, records);
      setRecords(next);
      resetPages();
      showMsg(`已載入 ${incoming.length} 筆${skipped > 0 ? `，略過重複 ${skipped} 筆` : ''}`);
    } catch (e) {
      showMsg('載入失敗：' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveGSheet() {
    if (!adminKey) return;
    const { year: y, semester: s } = parsePeriod(period);
    const toSave = records.filter(r => String(r.year) === String(y) && r.semester === s);
    if (!toSave.length) { showMsg('此年度/學期沒有資料'); return; }
    setLoading(true);
    try {
      const data = await gasPost({
        action: 'save', adminKey,
        year: y, semester: s,
        records: JSON.stringify(toSave),
      });
      if (data.ok) showMsg(`已同步 ${data.saved} 筆至 GSheet`);
      else showMsg('同步失敗：' + (data.error || ''));
    } catch (e) {
      showMsg('同步失敗：' + e.message);
    } finally {
      setLoading(false);
    }
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
        let imported = 0, updated = 0, skipped = 0;
        const keyMap = {};
        records.forEach((r, i) => { keyMap[`${r.year}|${r.semester}|${r.unit}|${r.name}`] = i; });
        const next = [...records];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[3]) { skipped++; continue; }
          const name = String(row[3] || '').trim();
          if (!name || name === '姓名' || name.startsWith('【')) { skipped++; continue; }
          const age = parseInt(row[5]);
          const rec = {
            year: iy, semester: is,
            brigade: String(row[1] || '').trim(),
            squad: getSquadForUnit(String(row[2] || '').trim()),
            unit: String(row[2] || '').trim(),
            name, gender: String(row[4] || '男').trim(),
            age: isNaN(age) ? null : age,
            ageGroup: getAgeGroup(age),
            standing_jump: row[7] !== '' ? parseFloat(row[7]) : null,
            ball_throw: row[8] !== '' ? parseFloat(row[8]) : null,
            shuttle_run: row[9] !== '' ? parseFloat(row[9]) : null,
            deadlift: row[10] !== '' ? parseFloat(row[10]) : null,
            chin_up_count: row[11] !== '' ? parseFloat(row[11]) : null,
            chin_up_sec: row[12] !== '' ? parseFloat(row[12]) : null,
            loaded_walk: row[13] !== '' ? parseFloat(row[13]) : null,
            run_1500: row[14] !== '' ? parseFloat(row[14]) : null,
          };
          const k = `${iy}|${is}|${rec.unit}|${name}`;
          if (keyMap[k] !== undefined) {
            rec.id = next[keyMap[k]].id;
            next[keyMap[k]] = rec;
            updated++;
          } else {
            rec.id = crypto.randomUUID();
            keyMap[k] = next.length;
            next.push(rec);
            imported++;
          }
        }
        setRecords(next);
        resetPages();
        showMsg(`匯入完成：${imported} 新增，${updated} 更新，${skipped} 略過`);
      } catch (err) {
        showMsg('匯入失敗：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleExportRaw() {
    if (!filtered.length) { showMsg('沒有資料'); return; }
    const headers = ['號碼','大隊','中隊','分隊','姓名','性別','年齡','年齡層',
      '立定跳遠(cm)','後拋擲遠(m)','折返跑(趟)','菱形槓硬舉(kg)',
      '懸吊屈體(次)','懸吊屈體(秒)','負重行走(kg)','1500跑步(秒)'];
    const data = filtered.map((r, i) => [
      i + 1, r.brigade, r.squad || getSquadForUnit(r.unit), r.unit,
      r.name, r.gender, r.age, r.ageGroup,
      r.standing_jump, r.ball_throw, r.shuttle_run, r.deadlift,
      r.chin_up_count, r.chin_up_sec, r.loaded_walk, r.run_1500,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...data]), '原始資料');
    XLSX.writeFile(wb, `常訓體能原始資料_${period}.xlsx`);
  }

  function handleExportResults() {
    if (!filtered.length) { showMsg('沒有資料'); return; }
    const h1 = ['號碼','大隊','中隊','分隊','姓名','性別','年齡層','立跳','後拋','折返','硬舉','懸吊','負重','跑步','總分','及格'];
    const data = filtered.map((r, i) => {
      const s = calcRecord(r);
      return [i+1, r.brigade, r.squad||getSquadForUnit(r.unit), r.unit,
        r.name, r.gender, r.ageGroup,
        s.standing_jump, s.ball_throw, s.shuttle_run, s.deadlift,
        s.chin_up, s.loaded_walk, s.run_1500, s.total, s.pass?'及格':'不及格'];
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h1, ...data]), '換算結果');
    XLSX.writeFile(wb, `常訓體能換算結果_${period}.xlsx`);
  }

  // ── analysis: cross-year trend ─────────────────────────────
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
        const [ya, sa] = [parseInt(a), a.includes('上') ? 0 : 1];
        const [yb, sb] = [parseInt(b), b.includes('上') ? 0 : 1];
        return ya !== yb ? ya - yb : sa - sb;
      })
      .map(([p, arr]) => {
        const scored = arr.map(calcRecord);
        const pass = scored.filter(s => s.pass).length;
        return {
          period: p,
          passRate: arr.length ? +(pass / arr.length * 100).toFixed(1) : 0,
          avgScore: arr.length ? +(scored.reduce((s, c) => s + c.total, 0) / arr.length).toFixed(1) : 0,
          count: arr.length,
        };
      });
  }, [records, brigade]);

  const pagedRec = filtered.slice((recPage - 1) * PAGE_SIZE, recPage * PAGE_SIZE);
  const pagedRes = filtered.slice((resPage - 1) * PAGE_SIZE, resPage * PAGE_SIZE);

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="logo">
          <b>台北消防局</b>
          <span>常訓體能成績管理系統</span>
        </div>
        {pages.map(p => (
          <button key={p.id} className={page === p.id ? 'active' : ''} onClick={() => setPage(p.id)}>
            <i className={p.icon}></i>{p.label}
          </button>
        ))}
        <small style={{ marginTop: 'auto' }}>
          {isAdmin ? '管理者模式' : '查詢模式｜管理功能需登入'}
        </small>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <header>
          <h1>{pages.find(p => p.id === page)?.label}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {msg && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{msg}</span>}
            {isAdmin
              ? <button onClick={handleAdminLogout} style={{ border: '1px solid #dc2626', background: '#fff', color: '#dc2626', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>登出管理者</button>
              : <button onClick={handleAdminLogin} style={{ border: '1px solid var(--border)', background: '#fff', color: 'var(--muted)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>管理者登入</button>
            }
          </div>
        </header>

        {/* ── Shared toolbar ── */}
        {['dashboard', 'records', 'results'].includes(page) && (
          <section style={{ paddingBottom: 0 }}>
            <div className="toolbar">
              <button onClick={handleLoadGSheet} disabled={loading}>
                {loading ? '載入中...' : '從 GSheet 載入'}
              </button>
              {isAdmin && <>
                <button onClick={handleSaveGSheet} disabled={loading}>儲存到 GSheet</button>
                <button onClick={handleExportRaw}>匯出原始資料</button>
                <button onClick={handleExportResults}>匯出換算結果</button>
                <label style={{ border: '1px solid #059669', background: '#059669', color: '#fff', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                  匯入Excel
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                    onChange={e => { handleImport(e.target.files[0]); e.target.value = ''; }} />
                </label>
              </>}
            </div>
          </section>
        )}

        {/* ── Dashboard ── */}
        {page === 'dashboard' && (
          <section>
            <div className="note">
              <b>系統定位</b>
              <p>常訓體能成績管理與統計後台，用於承辦彙整、成績換算、趨勢分析與報表輸出。</p>
            </div>
            <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
              squad={squad} setSquad={setSquad} onReset={resetPages} />
            <div className="cards" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[['總人數', stats.total], ['及格人數', stats.pass], ['及格率', stats.rate + '%'], ['平均分數', stats.avg]].map(([l, v]) => (
                <div key={l}><span>{l}</span><b>{v}</b></div>
              ))}
            </div>
          </section>
        )}

        {/* ── Records ── */}
        {page === 'records' && (
          <section>
            {!isAdmin && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#1e3a8a' }}>
              目前為查詢模式，匯入/儲存功能需管理者登入。
            </div>}
            <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
              squad={squad} setSquad={setSquad} unit={unit} setUnit={setUnit}
              search={search} setSearch={setSearch} onReset={resetPages} />
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr>
                  <th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>年齡</th>
                  {SCORE_COLS.map(c => <th key={c.key}>{c.label}</th>)}
                  <th>總分</th><th>狀態</th>
                </tr></thead>
                <tbody>
                  {pagedRec.map(r => {
                    const s = calcRecord(r);
                    return (
                      <tr key={r.id} style={!s.pass ? { background: '#fff5f5' } : {}}>
                        <td>{r.brigade}</td>
                        <td>{r.squad || getSquadForUnit(r.unit)}</td>
                        <td>{r.unit}</td>
                        <td><b>{r.name}</b></td>
                        <td>{r.gender}</td>
                        <td>{r.age}</td>
                        {SCORE_COLS.map(c => <td key={c.key}><ScoreBadge value={s[c.key] ?? 0} /></td>)}
                        <td><b style={{ color: s.pass ? '#059669' : '#dc2626' }}>{s.total}</b></td>
                        <td><PassBadge pass={s.pass} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filtered.length && <div className="empty" style={{ padding: 32, textAlign: 'center' }}>沒有符合條件的資料</div>}
            <Pagination page={recPage} total={filtered.length} onPage={setRecPage} />
          </section>
        )}

        {/* ── Results ── */}
        {page === 'results' && (
          <section>
            <FilterBar period={period} setPeriod={setPeriod} brigade={brigade} setBrigade={setBrigade}
              squad={squad} setSquad={setSquad} onReset={resetPages} />
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr>
                  <th>大隊</th><th>中隊</th><th>分隊</th><th>姓名</th><th>性別</th><th>年齡層</th>
                  {SCORE_COLS.map(c => <th key={c.key}>{c.label}</th>)}
                  <th>總分</th><th>狀態</th>
                </tr></thead>
                <tbody>
                  {pagedRes.map(r => {
                    const s = calcRecord(r);
                    return (
                      <tr key={r.id} style={!s.pass ? { background: '#fff5f5' } : {}}>
                        <td>{r.brigade}</td>
                        <td>{r.squad || getSquadForUnit(r.unit)}</td>
                        <td>{r.unit}</td>
                        <td><b>{r.name}</b></td>
                        <td>{r.gender}</td>
                        <td>{r.ageGroup}</td>
                        {SCORE_COLS.map(c => <td key={c.key}><ScoreBadge value={s[c.key] ?? 0} /></td>)}
                        <td><b style={{ color: s.pass ? '#059669' : '#dc2626' }}>{s.total}</b></td>
                        <td><PassBadge pass={s.pass} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filtered.length && <div className="empty" style={{ padding: 32, textAlign: 'center' }}>沒有符合條件的資料</div>}
            <Pagination page={resPage} total={filtered.length} onPage={setResPage} />
          </section>
        )}

        {/* ── Analysis ── */}
        {page === 'analysis' && (
          <section>
            <div className="filters" style={{ marginBottom: 16 }}>
              <select value={brigade} onChange={e => { setBrigade(e.target.value); setSquad('all'); }}>
                <option value="all">全部大隊</option>
                {BRIGADES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Cross-year trend table */}
            <h3 style={{ marginBottom: 12, fontWeight: 700 }}>跨年度趨勢</h3>
            {trendData.length === 0
              ? <div className="empty" style={{ padding: 24, textAlign: 'center' }}>無資料</div>
              : <div className="table-wrap">
                <table>
                  <thead><tr><th>期間</th><th>人數</th><th>及格率</th><th>平均分數</th><th>趨勢</th></tr></thead>
                  <tbody>
                    {trendData.map((d, i) => {
                      const prev = trendData[i - 1];
                      const trend = prev
                        ? d.passRate > prev.passRate ? '↑' : d.passRate < prev.passRate ? '↓' : '─'
                        : '─';
                      const color = trend === '↑' ? '#059669' : trend === '↓' ? '#dc2626' : '#64748b';
                      return (
                        <tr key={d.period}>
                          <td><b>{d.period}</b></td>
                          <td>{d.count}</td>
                          <td><b style={{ color: d.passRate >= 80 ? '#059669' : '#dc2626' }}>{d.passRate}%</b></td>
                          <td>{d.avgScore}</td>
                          <td><b style={{ color, fontSize: 18 }}>{trend}</b></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }

            {/* Brigade comparison */}
            <h3 style={{ margin: '28px 0 12px', fontWeight: 700 }}>大隊比較（{period}）</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>大隊</th><th>人數</th><th>及格</th><th>及格率</th><th>平均分</th></tr></thead>
                <tbody>
                  {BRIGADES.map(b => {
                    const { year: y, semester: s } = parsePeriod(period);
                    const arr = records.filter(r => r.brigade === b && String(r.year) === y && r.semester === s);
                    const scored = arr.map(calcRecord);
                    const pass = scored.filter(s => s.pass).length;
                    const rate = arr.length ? +(pass / arr.length * 100).toFixed(1) : 0;
                    const avg = arr.length ? +(scored.reduce((sum, s) => sum + s.total, 0) / arr.length).toFixed(1) : 0;
                    return (
                      <tr key={b}>
                        <td><b>{b}</b></td>
                        <td>{arr.length}</td>
                        <td>{pass}</td>
                        <td><b style={{ color: rate >= 80 ? '#059669' : '#dc2626' }}>{rate}%</b></td>
                        <td>{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
