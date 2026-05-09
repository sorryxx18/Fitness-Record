import { CONV_TABLE, UNIT_MAP } from './legacyTables.js';

export { CONV_TABLE, UNIT_MAP };

export const GAS_URL = 'https://script.google.com/macros/s/AKfycbyFk8sH4a8Zuwv6pgJHzAVHo5w9TF6BN9tXXZvayFQzkD45MD7BFS59HQ8Fw19wfog/exec';

const now = new Date();
export const DEFAULT_YEAR = String(now.getFullYear() - 1911);
export const DEFAULT_SEMESTER = now.getMonth() < 6 ? '上半年' : '下半年';
export const DEFAULT_PERIOD = DEFAULT_YEAR + '年' + DEFAULT_SEMESTER;
export const BRIGADES = Object.keys(UNIT_MAP);

export function getAllUnits(brigade, squad) {
  if (!brigade || brigade === 'all') {
    return Object.values(UNIT_MAP).flatMap(squadMap => Object.values(squadMap).flat());
  }
  const squadMap = UNIT_MAP[brigade] || {};
  if (squad && squad !== 'all') return squadMap[squad] || [];
  return Object.values(squadMap).flat();
}

export function getSquadsForBrigade(brigade) {
  if (!brigade || brigade === 'all') return [];
  return Object.keys(UNIT_MAP[brigade] || {});
}

export function getBrigadeForUnit(unit) {
  for (const [brigade, squadMap] of Object.entries(UNIT_MAP)) {
    for (const units of Object.values(squadMap)) {
      if (units.includes(unit)) return brigade;
    }
  }
  return '';
}

export function getSquadForUnit(unit) {
  for (const squadMap of Object.values(UNIT_MAP)) {
    for (const [squad, units] of Object.entries(squadMap)) {
      if (units.includes(unit)) return squad;
    }
  }
  return '';
}

export function parsePeriod(period) {
  const m = String(period || '').match(/^(\d+)年(上半年|下半年)$/);
  return m ? { year: m[1], semester: m[2] } : { year: '', semester: '' };
}

export function normalizeRecordValue(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function recordPeriodKey(record) {
  return normalizeRecordValue(record.year) + '|' + normalizeRecordValue(record.semester);
}

export function recordIdentityKey(record) {
  return [record.year, record.semester, record.brigade, record.squad, record.unit, record.name, record.gender, record.age, record.standing_jump, record.ball_throw, record.shuttle_run, record.deadlift, record.chin_up_count, record.chin_up_sec, record.loaded_walk, record.run_1500].map(normalizeRecordValue).join('|');
}

export function dedupeRecordsByIdentity(list) {
  const map = new Map();
  for (const record of list || []) map.set(recordIdentityKey(record), record);
  return [...map.values()];
}

export function getAgeGroup(age) {
  const a = Number.parseInt(age, 10);
  if (Number.isNaN(a)) return '20-29';
  if (a < 30) return '20-29';
  if (a < 40) return '30-39';
  if (a < 50) return '40-49';
  return '50+';
}

export function calcScore(gender, ageGroup, item, value) {
  const v = Number.parseFloat(value);
  if (Number.isNaN(v)) return 0;
  const ag = gender === '女' ? '不分年齡' : ageGroup;
  const lookup = CONV_TABLE?.[gender]?.[ag]?.[item];
  if (!lookup || !lookup.length) return 0;
  const op = lookup[0].op;
  let best = 0;
  for (const row of lookup) {
    const passed = op === '<=' ? v <= row.val : v >= row.val;
    if (passed) best = Math.max(best, row.score || 0);
  }
  return best;
}

export function calcRecord(record) {
  const ageGroup = record.ageGroup || getAgeGroup(record.age);
  const scores = {
    standing_jump: calcScore(record.gender, ageGroup, '立定跳遠', record.standing_jump),
    ball_throw: calcScore(record.gender, ageGroup, '後拋擲遠', record.ball_throw),
    shuttle_run: calcScore(record.gender, ageGroup, '折返跑', record.shuttle_run),
    deadlift: calcScore(record.gender, ageGroup, '菱形槓硬舉', record.deadlift),
    chin_up: Math.max(
      calcScore(record.gender, ageGroup, '懸吊屈體', record.chin_up_count),
      calcScore(record.gender, ageGroup, '懸吊秒數', record.chin_up_sec),
    ),
    loaded_walk: calcScore(record.gender, ageGroup, '負重行走', record.loaded_walk),
    run_1500: calcScore(record.gender, ageGroup, '1500跑步', record.run_1500),
  };
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const passLine = record.year && Number.parseInt(record.year, 10) <= 115 ? 50 : 60;
  return { ...scores, total, passLine, pass: total >= passLine };
}

export async function loadFromGAS({ year, semester }, currentRecords = []) {
  const params = new URLSearchParams({ action: 'load' });
  if (year && year !== 'all') params.set('year', year);
  if (semester) params.set('semester', semester);
  const resp = await fetch(GAS_URL + '?' + params.toString());
  const data = await resp.json();
  if (!data?.ok || !Array.isArray(data.records)) throw new Error(data?.error || 'GSheet 載入失敗');
  const incoming = dedupeRecordsByIdentity(data.records);
  const incomingPeriods = new Set(incoming.map(recordPeriodKey));
  const retained = currentRecords.filter(r => !incomingPeriods.has(recordPeriodKey(r)));
  return { records: [...retained, ...incoming], incoming, skipped: data.records.length - incoming.length };
}
