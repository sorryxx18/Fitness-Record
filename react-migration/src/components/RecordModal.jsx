import { useMemo, useState } from 'react';
import { BRIGADES, getAgeGroup, getAllUnits, getSquadForUnit, getSquadsForBrigade, parsePeriod } from '../lib/fitnessCore.js';

// ── RecordModal ─────────────────────────────────────────────
const mLabel = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 };
const mInput = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' };

export function RecordModal({ record, period, onSave, onDelete, onClose }) {
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

