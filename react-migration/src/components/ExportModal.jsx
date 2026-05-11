import { useMemo, useState } from 'react';
import { calcRecord, getSquadForUnit, parsePeriod } from '../lib/fitnessCore.js';
import { PERIOD_OPTIONS, SCORE_COLS } from '../constants/appConstants.js';
import { TRAINING_UNITS } from '../pages/TrainingPage.jsx';

// ── Excel 樣式匯出 ────────────────────────────────────────────
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
const HEADER_FONT = { name: '微軟正黑體', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const TITLE_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
const TITLE_FONT  = { name: '微軟正黑體', bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
const PASS_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
const FAIL_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
const ODD_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
const THIN_BORDER = { top:{style:'thin',color:{argb:'FFE2E8F0'}}, left:{style:'thin',color:{argb:'FFE2E8F0'}}, bottom:{style:'thin',color:{argb:'FFE2E8F0'}}, right:{style:'thin',color:{argb:'FFE2E8F0'}} };

async function exportFitnessExcel({ records, period, mode, passFilter }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '臺北市消防局常訓體能成績管理系統';
  wb.created = new Date();

  const sheets = mode === 'both'
    ? [{ name: '原始數值', calc: false }, { name: '換算得分', calc: true }]
    : mode === 'raw'
      ? [{ name: '原始數值', calc: false }]
      : [{ name: '換算得分', calc: true }];

  for (const { name, calc } of sheets) {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] });

    // 標題列
    const colCount = calc ? 14 : 17;
    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell('A1');
    titleCell.value = `臺北市消防局 常訓體能成績 ─ ${period}`;
    titleCell.fill = TITLE_FILL; titleCell.font = TITLE_FONT;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells(2, 1, 2, colCount);
    const subCell = ws.getCell('A2');
    subCell.value = `匯出時間：${new Date().toLocaleString('zh-TW')}　共 ${records.length} 筆`;
    subCell.font = { name: '微軟正黑體', italic: true, size: 10, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'right' };
    ws.getRow(2).height = 18;

    // 表頭
    const headers = calc
      ? ['#','大隊','中隊','分隊','姓名','性別','年齡層','立跳','後拋','折返','硬舉','懸吊','負重','跑步','總分','及格']
      : ['#','大隊','中隊','分隊','姓名','性別','年齡','年齡層','立定跳遠(cm)','後拋擲遠(m)','折返跑(趟)','菱形槓硬舉(kg)','懸吊屈體(次)','懸吊屈體(秒)','負重行走(kg)','1500跑步(秒)'];
    const hRow = ws.addRow(headers);
    hRow.height = 22;
    hRow.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = THIN_BORDER; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }; });

    // 資料
    let dataRecs = records;
    if (passFilter === 'pass') dataRecs = records.filter(r => calcRecord(r).pass);
    if (passFilter === 'fail') dataRecs = records.filter(r => !calcRecord(r).pass);

    dataRecs.forEach((r, i) => {
      const s = calcRecord(r);
      const row = calc
        ? [i+1, r.brigade, r.squad||getSquadForUnit(r.unit), r.unit, r.name, r.gender, r.ageGroup, s.standing_jump, s.ball_throw, s.shuttle_run, s.deadlift, s.chin_up, s.loaded_walk, s.run_1500, s.total, s.pass?'及格':'不及格']
        : [i+1, r.brigade, r.squad||getSquadForUnit(r.unit), r.unit, r.name, r.gender, r.age, r.ageGroup, r.standing_jump, r.ball_throw, r.shuttle_run, r.deadlift, r.chin_up_count, r.chin_up_sec, r.loaded_walk, r.run_1500];
      const dRow = ws.addRow(row);
      const fill = calc ? (s.pass ? PASS_FILL : FAIL_FILL) : (i%2===0 ? ODD_FILL : null);
      dRow.eachCell(c => { if (fill) c.fill = fill; c.border = THIN_BORDER; c.alignment = { vertical: 'middle' }; });
      if (calc) dRow.getCell(15).font = { bold: true, color: { argb: s.pass ? 'FF059669' : 'FFDC2626' } };
    });

    // 欄寬
    const widths = calc
      ? [5,10,10,12,8,5,8,7,7,7,7,7,7,7,7,7]
      : [5,10,10,12,8,5,6,8,12,10,10,12,10,10,10,12];
    widths.forEach((w, i) => { ws.getColumn(i+1).width = w; });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `常訓體能成績_${period}_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'-')}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

async function exportTrainingExcel({ records, filterLabel }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '臺北市消防局常訓體能成績管理系統';

  const ws = wb.addWorksheet('常訓紀錄', { views: [{ state: 'frozen', ySplit: 3 }] });
  const COL = 7;

  ws.mergeCells(1, 1, 1, COL);
  const titleCell = ws.getCell('A1');
  titleCell.value = `臺北市消防局 常訓紀錄${filterLabel ? ' ─ ' + filterLabel : ''}`;
  titleCell.fill = TITLE_FILL; titleCell.font = TITLE_FONT;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, COL);
  const subCell = ws.getCell('A2');
  subCell.value = `匯出時間：${new Date().toLocaleString('zh-TW')}　共 ${records.length} 筆`;
  subCell.font = { name: '微軟正黑體', italic: true, size: 10, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'right' };
  ws.getRow(2).height = 18;

  const hRow = ws.addRow(['#','訓練層級','填報單位','年度期別','訓練日期','課程內容','參與人次']);
  hRow.height = 22;
  hRow.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = THIN_BORDER; c.alignment = { horizontal: 'center', vertical: 'middle' }; });

  const LEVEL_FILL_1 = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFEE2E2' } };
  const LEVEL_FILL_2 = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFDBEAFE' } };

  records.forEach((r, i) => {
    const dRow = ws.addRow([i+1, r.level, r.unit, r.period, r.date, r.content, r.participants ?? '']);
    const fill = r.level === '大隊常訓' ? LEVEL_FILL_1 : LEVEL_FILL_2;
    dRow.eachCell((c, ci) => {
      c.border = THIN_BORDER;
      c.alignment = { vertical: 'middle', wrapText: ci === 6 };
      if (ci <= 5 || ci === 7) c.fill = fill;
    });
    if (r.content && r.content.length > 30) dRow.height = 36;
  });

  [5, 8, 12, 10, 16, 40, 8].forEach((w, i) => { ws.getColumn(i+1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `常訓紀錄${filterLabel?'_'+filterLabel:''}_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'-')}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

// ── ExportModal ───────────────────────────────────────────────
export function ExportModal({ fitnessRecords, trainingRecords, period, onClose }) {
  const [tab, setTab] = useState('fitness');
  const [fitPeriod, setFitPeriod] = useState(period);
  const [fitMode, setFitMode] = useState('both');
  const [passFilter, setPassFilter] = useState('all');
  const [trainLevel, setTrainLevel] = useState('all');
  const [trainUnit, setTrainUnit] = useState('all');
  const [trainPeriod, setTrainPeriod] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState('');

  const fitFiltered = useMemo(() => {
    const { year, semester } = parsePeriod(fitPeriod);
    return fitnessRecords.filter(r =>
      (!year || String(r.year) === year) && (!semester || (r.semester||'上半年') === semester)
    );
  }, [fitnessRecords, fitPeriod]);

  const trainFiltered = useMemo(() => trainingRecords.filter(r => {
    if (trainLevel !== 'all' && r.level !== trainLevel) return false;
    if (trainUnit !== 'all' && r.unit !== trainUnit) return false;
    if (trainPeriod !== 'all' && r.period !== trainPeriod) return false;
    return true;
  }), [trainingRecords, trainLevel, trainUnit, trainPeriod]);

  const trainPeriods = useMemo(() => [...new Set(trainingRecords.map(r => r.period))].sort().reverse(), [trainingRecords]);

  async function doExport() {
    setExporting(true); setMsg('產生中…');
    try {
      if (tab === 'fitness') {
        await exportFitnessExcel({ records: fitFiltered, period: fitPeriod, mode: fitMode, passFilter });
      } else {
        const parts = [trainLevel !== 'all' && trainLevel, trainUnit !== 'all' && trainUnit, trainPeriod !== 'all' && trainPeriod].filter(Boolean);
        await exportTrainingExcel({ records: trainFiltered, filterLabel: parts.join('_') });
      }
      setMsg('匯出完成！');
    } catch(e) { setMsg('匯出失敗：' + e.message); }
    finally { setExporting(false); }
  }

  const count = tab === 'fitness' ? fitFiltered.length : trainFiltered.length;
  const tabBtn = (id, label) => ({
    border: 'none', borderBottom: `3px solid ${tab===id?'#dc2626':'transparent'}`,
    background: 'none', color: tab===id?'#dc2626':'#64748b', fontWeight: tab===id?700:400,
    padding: '10px 20px', cursor: 'pointer', fontSize: 14,
  });
  const selS = { border:'1px solid #e2e8f0', borderRadius:6, padding:'7px 10px', fontSize:13, width:'100%' };
  const radioGrp = (value, setter, opts) => (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {opts.map(([v, l]) => (
        <label key={v} style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, cursor:'pointer', padding:'5px 10px', border:`1px solid ${value===v?'#dc2626':'#e2e8f0'}`, borderRadius:6, background:value===v?'#fff1f2':'#fff' }}>
          <input type="radio" name={setter} checked={value===v} onChange={() => setter(v)} style={{ display:'none' }} />
          {l}
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:0, width:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'20px 24px 0', borderBottom:'1px solid #e2e8f0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>客製化匯出</h2>
            <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>×</button>
          </div>
          <div style={{ display:'flex', gap:0 }}>
            <button style={tabBtn('fitness','體能成績')} onClick={() => setTab('fitness')}>體能成績</button>
            <button style={tabBtn('training','常訓紀錄')} onClick={() => setTab('training')}>常訓紀錄</button>
          </div>
        </div>

        <div style={{ padding:'20px 24px' }}>
          {tab === 'fitness' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>年度期別</label>
                <select style={selS} value={fitPeriod} onChange={e => setFitPeriod(e.target.value)}>
                  {PERIOD_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>匯出格式</label>
                {radioGrp(fitMode, setFitMode, [['raw','原始數值'],['calc','換算得分'],['both','兩者都要']])}
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>篩選及格狀態</label>
                {radioGrp(passFilter, setPassFilter, [['all','全部'],['pass','僅及格'],['fail','僅不及格']])}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>訓練層級</label>
                {radioGrp(trainLevel, setTrainLevel, [['all','全部'],['大隊常訓','大隊常訓'],['中隊常訓','中隊常訓']])}
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>填報單位</label>
                <select style={selS} value={trainUnit} onChange={e => setTrainUnit(e.target.value)}>
                  <option value="all">全部單位</option>
                  {TRAINING_UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', marginBottom:6 }}>年度期別</label>
                <select style={selS} value={trainPeriod} onChange={e => setTrainPeriod(e.target.value)}>
                  <option value="all">全部期別</option>
                  {trainPeriods.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginTop:20, padding:'12px 16px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'#475569' }}>預計匯出：<b style={{ color:'#dc2626' }}>{count}</b> 筆</span>
            {msg && <span style={{ fontSize:12, color:'#64748b' }}>{msg}</span>}
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
            <button onClick={onClose} style={{ border:'1px solid #e2e8f0', background:'#fff', color:'#64748b', borderRadius:6, padding:'9px 18px', cursor:'pointer', fontSize:13 }}>取消</button>
            <button onClick={doExport} disabled={exporting || count === 0}
              style={{ border:'none', background: count===0?'#e2e8f0':'#dc2626', color: count===0?'#94a3b8':'#fff', borderRadius:6, padding:'9px 20px', cursor: count===0?'default':'pointer', fontSize:13, fontWeight:600 }}>
              {exporting ? '產生中…' : '匯出 Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

