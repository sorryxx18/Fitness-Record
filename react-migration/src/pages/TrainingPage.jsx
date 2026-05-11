import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { GAS_URL } from '../lib/fitnessCore.js';
import { PAGE_SIZE } from '../constants/appConstants.js';
import { Pagination } from '../components/Pagination.jsx';
import { gasPost, gasPostJSON } from '../services/gasClient.js';

// ── TrainingPage ─────────────────────────────────────────────
const TRAINING_LEVELS = ['大隊常訓', '中隊常訓'];
export const TRAINING_UNITS = ['第一大隊','第二大隊','第三大隊','第四大隊',
  '中正中隊','萬華中隊','文山中隊','大安中隊','南港中隊','信義中隊',
  '中山中隊','松山中隊','內湖中隊','大同中隊','士林中隊','北投中隊'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function TrainingModal({ record, isAdmin, adminKey, onSave, onClose }) {
  const isNew = !record?.id;
  const [level, setLevel] = useState(record?.level || '大隊常訓');
  const [unit, setUnit] = useState(record?.unit || TRAINING_UNITS[0]);
  const [periodVal, setPeriodVal] = useState(record?.period || '');
  const [date, setDate] = useState(record?.date || '');
  const [content, setContent] = useState(record?.content || '');
  const [participants, setParticipants] = useState(record?.participants ?? '');
  const [planFiles, setPlanFiles] = useState(record?.plan_files || []);
  const [photoFiles, setPhotoFiles] = useState(record?.photo_files || []);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [lightbox, setLightbox] = useState(null);

  async function uploadFile(file, fileType) {
    setUploading(true);
    setUploadMsg('上傳中…');
    try {
      const fileData = await fileToBase64(file);
      const data = await gasPostJSON({
        action: 'uploadFile', adminKey, fileType,
        fileName: encodeURIComponent(file.name),
        mimeType: file.type || 'application/octet-stream',
        fileData,
      });
      if (!data.ok) throw new Error(data.error);
      if (fileType === 'plan') setPlanFiles(f => [...f, data]);
      else setPhotoFiles(f => [...f, data]);
      setUploadMsg('上傳成功');
    } catch(e) { setUploadMsg('上傳失敗：' + e.message); }
    finally { setUploading(false); setTimeout(() => setUploadMsg(''), 3000); }
  }

  async function removeFile(fileId, fileType) {
    if (!window.confirm('確定刪除此檔案？')) return;
    try { await gasPost({ action: 'deleteFile', adminKey, fileId }); } catch(e) {}
    if (fileType === 'plan') setPlanFiles(f => f.filter(x => x.fileId !== fileId));
    else setPhotoFiles(f => f.filter(x => x.fileId !== fileId));
  }

  function handleSubmit() {
    if (!periodVal.trim()) { alert('請填寫年度期別'); return; }
    if (!content.trim()) { alert('請填寫課程內容'); return; }
    onSave({
      id: record?.id || crypto.randomUUID(),
      level, unit, period: periodVal.trim(), date, content: content.trim(),
      participants: participants !== '' ? parseInt(participants) : null,
      plan_files: planFiles, photo_files: photoFiles,
      created_at: record?.created_at || undefined,
    });
  }

  const iStyle = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' };
  const lStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:24, width:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ marginBottom:20, fontSize:16, fontWeight:700 }}>{isNew ? '新增常訓紀錄' : '編輯常訓紀錄'}</h2>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div><label style={lStyle}>訓練層級</label>
            <select style={iStyle} value={level} onChange={e => setLevel(e.target.value)}>
              {TRAINING_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div><label style={lStyle}>填報單位</label>
            <select style={iStyle} value={unit} onChange={e => setUnit(e.target.value)}>
              {TRAINING_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div><label style={lStyle}>年度期別 *</label>
            <input style={iStyle} value={periodVal} onChange={e => setPeriodVal(e.target.value)} placeholder="如：114年下半年 或 114年11月" />
          </div>
          <div><label style={lStyle}>參與人次</label>
            <input style={iStyle} type="number" value={participants} onChange={e => setParticipants(e.target.value)} placeholder="人" />
          </div>
          <div style={{ gridColumn:'1/-1' }}><label style={lStyle}>訓練日期</label>
            <input style={iStyle} value={date} onChange={e => setDate(e.target.value)} placeholder="如：114年11月24、25、26、27日" />
          </div>
          <div style={{ gridColumn:'1/-1' }}><label style={lStyle}>課程內容 *</label>
            <textarea style={{ ...iStyle, height:80, resize:'vertical' }} value={content} onChange={e => setContent(e.target.value)} />
          </div>
        </div>

        {isAdmin && <>
          {/* 訓練計畫 */}
          <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:14, marginBottom:12 }}>
            <p style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>訓練計畫文件</p>
            <label style={{ display:'inline-block', border:'1px solid #059669', color:'#059669', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:13, marginBottom:8 }}>
              上傳文件（PDF/Word/PPT）
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" style={{ display:'none' }}
                onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0], 'plan'); e.target.value=''; }} disabled={uploading} />
            </label>
            {planFiles.map(f => (
              <div key={f.fileId} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }}>
                <i className="ri-file-text-line" style={{ color:'#475569' }}></i>
                <a href={f.viewUrl} target="_blank" rel="noreferrer" style={{ flex:1, color:'#2563eb', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</a>
                <a href={f.downloadUrl} target="_blank" rel="noreferrer" style={{ color:'#64748b', fontSize:12 }}>下載</a>
                <button onClick={() => removeFile(f.fileId, 'plan')} style={{ border:'none', background:'none', color:'#dc2626', cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>

          {/* 訓練照片 */}
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>訓練紀實照片</p>
            <label style={{ display:'inline-block', border:'1px solid #059669', color:'#059669', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:13, marginBottom:8 }}>
              上傳照片（JPG/PNG）
              <input type="file" accept="image/*" multiple style={{ display:'none' }}
                onChange={e => { Array.from(e.target.files).forEach(f => uploadFile(f, 'photo')); e.target.value=''; }} disabled={uploading} />
            </label>
            {uploadMsg && <span style={{ marginLeft:10, fontSize:12, color:'#64748b' }}>{uploadMsg}</span>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:8 }}>
              {photoFiles.map(f => (
                <div key={f.fileId} style={{ position:'relative', aspectRatio:'1', borderRadius:6, overflow:'hidden', border:'1px solid #e2e8f0' }}>
                  <img src={f.thumbUrl} alt={f.name} style={{ width:'100%', height:'100%', objectFit:'cover', cursor:'pointer' }}
                    onClick={() => setLightbox(f)} />
                  <button onClick={() => removeFile(f.fileId, 'photo')}
                    style={{ position:'absolute', top:2, right:2, border:'none', background:'rgba(0,0,0,0.55)', color:'#fff', borderRadius:'50%', width:20, height:20, cursor:'pointer', fontSize:13, lineHeight:'20px', textAlign:'center', padding:0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </>}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onClose} style={{ border:'1px solid #64748b', background:'#fff', color:'#64748b', borderRadius:6, padding:'8px 16px', cursor:'pointer', fontSize:13 }}>取消</button>
          <button onClick={handleSubmit} style={{ border:'none', background:'#dc2626', color:'#fff', borderRadius:6, padding:'8px 16px', cursor:'pointer', fontSize:13 }}>{isNew ? '新增' : '儲存'}</button>
        </div>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, cursor:'zoom-out' }}>
          <img src={lightbox.viewUrl?.replace('/view', '/preview') || lightbox.thumbUrl?.replace('w400','w1200')} alt={lightbox.name}
            style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:8, boxShadow:'0 0 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()} />
          <a href={lightbox.downloadUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            style={{ position:'absolute', bottom:24, right:24, background:'rgba(255,255,255,0.15)', color:'#fff', borderRadius:6, padding:'8px 16px', textDecoration:'none', fontSize:13 }}>下載</a>
        </div>
      )}
    </div>
  );
}

export function TrainingPage({ isAdmin, adminKey, onRecordsChange, onLoadingChange }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [editTarget, setEditTarget] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'wall'
  const [pendingIds, setPendingIds] = useState(new Set());
  const [syncing, setSyncing] = useState(false);


  // 進頁自動載入
  useEffect(() => { handleLoad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allPeriods = useMemo(() => [...new Set(records.map(r => r.period))].sort().reverse(), [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (levelFilter !== 'all' && r.level !== levelFilter) return false;
    if (unitFilter !== 'all' && r.unit !== unitFilter) return false;
    if (periodFilter !== 'all' && r.period !== periodFilter) return false;
    return true;
  }), [records, levelFilter, unitFilter, periodFilter]);

  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // 成果牆：從篩選後的紀錄中收集所有照片
  const allPhotos = useMemo(() => {
    const result = [];
    filtered.forEach(r => {
      (r.photo_files || []).forEach(photo => {
        result.push({ photo, unit: r.unit, period: r.period, level: r.level, content: r.content, recordId: r.id });
      });
    });
    return result;
  }, [filtered]);

  function showMsg(text) { setMsg(text); setTimeout(() => setMsg(''), 4000); }

  async function handleLoad() {
    setLoading(true); onLoadingChange?.(true);
    try {
      const params = new URLSearchParams({ action: 'trainingLoad' });
      const resp = await fetch(GAS_URL + '?' + params);
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setRecords(data.records);
      onRecordsChange?.(data.records);
      setPage(1);
      showMsg(`已載入 ${data.records.length} 筆`);
    } catch(e) { showMsg('載入失敗：' + e.message); }
    finally { setLoading(false); onLoadingChange?.(false); }
  }

  async function handleSave(rec) {
    const isNew = !records.find(r => r.id === rec.id);
    if (isNew) {
      const dup = records.find(r => r.unit === rec.unit && r.period === rec.period);
      if (dup && !window.confirm(`本單位（${rec.unit}）${rec.period} 已有填報紀錄，確定新增一筆？`)) return;
    }
    const idx = records.findIndex(r => r.id === rec.id);
    const next = idx >= 0 ? records.map(r => r.id === rec.id ? rec : r) : [...records, rec];
    setRecords(next);
    setEditTarget(null);
    try {
      await gasPost({ action: 'trainingSave', record: JSON.stringify(rec) });
      showMsg(idx >= 0 ? '已更新' : '已新增');
    } catch { showMsg('儲存失敗，請稍後再試'); }
  }

  async function handleDelete(id) {
    const code = window.prompt('請輸入確認碼以刪除此筆（輸入：確認刪除）');
    if (code === null) return;
    if (code !== '確認刪除') { showMsg('確認碼不正確，取消刪除'); return; }
    setRecords(prev => prev.filter(r => r.id !== id));
    setViewRecord(null);
    try {
      await gasPost({ action: 'trainingDelete', id });
      showMsg('已刪除');
    } catch { showMsg('刪除失敗，請稍後再試'); }
  }


  async function handleBatchSync() {
    const toSync = records.filter(r => pendingIds.has(r.id));
    if (!toSync.length) return;
    setSyncing(true); onLoadingChange?.(true);
    let done = 0, failed = 0;
    for (const rec of toSync) {
      try {
        await gasPost({ action: 'trainingSave', record: JSON.stringify(rec) });
        setPendingIds(prev => { const s = new Set(prev); s.delete(rec.id); return s; });
        done++;
      } catch { failed++; }
    }
    setSyncing(false); onLoadingChange?.(false);
    showMsg(failed ? `上傳完成：${done} 成功，${failed} 失敗` : `已上傳 ${done} 筆`);
  }

  function handleDownloadTemplate() {
    const headers = ['訓練層級', '填報單位', '年度期別', '訓練日期', '課程內容', '參與人次'];
    const example = ['大隊常訓', '第一大隊', '114年上半年', '114年3月24、25日', '搜救技術訓練、體能強化', 50];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 36 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, '常訓紀錄');
    XLSX.writeFile(wb, '常訓紀錄匯入範本.xlsx');
  }

  function handleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets['常訓紀錄'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let added = 0, skipped = 0;
        const newIds = [];
        const next = [...records];
        const existing = new Set(records.map(r => `${r.unit}|${r.period}|${r.content}`));
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[4]) { skipped++; continue; }
          const key = `${String(row[1]||'').trim()}|${String(row[2]||'').trim()}|${String(row[4]||'').trim()}`;
          if (existing.has(key)) { skipped++; continue; }
          const newId = crypto.randomUUID();
          next.push({
            id: newId,
            level: String(row[0]||'').trim(),
            unit: String(row[1]||'').trim(),
            period: String(row[2]||'').trim(),
            date: String(row[3]||'').trim(),
            content: String(row[4]||'').trim(),
            participants: row[5] !== undefined && row[5] !== '' ? parseInt(row[5]) : null,
            plan_files: [], photo_files: [],
          });
          existing.add(key); newIds.push(newId); added++;
        }
        setRecords(next); setPage(1);
        setPendingIds(prev => { const s = new Set(prev); newIds.forEach(id => s.add(id)); return s; });
        showMsg(`匯入完成：${added} 新增，${skipped} 略過，請點「上傳到後端」儲存`);
      } catch(err) { showMsg('匯入失敗：' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }

  const btnS = (color='#dc2626') => ({ border:`1px solid ${color}`, background:color, color:'#fff', borderRadius:6, padding:'8px 12px', cursor:'pointer', fontSize:13 });
  const outS = (color='#64748b') => ({ border:`1px solid ${color}`, background:'#fff', color, borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:13 });

  return (
    <section>
      {/* 填報說明 */}
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#1e3a8a', lineHeight:1.6 }}>
        <b>填報說明：</b>本頁開放各單位自行填報。同單位同期別如有多筆，以最新填報為主。刪除須輸入確認碼，如有疑問請聯繫管理者。
      </div>

      {/* 工具列 */}
      <div className="toolbar" style={{ marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <button style={btnS('#475569')} onClick={handleLoad} disabled={loading}>{loading ? '載入中…' : '更新資料'}</button>
        <button style={btnS('#2563eb')} onClick={() => setEditTarget({})}>新增紀錄</button>
        <button style={outS('#059669')} onClick={handleDownloadTemplate}>
          <i className="ri-download-line" style={{ marginRight:4 }}></i>範本下載
        </button>
        <label style={btnS('#059669')} title="依範本格式批次匯入常訓紀錄">
          <i className="ri-upload-line" style={{ marginRight:4 }}></i>匯入 Excel
          <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
            onChange={e => { handleImport(e.target.files[0]); e.target.value=''; }} />
        </label>
        {pendingIds.size > 0 && (
          <button style={btnS('#7c3aed')} onClick={handleBatchSync} disabled={syncing}>
            {syncing ? '上傳中…' : `上傳 ${pendingIds.size} 筆到後端`}
          </button>
        )}
        {msg && <span style={{ fontSize:13, color:'var(--muted)' }}>{msg}</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <button
            style={viewMode==='list' ? btnS('#475569') : outS()}
            onClick={() => setViewMode('list')}
            title="列表檢視"
          ><i className="ri-list-unordered"></i></button>
          <button
            style={viewMode==='wall' ? btnS('#475569') : outS()}
            onClick={() => setViewMode('wall')}
            title="成果牆"
          ><i className="ri-image-2-line"></i></button>
        </div>
      </div>

      {/* 篩選 */}
      <div className="filters" style={{ marginBottom:12 }}>
        <select value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(1); }}>
          <option value="all">全部層級</option>
          {TRAINING_LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
        <select value={unitFilter} onChange={e => { setUnitFilter(e.target.value); setPage(1); }}>
          <option value="all">全部單位</option>
          {TRAINING_UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
        <select value={periodFilter} onChange={e => { setPeriodFilter(e.target.value); setPage(1); }}>
          <option value="all">全部期別</option>
          {allPeriods.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* ── 列表模式 ─── */}
      {viewMode === 'list' && <>
        <div className="table-wrap">
          <table>
            <thead><tr><th>層級</th><th>單位</th><th>年度期別</th><th>訓練日期</th><th>課程內容</th><th>人次</th><th>附件</th><th></th></tr></thead>
            <tbody>
              {paged.map(r => (
                <tr key={r.id}>
                  <td><span style={{ fontSize:12, background: r.level==='大隊常訓'?'#fee2e2':'#dbeafe', color: r.level==='大隊常訓'?'#dc2626':'#2563eb', borderRadius:4, padding:'2px 6px' }}>{r.level}</span></td>
                  <td>{r.unit}</td>
                  <td>{r.period}</td>
                  <td style={{ fontSize:12, color:'#64748b', maxWidth:120, wordBreak:'break-all' }}>{r.date}</td>
                  <td style={{ maxWidth:240 }}><span style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{r.content}</span></td>
                  <td style={{ textAlign:'right' }}>{r.participants ?? '—'}</td>
                  <td>
                    {(r.plan_files?.length > 0 || r.photo_files?.length > 0) && (
                      <span style={{ fontSize:12, color:'#059669' }}>
                        {r.plan_files?.length > 0 && <span title="計畫文件"><i className="ri-file-text-line"></i>{r.plan_files.length} </span>}
                        {r.photo_files?.length > 0 && <span title="照片"><i className="ri-image-line"></i>{r.photo_files.length}</span>}
                      </span>
                    )}
                  </td>
                  <td>
                    <button onClick={() => setViewRecord(r)} style={{ ...outS('#2563eb'), padding:'3px 8px', fontSize:12, marginRight:4 }}>詳情</button>
                    <button onClick={() => setEditTarget(r)} style={{ ...outS(), padding:'3px 8px', fontSize:12 }}>編輯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div style={{ padding:32, textAlign:'center', color:'var(--muted)' }}>沒有符合條件的資料{records.length === 0 ? '，請先點「更新資料」' : ''}</div>}
        <Pagination page={page} total={filtered.length} onPage={setPage} />
      </>}

      {/* ── 成果牆模式 ─── */}
      {viewMode === 'wall' && (
        <div>
          {allPhotos.length === 0 ? (
            <div style={{ padding:64, textAlign:'center', color:'var(--muted)', fontSize:14 }}>
              <i className="ri-image-2-line" style={{ fontSize:40, display:'block', marginBottom:12, opacity:0.3 }}></i>
              {records.length === 0 ? '請先點「更新資料」載入紀錄' : '目前篩選範圍內沒有訓練照片'}
            </div>
          ) : (
            <>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>共 {allPhotos.length} 張照片</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10 }}>
                {allPhotos.map((item, idx) => (
                  <div key={idx}
                    style={{ position:'relative', aspectRatio:'1', borderRadius:8, overflow:'hidden', cursor:'zoom-in', boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}
                    onClick={() => setLightbox({ ...item.photo, _unit: item.unit, _period: item.period, _content: item.content })}
                  >
                    <img
                      src={item.photo.thumbUrl}
                      alt={item.photo.name}
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                    />
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent, rgba(0,0,0,0.72))', padding:'20px 8px 8px' }}>
                      <div style={{ color:'#fff', fontSize:12, fontWeight:600, lineHeight:1.3 }}>{item.unit}</div>
                      <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>{item.period}</div>
                    </div>
                    <div style={{ position:'absolute', top:6, left:6 }}>
                      <span style={{ fontSize:10, background: item.level==='大隊常訓'?'rgba(220,38,38,0.85)':'rgba(37,99,235,0.85)', color:'#fff', borderRadius:3, padding:'2px 5px' }}>{item.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 詳情 Modal */}
      {viewRecord && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:24, width:600, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <span style={{ fontSize:12, background: viewRecord.level==='大隊常訓'?'#fee2e2':'#dbeafe', color: viewRecord.level==='大隊常訓'?'#dc2626':'#2563eb', borderRadius:4, padding:'2px 8px', marginRight:8 }}>{viewRecord.level}</span>
                <b>{viewRecord.unit}</b> · <span style={{ color:'#64748b' }}>{viewRecord.period}</span>
              </div>
              <button onClick={() => setViewRecord(null)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>×</button>
            </div>
            {viewRecord.date && <p style={{ fontSize:13, color:'#64748b', marginBottom:12 }}>訓練日期：{viewRecord.date}</p>}
            <p style={{ marginBottom:8 }}><b>課程內容</b></p>
            <p style={{ fontSize:14, color:'#334155', marginBottom:16, whiteSpace:'pre-wrap' }}>{viewRecord.content}</p>
            {viewRecord.participants != null && <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>參與人次：{viewRecord.participants} 人</p>}

            {viewRecord.plan_files?.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>訓練計畫文件</p>
                {viewRecord.plan_files.map(f => (
                  <div key={f.fileId} style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }}>
                    <i className="ri-file-text-line" style={{ color:'#475569' }}></i>
                    <a href={f.viewUrl} target="_blank" rel="noreferrer" style={{ flex:1, color:'#2563eb', textDecoration:'none' }}>{f.name}</a>
                    <a href={f.downloadUrl} target="_blank" rel="noreferrer" style={{ color:'#64748b', fontSize:12 }}>下載</a>
                  </div>
                ))}
              </div>
            )}

            {viewRecord.photo_files?.length > 0 && (
              <div>
                <p style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>訓練紀實照片（{viewRecord.photo_files.length} 張）</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {viewRecord.photo_files.map(f => (
                    <div key={f.fileId} style={{ aspectRatio:'1', borderRadius:6, overflow:'hidden', cursor:'zoom-in', border:'1px solid #e2e8f0' }}
                      onClick={() => setLightbox(f)}>
                      <img src={f.thumbUrl} alt={f.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
              <button onClick={() => handleDelete(viewRecord.id)} style={{ border:'1px solid #dc2626', background:'#fff', color:'#dc2626', borderRadius:6, padding:'8px 12px', cursor:'pointer', fontSize:13 }}>刪除此筆</button>
              <button onClick={() => { setViewRecord(null); setEditTarget(viewRecord); }} style={{ border:'none', background:'#dc2626', color:'#fff', borderRadius:6, padding:'8px 16px', cursor:'pointer', fontSize:13 }}>編輯</button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯/新增 Modal */}
      {editTarget !== null && (
        <TrainingModal
          record={Object.keys(editTarget).length ? editTarget : null}
          isAdmin={isAdmin} adminKey={adminKey}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, cursor:'zoom-out' }}>
          <img src={lightbox.thumbUrl?.replace('w400','w1600') || lightbox.viewUrl} alt={lightbox.name}
            style={{ maxWidth:'92vw', maxHeight:'85vh', borderRadius:8 }} onClick={e => e.stopPropagation()} />
          {(lightbox._unit || lightbox._period) && (
            <div style={{ position:'absolute', top:20, left:24, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{lightbox._unit}</div>
              <div style={{ fontSize:13, opacity:0.85 }}>{lightbox._period}</div>
            </div>
          )}
          <a href={lightbox.downloadUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            style={{ position:'absolute', bottom:24, right:24, background:'rgba(255,255,255,0.15)', color:'#fff', borderRadius:6, padding:'8px 16px', textDecoration:'none', fontSize:13 }}>下載</a>
        </div>
      )}
    </section>
  );
}
